import { Component, ElementRef, input, effect, ViewChild, ChangeDetectionStrategy, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

declare var d3: any;

@Component({
  selector: 'app-drawdown-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full h-full p-4 bg-gray-800/50 rounded-xl border border-gray-700 shadow-xl mt-6">
      <h3 class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Underwater Chart (Drawdown)</h3>
      <div #chartContainer class="w-full h-[200px]"></div>
    </div>
  `
})
export class DrawdownChartComponent implements AfterViewInit, OnDestroy {
  data = input.required<any[]>();
  @ViewChild('chartContainer') chartContainer!: ElementRef;

  constructor() {
    effect(() => {
      if (this.chartContainer && this.data().length > 0) {
        this.drawChart(this.data());
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.drawChart(this.data()), 0);
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

    const margin = { top: 10, right: 30, bottom: 20, left: 50 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    const svg = d3.select(element).append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const parseDate = d3.timeParse("%Y-%m-%d");
    const processedData = data.map((d: any) => ({
      ...d,
      parsedDate: parseDate(d.date)
    }));

    const x = d3.scaleTime()
      .domain(d3.extent(processedData, (d: any) => d.parsedDate))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([d3.min(processedData, (d: any) => d.drawdown) || -0.1, 0])
      .range([height, 0]);

    // Area
    const area = d3.area()
      .x((d: any) => x(d.parsedDate))
      .y0(0)
      .y1((d: any) => y(d.drawdown));

    // Gradient
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "dd-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#ef4444").attr("stop-opacity", 0.1);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#ef4444").attr("stop-opacity", 0.6);

    svg.append("path")
      .datum(processedData)
      .attr("fill", "url(#dd-gradient)")
      .attr("d", area);
      
    svg.append("path")
      .datum(processedData)
      .attr("fill", "none")
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 1)
      .attr("d", d3.line()
        .x((d: any) => x(d.parsedDate))
        .y((d: any) => y(d.drawdown))
      );

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5))
      .style("color", "#6b7280");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(4, ".0%"))
      .style("color", "#6b7280");
  }
}
