import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BacktestService, BacktestResult, SweepResult, SweepPoint } from './services/gemini.service';
import { MetricCardComponent } from './components/metric-card.component';
import { EquityChartComponent } from './components/equity-chart.component';
import { DrawdownChartComponent } from './components/drawdown-chart.component';
import { HeatmapChartComponent } from './components/heatmap-chart.component';
import { ScatterChartComponent } from './components/scatter-chart.component';
import { RankingTableComponent } from './components/ranking-table.component';
import { ConfigFormComponent, SimulationConfig, SweepConfig, UploadedData } from './components/config-form.component';
import { DataVizComponent } from './components/data-viz.component';

type ViewState = 'config' | 'loading' | 'results' | 'sweep-results' | 'data-viz';

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
    ConfigFormComponent,
    DataVizComponent
  ],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private backtestService = inject(BacktestService);
  
  viewState = signal<ViewState>('config');
  
  // Data Storage for re-runs
  currentUploadedData = signal<UploadedData | null>(null);

  singleResult = signal<BacktestResult | null>(null);
  sweepResult = signal<SweepResult | null>(null);
  
  // Drill down selection
  selectedSweepPoint = signal<SweepPoint | null>(null);
  selectedSweepBacktest = signal<BacktestResult | null>(null);

  vizData = signal<any[]>([]);
  
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
    this.currentUploadedData.set(payload.data);
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
    this.currentUploadedData.set(payload.data);
    setTimeout(() => {
      try {
        const result = this.backtestService.runSweep(payload.config, payload.data);
        this.sweepResult.set(result);
        this.selectedSweepPoint.set(null);
        this.selectedSweepBacktest.set(null);
        
        // Auto-select first available frequency
        const freqs = Array.from(new Set(result.points.map(p => p.freq)));
        if (freqs.length > 0) this.selectedSweepFreq.set(freqs[0]);

        this.viewState.set('sweep-results');
      } catch (err: any) { this.handleError(err); }
    }, 200);
  }

  // Drill Down Logic
  onSweepPointSelected(point: SweepPoint) {
      this.selectedSweepPoint.set(point);
      
      const sweepConfig = this.sweepResult()?.config;
      const data = this.currentUploadedData();

      if (!sweepConfig || !data) {
          console.error("Missing config or data for drill down");
          return;
      }

      // Re-run the strategy for the selected point parameters to get full history
      const simConfig: SimulationConfig = {
          mode: 'SINGLE',
          lookbackPeriod: point.lookback,
          smoothingWindow: point.smoothing,
          rebalanceFreq: point.freq,
          transactionCost: sweepConfig.transactionCost,
          initialCapital: sweepConfig.initialCapital,
          useLeverage: sweepConfig.useLeverage,
          startDate: sweepConfig.startDate,
          endDate: sweepConfig.endDate
      };

      try {
        const result = this.backtestService.runBacktest(simConfig, data);
        this.selectedSweepBacktest.set(result);
        
        // Optional: scroll to details view? 
        // We will do this via UI placement, maybe user scrolls manually
      } catch (err) {
        console.error("Error re-running sweep point simulation", err);
      }
  }

  async viewInputData(data: UploadedData) {
      this.startLoading();
      setTimeout(() => {
          try {
              const processed = this.backtestService.getVisualizableData(data);
              this.vizData.set(processed);
              this.viewState.set('data-viz');
          } catch(err: any) { this.handleError(err); }
      }, 100);
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
    this.selectedSweepPoint.set(null);
    this.selectedSweepBacktest.set(null);
    this.vizData.set([]);
  }
}
