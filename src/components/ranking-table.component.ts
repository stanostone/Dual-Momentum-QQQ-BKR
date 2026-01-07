import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SweepPoint } from '../services/gemini.service';

@Component({
  selector: 'app-ranking-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-gray-800/50 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
      <div class="p-4 border-b border-gray-700/50 flex justify-between items-center bg-gray-900/50">
        <h3 class="text-gray-300 font-bold uppercase tracking-wider text-sm">Top Strategies Ranking</h3>
        <div class="flex gap-2 text-xs">
           <span class="text-gray-500">Sort by:</span>
           <button (click)="setSort('sharpeRatio')" [class.text-yellow-400]="sortBy() === 'sharpeRatio'" class="hover:text-white font-medium transition-colors">Sharpe</button>
           <span class="text-gray-700">|</span>
           <button (click)="setSort('cagr')" [class.text-emerald-400]="sortBy() === 'cagr'" class="hover:text-white font-medium transition-colors">CAGR</button>
           <span class="text-gray-700">|</span>
           <button (click)="setSort('maxDrawdown')" [class.text-rose-400]="sortBy() === 'maxDrawdown'" class="hover:text-white font-medium transition-colors">Drawdown</button>
        </div>
      </div>
      
      <div class="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-gray-800 text-gray-400 font-medium sticky top-0 z-10">
            <tr>
              <th class="px-4 py-3">Rank</th>
              <th class="px-4 py-3">Freq</th>
              <th class="px-4 py-3 text-right">Lookback</th>
              <th class="px-4 py-3 text-right">Smooth</th>
              <th class="px-4 py-3 text-right cursor-pointer hover:text-white" (click)="setSort('cagr')">CAGR</th>
              <th class="px-4 py-3 text-right cursor-pointer hover:text-white" (click)="setSort('volatility')">Vol</th>
              <th class="px-4 py-3 text-right cursor-pointer hover:text-white" (click)="setSort('maxDrawdown')">MaxDD</th>
              <th class="px-4 py-3 text-right cursor-pointer hover:text-white" (click)="setSort('sharpeRatio')">Sharpe</th>
              <th class="px-4 py-3 text-right cursor-pointer hover:text-white" (click)="setSort('tradeCount')">Trades</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700/50">
            @for (row of sortedData(); track $index) {
              <tr class="hover:bg-gray-700/50 transition-colors group">
                <td class="px-4 py-2 text-gray-500 font-mono group-hover:text-white">#{{ $index + 1 }}</td>
                <td class="px-4 py-2 text-gray-300">{{ row.freq }}</td>
                <td class="px-4 py-2 text-right text-gray-400">{{ row.lookback }}m</td>
                <td class="px-4 py-2 text-right text-gray-400">{{ row.smoothing }}d</td>
                <td class="px-4 py-2 text-right font-mono" [class.text-emerald-400]="row.metrics.cagr > 0">{{ row.metrics.cagr | percent:'1.1-1' }}</td>
                <td class="px-4 py-2 text-right font-mono text-gray-400">{{ row.metrics.volatility | percent:'1.1-1' }}</td>
                <td class="px-4 py-2 text-right font-mono text-rose-400">{{ row.metrics.maxDrawdown | percent:'1.1-1' }}</td>
                <td class="px-4 py-2 text-right font-mono font-bold" [class.text-yellow-400]="row.metrics.sharpeRatio > 1">{{ row.metrics.sharpeRatio | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-right font-mono text-blue-300">{{ row.metrics.tradeCount }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class RankingTableComponent {
  data = input.required<SweepPoint[]>();
  sortBy = signal<'sharpeRatio' | 'cagr' | 'maxDrawdown' | 'volatility' | 'tradeCount'>('sharpeRatio');

  sortedData = computed(() => {
    const raw = [...this.data()];
    const key = this.sortBy();
    
    return raw.sort((a, b) => {
      if (key === 'maxDrawdown' || key === 'volatility') {
        // Lower is better (sort ascending)
        return a.metrics[key] - b.metrics[key];
      }
      // Higher is better (sort descending)
      return b.metrics[key] - a.metrics[key];
    }).slice(0, 50); // Top 50 only for performance
  });

  setSort(key: any) {
    this.sortBy.set(key);
  }
}
