import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BacktestMetrics } from '../services/gemini.service';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-gray-800 rounded-xl p-6 border-l-4 shadow-lg transition-transform hover:scale-[1.02]"
         [class.border-emerald-500]="type() === 'Strategy'"
         [class.border-blue-500]="type() === 'BRK-A'"
         [class.border-rose-500]="type() === 'NDX'"
    >
      <h3 class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">{{ type() }}</h3>
      
      <div class="space-y-3">
        <div class="flex justify-between items-baseline">
          <span class="text-gray-400 text-sm">CAGR</span>
          <span class="text-2xl font-mono font-bold text-white">
            {{ metrics().cagr | percent:'1.1-2' }}
          </span>
        </div>
        
        <div class="flex justify-between items-baseline">
          <span class="text-gray-400 text-sm">Max DD</span>
          <!-- Use computed property for class -->
          <span class="font-mono font-bold" [class]="drawdownClass()">
            {{ metrics().maxDrawdown | percent:'1.1-2' }}
          </span>
        </div>
        
        <div class="flex justify-between items-baseline">
          <span class="text-gray-400 text-sm">Sharpe</span>
          <span class="font-mono font-bold" [class]="sharpeClass()">
            {{ metrics().sharpeRatio | number:'1.2-2' }}
          </span>
        </div>

        <div class="pt-2 mt-2 border-t border-gray-700">
           <span class="text-gray-500 text-xs">Final: </span>
           <span class="text-gray-300 font-mono text-sm">{{ metrics().finalBalance | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
      </div>
    </div>
  `
})
export class MetricCardComponent {
  type = input.required<string>();
  metrics = input.required<BacktestMetrics>();

  drawdownClass = computed(() => {
    const dd = this.metrics().maxDrawdown;
    if (dd > -0.15) return 'text-emerald-400';
    if (dd > -0.25) return 'text-yellow-400';
    return 'text-rose-400';
  });

  sharpeClass = computed(() => {
    const s = this.metrics().sharpeRatio;
    if (s > 1) return 'text-green-400';
    if (s > 0.5) return 'text-yellow-400';
    return 'text-gray-400';
  });
}
