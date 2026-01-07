import { Component, ElementRef, input, effect, ViewChild, ChangeDetectionStrategy, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

declare var d3: any;

@Component({
  selector: 'app-equity-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full h-full p-4 bg-gray-800/50 rounded-xl border border-gray-700 shadow-xl">
      <div #chartContainer class="w-full h-[450px]"></div>
      
      <!-- Legend -->
      <div class="flex flex-wrap items-center justify-center gap-6 mt-4 text-sm font-medium border-t border-gray-700 pt-4">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-[#10b981]"></span>
          <span class="text-emerald-400">Strategy</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-[#3b82f6]"></span>
          <span class="text-blue-400">BRK-A</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-[#f43f5e]"></span>
          <span class="text-rose-400">NDX</span>
        </div>
        <div class="w-px h-4 bg-gray-600 hidden md:block"></div>
        <div class="flex items-center gap-2">
           <span class="text-gray-400 text-xs uppercase">Holdings:</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 bg-[#3b82f6]/30 border border-[#3b82f6]"></span>
          <span class="text-blue-300 text-xs">BRK</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 bg-[#f43f5e]/30 border border-[#f43f5e]"></span>
          <span class="text-rose-300 text-xs">NDX</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 bg-gray-500/30 border border-gray-500"></span>
          <span class="text-gray-300 text-xs">CASH</span>
        </div>
      </div>
    </div>
  `
})
export class EquityChartComponent implements AfterViewInit, OnDestroy {
  data = input.required<any[]>();
  
  @ViewChild('chartContainer') chartContainer!: ElementRef;

  constructor() {
    effect(() => {
      const data = this.data();
      if (this.chartContainer && data && data.length > 0) {
        this.drawChart(data);
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.data().length > 0) {
        this.drawChart(this.data());
      }
    }, 0);
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    if (this.data().length > 0) {
      this.drawChart(this.data());
    }
  }

  private drawChart(data: any[]) {
    if (!this.chartContainer) return;
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll("*").remove();
    
    if (element.clientWidth === 0) return;

    // Margins - increased bottom for the regime strip
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    const svg = d3.select(element)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const parseDate = d3.timeParse("%Y-%m-%d");
    const processedData = data.map((d: any) => ({
      ...d,
      parsedDate: parseDate(d.date)
    }));

    if (processedData.some((d: any) => !d.parsedDate)) return;

    // X Scale
    const x = d3.scaleTime()
      .domain(d3.extent(processedData, (d: any) => d.parsedDate))
      .range([0, width]);

    // Y Scale (Log)
    const allValues = processedData.flatMap((d: any) => [d.strategy, d.brk, d.ndx]);
    const minVal = Math.max(0.1, d3.min(allValues) || 1);
    const maxVal = d3.max(allValues) || 10000;
    const y = d3.scaleLog()
      .domain([minVal * 0.9, maxVal * 1.1])
      .range([height, 0]);

    // --- Draw Regime Strip (The "Holding" Bar) ---
    // We define a small strip below the x-axis
    const stripHeight = 12;
    const stripY = height + 25; // positioned below x-axis labels

    // Color mapping
    const getAssetColor = (asset: string) => {
      const a = asset?.toUpperCase() || '';
      if (a.includes('BRK')) return '#3b82f6'; // Blue
      if (a.includes('NDX')) return '#f43f5e'; // Rose
      return '#6b7280'; // Gray (Cash)
    };

    // Draw rectangles for each period
    svg.selectAll(".regime-rect")
      .data(processedData.slice(0, -1)) // Stop one before end to calculate width
      .enter()
      .append("rect")
      .attr("x", (d: any) => x(d.parsedDate))
      .attr("y", stripY)
      .attr("width", (d: any, i: number) => {
        const nextDate = processedData[i+1].parsedDate;
        return Math.max(0, x(nextDate) - x(d.parsedDate)); // Width to next point
      })
      .attr("height", stripHeight)
      .attr("fill", (d: any) => getAssetColor(d.heldAsset))
      .attr("opacity", 0.5)
      .attr("stroke", "none");

    // Add label for the strip
    svg.append("text")
      .attr("x", -10)
      .attr("y", stripY + 10)
      .attr("text-anchor", "end")
      .attr("fill", "#9ca3af")
      .attr("font-size", "10px")
      .text("HELD");

    // --- Gridlines & Axes ---
    // Safely calculate ticks based on width, ensuring at least 3 ticks
    const tickCount = Math.max(3, Math.floor(width / 80)); 
    
    const make_x_gridlines = () => d3.axisBottom(x).ticks(tickCount);
    const make_y_gridlines = () => d3.axisLeft(y).ticks(5);

    svg.append("g")
      .attr("class", "grid opacity-10")
      .attr("transform", `translate(0,${height})`)
      .call(make_x_gridlines().tickSize(-height).tickFormat(() => ""))
      .style("stroke", "#ffffff");

    svg.append("g")
      .attr("class", "grid opacity-10")
      .call(make_y_gridlines().tickSize(-width).tickFormat(() => "").ticks(5))
      .style("stroke", "#ffffff");

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(tickCount))
      .style("color", "#9ca3af")
      .style("font-size", "12px");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(5, ".1s"))
      .style("color", "#9ca3af")
      .style("font-size", "12px");

    // --- Lines ---
    const createLine = (key: string) => d3.line()
      .x((d: any) => x(d.parsedDate))
      .y((d: any) => y(Math.max(0.1, d[key]))) // Protect against <=0 in log scale
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(processedData)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("d", createLine('brk'))
      .attr("opacity", 0.6);

    svg.append("path")
      .datum(processedData)
      .attr("fill", "none")
      .attr("stroke", "#f43f5e")
      .attr("stroke-width", 2)
      .attr("d", createLine('ndx'))
      .attr("opacity", 0.6);

    svg.append("path")
      .datum(processedData)
      .attr("fill", "none")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 3)
      .attr("d", createLine('strategy'));

    // --- Tooltip Interaction ---
    const focus = svg.append("g").style("display", "none");

    focus.append("line")
      .attr("y1", 0)
      .attr("y2", height + 40) // Extend down to regime strip
      .style("stroke", "white")
      .style("stroke-dasharray", "3,3")
      .style("opacity", 0.5);

    // Tooltip Info Box
    const tooltip = d3.select(element)
      .append("div")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(17, 24, 39, 0.95)")
      .style("border", "1px solid #374151")
      .style("padding", "8px")
      .style("border-radius", "6px")
      .style("color", "white")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "10")
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.5)");

    svg.append("rect")
      .attr("width", width)
      .attr("height", height + 40)
      .style("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mouseover", () => {
        focus.style("display", null);
        tooltip.style("visibility", "visible");
      })
      .on("mouseout", () => {
        focus.style("display", "none");
        tooltip.style("visibility", "hidden");
      })
      .on("mousemove", (event: any) => {
         const [xm, ym] = d3.pointer(event);
         const x0 = x.invert(xm);
         const bisect = d3.bisector((d: any) => d.parsedDate).left;
         const i = bisect(processedData, x0, 1);
         const d0 = processedData[i - 1];
         const d1 = processedData[i];
         const d = (d1 && d0) ? (x0.getTime() - d0.parsedDate.getTime() > d1.parsedDate.getTime() - x0.getTime() ? d1 : d0) : d0;
         
         if(d) {
            focus.attr("transform", `translate(${x(d.parsedDate)},0)`);
            
            // Position tooltip smart
            const boxRect = element.getBoundingClientRect();
            let left = event.pageX - boxRect.left + 15;
            // Flip if too close to right edge
            if (left > width - 180) left = event.pageX - boxRect.left - 190;

            tooltip
              .html(`
                <div class="font-bold border-b border-gray-600 mb-1 pb-1">${d3.timeFormat("%b %Y")(d.parsedDate)}</div>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span class="text-emerald-400">Strategy:</span> <span class="text-right font-mono">$${d3.format(".2s")(d.strategy)}</span>
                  <span class="text-blue-400">BRK-A:</span> <span class="text-right font-mono">$${d3.format(".2s")(d.brk)}</span>
                  <span class="text-rose-400">NDX:</span> <span class="text-right font-mono">$${d3.format(".2s")(d.ndx)}</span>
                  <span class="text-gray-400 mt-1 pt-1 border-t border-gray-700">Held:</span> <span class="text-right font-bold mt-1 pt-1 border-t border-gray-700 ${
                    d.heldAsset?.includes('BRK') ? 'text-blue-400' : d.heldAsset?.includes('NDX') ? 'text-rose-400' : 'text-gray-400'
                  }">${d.heldAsset || 'N/A'}</span>
                </div>
              `)
              .style("left", `${left}px`)
              .style("top", `${Math.min(ym, height - 80)}px`);
         }
      });
  }
}
