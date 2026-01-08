import { Component, ElementRef, input, output, effect, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SweepPoint, BacktestMetrics } from '../services/gemini.service';

declare var d3: any;

@Component({
  selector: 'app-scatter-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col h-full p-4 bg-gray-800/50 rounded-xl border border-gray-700 shadow-xl transition-all hover:bg-gray-800/80 hover:border-gray-600">
       <div class="flex items-center justify-between mb-4 pb-2 border-b border-gray-700/50">
        <h3 class="text-sm font-bold uppercase tracking-wider text-gray-300">Risk vs Reward (Vol vs CAGR)</h3>
        <div class="flex gap-4 text-[10px] text-gray-400">
             <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span> BRK</span>
             <span class="flex items-center gap-1"><span class="w-2 h-2 rotate-45 bg-rose-500"></span> {{ labelNdx() }}</span>
             <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full border border-yellow-500"></span> Strategy</span>
        </div>
      </div>
      <div class="relative flex-1 min-h-[300px]">
        <div #chartContainer class="absolute inset-0"></div>
        <div #tooltip class="hidden absolute bg-gray-900 border border-gray-600 text-white text-xs p-2 rounded shadow-xl pointer-events-none z-10 whitespace-nowrap"></div>
        
        <!-- Selection Hint -->
        <div class="absolute bottom-2 right-2 text-[10px] text-gray-500 pointer-events-none">
           Click a point to view details below
        </div>
      </div>
    </div>
  `
})
export class ScatterChartComponent implements AfterViewInit, OnDestroy {
  data = input.required<SweepPoint[]>();
  frequency = input.required<string>();
  benchmarks = input<{ brk: BacktestMetrics; ndx: BacktestMetrics } | undefined>();
  labelNdx = input<string>('NDX');
  selectedPoint = input<SweepPoint | null>(null);
  
  pointSelected = output<SweepPoint>();
  
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  @ViewChild('tooltip') tooltip!: ElementRef;

  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const d = this.data();
      const f = this.frequency();
      const s = this.selectedPoint(); // Trigger redraw on selection change
      if (this.chartContainer && d.length > 0) {
        this.drawChart();
      }
    });
  }

  ngAfterViewInit() {
    if (this.chartContainer) {
       this.resizeObserver = new ResizeObserver(() => {
          this.drawChart();
       });
       this.resizeObserver.observe(this.chartContainer.nativeElement);
    }
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private drawChart() {
    if (!this.chartContainer) return;
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll("*").remove();

    const dataset = this.data().filter(d => d.freq === this.frequency());
    if (dataset.length === 0) return;
    
    const w = element.clientWidth;
    const h = element.clientHeight;
    if (w === 0 || h === 0) return;

    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width = w - margin.left - margin.right;
    const height = h - margin.top - margin.bottom;

    const svg = d3.select(element).append("svg")
      .attr("width", w)
      .attr("height", h)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const bm = this.benchmarks();
    let xMax = d3.max(dataset, (d:any) => d.metrics.volatility);
    let yMax = d3.max(dataset, (d:any) => d.metrics.cagr);
    let yMin = d3.min(dataset, (d:any) => d.metrics.cagr);

    if (bm) {
        xMax = Math.max(xMax, bm.brk.volatility, bm.ndx.volatility);
        yMax = Math.max(yMax, bm.brk.cagr, bm.ndx.cagr);
        yMin = Math.min(yMin, bm.brk.cagr, bm.ndx.cagr);
    }

    // X: Volatility
    const x = d3.scaleLinear()
      .domain([0, xMax * 1.1])
      .range([0, width]);

    // Y: CAGR
    const y = d3.scaleLinear()
      .domain([yMin - 0.05, yMax * 1.1])
      .range([height, 0]);

    // Color: Sharpe
    const extentSharpe = d3.extent(dataset, (d: any) => d.metrics.sharpeRatio);
    const myColor = d3.scaleLinear()
      .range(["#ef4444", "#fbbf24", "#10b981"]) // Red -> Yellow -> Green
      .domain([extentSharpe[0], (extentSharpe[0]+extentSharpe[1])/2, extentSharpe[1]]);

    const tooltipDiv = d3.select(this.tooltip.nativeElement);

    // Selected Point Data
    const currentSelected = this.selectedPoint();

    // 1. Draw Strategy Dots
    svg.selectAll("circle.strategy")
      .data(dataset)
      .enter()
      .append("circle")
      .attr("class", "strategy")
      .attr("cx", (d: any) => x(d.metrics.volatility))
      .attr("cy", (d: any) => y(d.metrics.cagr))
      .attr("r", (d: any) => (currentSelected && d === currentSelected) ? 8 : 5)
      .style("fill", (d: any) => myColor(d.metrics.sharpeRatio))
      .style("stroke", (d: any) => (currentSelected && d === currentSelected) ? "#ffffff" : "#1f2937")
      .style("stroke-width", (d: any) => (currentSelected && d === currentSelected) ? 3 : 1)
      .style("opacity", (d: any) => (currentSelected && d !== currentSelected) ? 0.4 : 0.8)
      .style("cursor", "pointer")
      .on("mouseover", (event: any, d: any) => {
        d3.select(event.currentTarget).attr("r", 8).style("stroke", "white").style("opacity", 1);
        
        tooltipDiv.style("display", "block").html(`
          <div class="font-bold border-b border-gray-600 mb-1 pb-1">Strategy</div>
          Lookback: <span class="text-white font-mono">${d.lookback}m</span><br/>
          Smoothing: <span class="text-white font-mono">${d.smoothing}d</span><br/>
          <div class="mt-2 pt-1 border-t border-gray-700 grid grid-cols-2 gap-x-2">
             <span class="text-gray-400">CAGR:</span> <span class="text-right text-emerald-400">${(d.metrics.cagr*100).toFixed(1)}%</span>
             <span class="text-gray-400">Vol:</span> <span class="text-right text-rose-400">${(d.metrics.volatility*100).toFixed(1)}%</span>
             <span class="text-gray-400">Sharpe:</span> <span class="text-right text-yellow-400">${d.metrics.sharpeRatio.toFixed(2)}</span>
             <span class="text-gray-400">MaxDD:</span> <span class="text-right text-rose-400">${(d.metrics.maxDrawdown*100).toFixed(1)}%</span>
          </div>
        `);
      })
      .on("mousemove", (event: any) => {
        const box = element.getBoundingClientRect();
        tooltipDiv.style("left", (event.clientX - box.left + 15) + "px").style("top", (event.clientY - box.top - 15) + "px");
      })
      .on("mouseleave", (event: any, d: any) => {
        // Reset styles unless it is the selected one
        const isSelected = currentSelected && d === currentSelected;
        d3.select(event.currentTarget)
            .attr("r", isSelected ? 8 : 5)
            .style("stroke", isSelected ? "#ffffff" : "#1f2937")
            .style("opacity", (currentSelected && !isSelected) ? 0.4 : 0.8);
        
        tooltipDiv.style("display", "none");
      })
      .on("click", (event: any, d: any) => {
          this.pointSelected.emit(d);
      });

    // 2. Draw Benchmarks if available
    if (bm) {
        const benchmarks = [
            { name: "BRK-A (Hold)", data: bm.brk, color: "#3b82f6", shape: "rect" },
            { name: `${this.labelNdx()} (Hold)`, data: bm.ndx, color: "#f43f5e", shape: "diamond" }
        ];

        benchmarks.forEach(b => {
             const g = svg.append("g")
                .attr("transform", `translate(${x(b.data.volatility)}, ${y(b.data.cagr)})`)
                .style("cursor", "help");
             
             if (b.shape === "rect") {
                 g.append("rect")
                   .attr("x", -6).attr("y", -6).attr("width", 12).attr("height", 12)
                   .style("fill", b.color).style("stroke", "white").style("stroke-width", 2);
             } else {
                 g.append("path")
                   .attr("d", d3.symbol().type(d3.symbolDiamond).size(150))
                   .style("fill", b.color).style("stroke", "white").style("stroke-width", 2);
             }

             // Tooltip interaction for benchmarks
             g.on("mouseover", (event: any) => {
                tooltipDiv.style("display", "block").html(`
                  <div class="font-bold border-b border-gray-600 mb-1 pb-1 text-white">${b.name}</div>
                  <div class="grid grid-cols-2 gap-x-2">
                     <span class="text-gray-400">CAGR:</span> <span class="text-right text-emerald-400">${(b.data.cagr*100).toFixed(1)}%</span>
                     <span class="text-gray-400">Vol:</span> <span class="text-right text-rose-400">${(b.data.volatility*100).toFixed(1)}%</span>
                     <span class="text-gray-400">Sharpe:</span> <span class="text-right text-yellow-400">${b.data.sharpeRatio.toFixed(2)}</span>
                     <span class="text-gray-400">MaxDD:</span> <span class="text-right text-rose-400">${(b.data.maxDrawdown*100).toFixed(1)}%</span>
                  </div>
                `);
             })
             .on("mousemove", (event: any) => {
                const box = element.getBoundingClientRect();
                tooltipDiv.style("left", (event.clientX - box.left + 15) + "px").style("top", (event.clientY - box.top - 15) + "px");
             })
             .on("mouseleave", () => {
                tooltipDiv.style("display", "none");
             });
        });
    }

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5, ".0%"))
      .style("color", "#9ca3af");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(5, ".0%"))
      .style("color", "#9ca3af");

    // Labels
    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .text("Annualized Volatility (Risk)")
      .attr("fill", "#6b7280")
      .attr("font-size", "11px")
      .style("text-transform", "uppercase");

    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .attr("y", -45)
      .attr("x", -height / 2)
      .text("CAGR (Reward)")
      .attr("fill", "#6b7280")
      .attr("font-size", "11px")
      .style("text-transform", "uppercase");
  }
}
