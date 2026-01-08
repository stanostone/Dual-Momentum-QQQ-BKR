import { Component, ElementRef, input, effect, ViewChild, ChangeDetectionStrategy, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

declare var d3: any;

@Component({
  selector: 'app-data-viz',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full bg-gray-900 rounded-xl overflow-hidden">
       <!-- Controls -->
       <div class="p-4 bg-gray-800/50 border-b border-gray-700 flex flex-wrap gap-4 items-center justify-between">
         <h2 class="text-xl font-bold text-white flex items-center gap-2">
            Data Visualization 
            <span class="text-xs font-normal text-gray-400 bg-gray-700 px-2 py-0.5 rounded">Log Scale</span>
         </h2>
         
         <div class="flex items-center gap-4 text-sm">
             <div class="flex items-center gap-2">
                 <input type="checkbox" checked disabled class="accent-blue-500 w-4 h-4 rounded">
                 <span class="text-blue-400 font-bold">BRK-A</span>
             </div>
             <div class="flex items-center gap-2">
                 <input type="checkbox" checked disabled class="accent-emerald-500 w-4 h-4 rounded">
                 <span class="text-emerald-400 font-bold">NDX</span>
             </div>
             <div class="flex items-center gap-2">
                 <input type="checkbox" checked disabled class="accent-purple-500 w-4 h-4 rounded">
                 <span class="text-purple-400 font-bold">TQQQ (Hybrid)</span>
             </div>
         </div>
       </div>

       <!-- Chart Area -->
       <div class="flex-1 relative p-4 min-h-[500px]">
          <div #chartContainer class="w-full h-full"></div>
          
          <!-- Legend/Info Overlay -->
          <div class="absolute top-6 left-20 bg-gray-900/80 p-3 rounded border border-gray-700 backdrop-blur-sm text-xs text-gray-300 max-w-sm pointer-events-none">
              <p class="font-bold text-purple-400 mb-1">Hybrid Construction:</p>
              <ul class="list-disc pl-4 space-y-1">
                  <li><strong class="text-white">Dashed Line:</strong> Synthetic 3x leverage derived from NDX returns.</li>
                  <li><strong class="text-white">Solid Line:</strong> Real TQQQ data (where available).</li>
                  <li>This stitched curve is used for the "3x Leverage" backtest mode.</li>
              </ul>
          </div>
       </div>
    </div>
  `
})
export class DataVizComponent implements AfterViewInit, OnDestroy {
  data = input.required<any[]>();
  
  @ViewChild('chartContainer') chartContainer!: ElementRef;

  constructor() {
    effect(() => {
      const d = this.data();
      if (this.chartContainer && d.length > 0) {
        this.drawChart(d);
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => {
        if (this.data().length > 0) this.drawChart(this.data());
    }, 100);
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    if (this.data().length > 0) this.drawChart(this.data());
  }

  private drawChart(data: any[]) {
    if (!this.chartContainer) return;
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll("*").remove();

    if (element.clientWidth === 0) return;

    const margin = { top: 20, right: 50, bottom: 50, left: 60 };
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

    // X Scale
    const x = d3.scaleTime()
      .domain(d3.extent(processedData, (d: any) => d.parsedDate))
      .range([0, width]);

    // Y Scale (Log)
    const allVals = processedData.flatMap((d: any) => [d.brk, d.ndx, d.hybrid_tqqq]);
    const minVal = d3.min(allVals.filter((v: number) => v > 0)) || 1;
    const maxVal = d3.max(allVals) || 10000;

    const y = d3.scaleLog()
      .domain([minVal * 0.9, maxVal * 1.1])
      .range([height, 0]);

    // Gridlines
    const make_x_gridlines = () => d3.axisBottom(x).ticks(8);
    const make_y_gridlines = () => d3.axisLeft(y).ticks(5);

    svg.append("g")
      .attr("class", "grid opacity-10")
      .attr("transform", `translate(0,${height})`)
      .call(make_x_gridlines().tickSize(-height).tickFormat(() => ""))
      .style("stroke", "white");

    svg.append("g")
      .attr("class", "grid opacity-10")
      .call(make_y_gridlines().tickSize(-width).tickFormat(() => "").ticks(5))
      .style("stroke", "white");

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(8))
      .style("color", "#9ca3af");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(5, ".1s"))
      .style("color", "#9ca3af");

    // Line Generators
    const lineBRK = d3.line()
        .x((d: any) => x(d.parsedDate))
        .y((d: any) => y(d.brk));
    
    const lineNDX = d3.line()
        .x((d: any) => x(d.parsedDate))
        .y((d: any) => y(d.ndx));

    const lineHybrid = d3.line()
        .x((d: any) => x(d.parsedDate))
        .y((d: any) => y(d.hybrid_tqqq));

    // Draw Lines
    // BRK
    svg.append("path")
       .datum(processedData)
       .attr("fill", "none")
       .attr("stroke", "#3b82f6")
       .attr("stroke-width", 1.5)
       .attr("d", lineBRK);

    // NDX
    svg.append("path")
       .datum(processedData)
       .attr("fill", "none")
       .attr("stroke", "#10b981")
       .attr("stroke-width", 1.5)
       .attr("d", lineNDX);

    // Hybrid TQQQ - Split into two segments if we want to show real vs synthetic distinct visually?
    // Actually, drawing the whole line as one path is smoother, then we overlay the 'Real' part differently?
    // Let's just draw the hybrid line. We can use dash-array for synthetic periods maybe?
    // It's complex to segment a single D3 path by property. 
    // Simpler approach: Draw full line as 'Synthetic' style (Purple Dashed), then overlay 'Real' segments.
    
    // 1. Full Hybrid Path (Dashed/Base)
    svg.append("path")
       .datum(processedData)
       .attr("fill", "none")
       .attr("stroke", "#a855f7") // Purple-500
       .attr("stroke-width", 2)
       .attr("stroke-dasharray", "4,4") // Dashed to indicate constructed/synthetic nature
       .attr("opacity", 0.6)
       .attr("d", lineHybrid);

    // 2. Real TQQQ Segments Overlay
    // We filter data where is_real_tqqq is true and connect points
    // Note: D3 line requires contiguous points. We might have a gap if data is spotty, but usually it's contiguous from start date.
    // Let's find the start index of real data
    const realDataStartIndex = processedData.findIndex((d: any) => d.is_real_tqqq);
    
    if (realDataStartIndex !== -1) {
        const realData = processedData.slice(realDataStartIndex);
        svg.append("path")
           .datum(realData)
           .attr("fill", "none")
           .attr("stroke", "#a855f7") // Purple-500
           .attr("stroke-width", 2) // Solid
           .attr("d", lineHybrid);
        
        // Add a marker for "Real Data Start"
        const startPoint = processedData[realDataStartIndex];
        svg.append("circle")
           .attr("cx", x(startPoint.parsedDate))
           .attr("cy", y(startPoint.hybrid_tqqq))
           .attr("r", 4)
           .attr("fill", "#a855f7");

        svg.append("text")
           .attr("x", x(startPoint.parsedDate) + 10)
           .attr("y", y(startPoint.hybrid_tqqq))
           .text("Real TQQQ Starts")
           .attr("fill", "#d8b4fe")
           .attr("font-size", "10px")
           .attr("alignment-baseline", "middle");
    }

    // Tooltip Interaction
    const focus = svg.append("g").style("display", "none");
    focus.append("line")
         .attr("y1", 0)
         .attr("y2", height)
         .style("stroke", "gray")
         .style("stroke-dasharray", "3,3")
         .style("opacity", 0.5);

    const tooltip = d3.select(element)
      .append("div")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(17, 24, 39, 0.9)")
      .style("border", "1px solid #4b5563")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("color", "white")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "10");

    svg.append("rect")
       .attr("width", width)
       .attr("height", height)
       .style("fill", "transparent")
       .on("mouseover", () => { focus.style("display", null); tooltip.style("visibility", "visible"); })
       .on("mouseout", () => { focus.style("display", "none"); tooltip.style("visibility", "hidden"); })
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
               
               const box = element.getBoundingClientRect();
               let left = event.pageX - box.left + 15;
               if (left > width - 150) left = event.pageX - box.left - 160;

               const isReal = d.is_real_tqqq ? '<span class="text-xs text-purple-300 ml-1">(Real)</span>' : '<span class="text-xs text-gray-500 ml-1">(Synth)</span>';

               tooltip.html(`
                  <div class="font-bold border-b border-gray-600 mb-1 pb-1">${d3.timeFormat("%Y-%m-%d")(d.parsedDate)}</div>
                  <div class="grid grid-cols-2 gap-x-3 gap-y-1">
                      <span class="text-blue-400">BRK-A:</span> <span class="text-right font-mono">${d3.format(",.2f")(d.brk)}</span>
                      <span class="text-emerald-400">NDX:</span> <span class="text-right font-mono">${d3.format(",.2f")(d.ndx)}</span>
                      <span class="text-purple-400">TQQQ:</span> <span class="text-right font-mono">${d3.format(",.2f")(d.hybrid_tqqq)}</span>
                  </div>
                  <div class="mt-1 text-center">${isReal}</div>
               `)
               .style("left", `${left}px`)
               .style("top", `${Math.min(ym, height - 80)}px`);
           }
       });
  }
}
