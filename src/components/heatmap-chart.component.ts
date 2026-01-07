import { Component, ElementRef, input, effect, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SweepPoint } from '../services/gemini.service';

declare var d3: any;

@Component({
  selector: 'app-heatmap-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col h-full p-4 bg-gray-800/50 rounded-xl border border-gray-700 shadow-xl transition-all hover:bg-gray-800/80 hover:border-gray-600">
      <div class="flex items-center justify-between mb-4 pb-2 border-b border-gray-700/50">
        <h3 class="text-sm font-bold uppercase tracking-wider text-gray-300">{{ title() }}</h3>
      </div>
      <div class="relative flex-1 min-h-[300px]">
        <div #chartContainer class="absolute inset-0"></div>
        <div #tooltip class="hidden absolute bg-gray-900 border border-gray-600 text-white text-xs p-2 rounded shadow-xl pointer-events-none z-10 whitespace-nowrap"></div>
      </div>
    </div>
  `
})
export class HeatmapChartComponent implements AfterViewInit, OnDestroy {
  data = input.required<SweepPoint[]>();
  metric = input.required<'sharpeRatio' | 'cagr' | 'maxDrawdown' | 'volatility' | 'tradeCount'>();
  frequency = input.required<string>();
  title = input.required<string>();

  @ViewChild('chartContainer') chartContainer!: ElementRef;
  @ViewChild('tooltip') tooltip!: ElementRef;

  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      // Trigger redraw when any signal changes
      const d = this.data();
      const m = this.metric();
      const f = this.frequency();
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

    // Filter Data by Frequency input
    const dataset = this.data().filter(d => d.freq === this.frequency());
    if (dataset.length === 0) return;
    
    // Check dimensions
    const w = element.clientWidth;
    const h = element.clientHeight;
    if (w === 0 || h === 0) return;

    // Dimensions
    const margin = { top: 10, right: 10, bottom: 40, left: 40 };
    const width = w - margin.left - margin.right;
    const height = h - margin.top - margin.bottom;

    const svg = d3.select(element).append("svg")
      .attr("width", w)
      .attr("height", h)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Axis: Lookback
    const xDomain = Array.from(new Set(dataset.map(d => d.lookback))).sort((a,b) => a-b);
    const x = d3.scaleBand()
      .range([0, width])
      .domain(xDomain.map(String))
      .padding(0.05);

    // Y Axis: Smoothing
    const yDomain = Array.from(new Set(dataset.map(d => d.smoothing))).sort((a,b) => a-b);
    const y = d3.scaleBand()
      .range([height, 0])
      .domain(yDomain.map(String))
      .padding(0.05);

    // Color Scale
    const metricKey = this.metric();
    const extent = d3.extent(dataset, (d: any) => d.metrics[metricKey]);
    
    let minVal = extent[0] || 0;
    let maxVal = extent[1] || 0;
    if (minVal === maxVal) { maxVal += 0.01; }

    // Color Logic
    let colorRange = ["#ef4444", "#fbbf24", "#10b981"]; // Default Red -> Yellow -> Green

    if (metricKey === 'maxDrawdown' || metricKey === 'volatility') {
        // Inverse: Green -> Yellow -> Red
        colorRange = ["#10b981", "#fbbf24", "#ef4444"];
    } else if (metricKey === 'tradeCount') {
        // Blue Scale for count: Light -> Dark
        colorRange = ["#dbeafe", "#3b82f6", "#1e3a8a"]; 
    }

    const myColor = d3.scaleLinear()
      .range(colorRange)
      .domain([minVal, (minVal+maxVal)/2, maxVal]);

    // Tooltip
    const tooltipDiv = d3.select(this.tooltip.nativeElement);

    // Draw Squares
    svg.selectAll()
      .data(dataset)
      .enter()
      .append("rect")
      .attr("x", (d: any) => x(String(d.lookback)))
      .attr("y", (d: any) => y(String(d.smoothing)))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .style("fill", (d: any) => myColor(d.metrics[metricKey]))
      .style("rx", 3)
      .style("ry", 3)
      .style("cursor", "crosshair")
      .on("mouseover", (event: any, d: any) => {
        d3.select(event.currentTarget).style("stroke", "white").style("stroke-width", 2);
        
        let formatVal = "";
        if (metricKey === 'sharpeRatio') formatVal = d.metrics.sharpeRatio.toFixed(2);
        else if (metricKey === 'tradeCount') formatVal = d.metrics.tradeCount.toString();
        else formatVal = (d.metrics[metricKey] * 100).toFixed(1) + "%";

        tooltipDiv.style("display", "block").html(`
          <strong>Lookback:</strong> ${d.lookback} Mo<br/>
          <strong>Smooth:</strong> ${d.smoothing} Days<br/>
          <strong>Val:</strong> <span class="text-yellow-400 font-bold">${formatVal}</span><br/>
          <hr class="border-gray-600 my-1"/>
          <span class="text-[10px] text-gray-400">CAGR: ${(d.metrics.cagr*100).toFixed(1)}%</span><br/>
          <span class="text-[10px] text-gray-400">Trades: ${d.metrics.tradeCount}</span>
        `);
      })
      .on("mousemove", (event: any) => {
        const box = element.getBoundingClientRect();
        tooltipDiv
          .style("left", (event.clientX - box.left + 15) + "px")
          .style("top", (event.clientY - box.top - 15) + "px");
      })
      .on("mouseleave", (event: any) => {
        d3.select(event.currentTarget).style("stroke", "none");
        tooltipDiv.style("display", "none");
      });

    // Axes Labels
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .select(".domain").remove();

    svg.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .select(".domain").remove();
      
    // Text Labels
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 35)
        .text("Lookback (Months)")
        .attr("fill", "#6b7280")
        .attr("font-size", "10px")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -25)
        .attr("x", -height / 2)
        .text("Smoothing (Days)")
        .attr("fill", "#6b7280")
        .attr("font-size", "10px")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px");
  }
}
