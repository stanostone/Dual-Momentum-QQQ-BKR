import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BacktestService, BacktestResult, SweepResult } from './services/gemini.service';
import { MetricCardComponent } from './components/metric-card.component';
import { EquityChartComponent } from './components/equity-chart.component';
import { DrawdownChartComponent } from './components/drawdown-chart.component';
import { HeatmapChartComponent } from './components/heatmap-chart.component';
import { ScatterChartComponent } from './components/scatter-chart.component';
import { RankingTableComponent } from './components/ranking-table.component';
import { ConfigFormComponent, SimulationConfig, SweepConfig, UploadedData } from './components/config-form.component';

type ViewState = 'config' | 'loading' | 'results' | 'sweep-results';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    MetricCardComponent, 
    EquityChartComponent, 
    DrawdownChartComponent, 
    HeatmapChartComponent, 
    ScatterChartComponent,
    RankingTableComponent,
    ConfigFormComponent
  ],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private backtestService = inject(BacktestService);
  
  viewState = signal<ViewState>('config');
  
  singleResult = signal<BacktestResult | null>(null);
  sweepResult = signal<SweepResult | null>(null);
  
  // Controls for Sweep View
  selectedSweepFreq = signal<string>('');
  availableSweepFreqs = computed(() => {
    const res = this.sweepResult();
    if (!res) return [];
    return Array.from(new Set(res.points.map(p => p.freq)));
  });
  
  error = signal<string | null>(null);

  async runSingle(payload: { config: SimulationConfig, data: UploadedData }) {
    this.startLoading();
    setTimeout(() => {
      try {
        const result = this.backtestService.runBacktest(payload.config, payload.data);
        this.singleResult.set(result);
        this.viewState.set('results');
      } catch (err: any) { this.handleError(err); }
    }, 200);
  }

  async runSweep(payload: { config: SweepConfig, data: UploadedData }) {
    this.startLoading();
    setTimeout(() => {
      try {
        const result = this.backtestService.runSweep(payload.config, payload.data);
        this.sweepResult.set(result);
        
        // Auto-select first available frequency
        const freqs = Array.from(new Set(result.points.map(p => p.freq)));
        if (freqs.length > 0) this.selectedSweepFreq.set(freqs[0]);

        this.viewState.set('sweep-results');
      } catch (err: any) { this.handleError(err); }
    }, 200);
  }

  setSweepFreq(e: any) {
    this.selectedSweepFreq.set(e.target.value);
  }

  private startLoading() {
    this.viewState.set('loading');
    this.error.set(null);
    this.singleResult.set(null);
    this.sweepResult.set(null);
  }

  private handleError(err: any) {
    console.error('Backtest Fatal Error:', err);
    this.error.set("Failed to execute: " + (err.message || "Unknown error. Check your CSV format."));
    this.viewState.set('config');
  }

  reset() {
    this.viewState.set('config');
    this.singleResult.set(null);
    this.sweepResult.set(null);
  }
}
