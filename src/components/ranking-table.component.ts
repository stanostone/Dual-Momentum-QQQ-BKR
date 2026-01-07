import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SweepPoint } from '../services/gemini.service';

@Component({
  selector: 'app-ranking-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-gray-800/50 rounded-xl border border-gray-700 shadow-xl overflow-hidden flex flex-col h-full">
      <div class="p-5 border-b border-gray-700/50 flex flex-wrap justify-between items-center bg-gray-900/50 gap-4">
        <h3 class="text-gray-200 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
          Top Strategies Ranking
        </h3>
        <div class="flex gap-2 text-xs items-center bg-gray-800 rounded-lg p-1 pr-2 border border-gray-700/50">
           <span class="text-gray-500 pl-2 font-semibold uppercase tracking-wide mr-1">Sort:</span>
           
           <button (click)="setSort('sharpeRatio')" 
                   [class.text-yellow-400]="sortBy() === 'sharpeRatio'" 
                   [class.bg-gray-700]="sortBy() === 'sharpeRatio'"
                   class="px-3 py-1.5 rounded transition-all hover:text-white font-medium">
             Sharpe
           </button>
           
           <button (click)="setSort('cagr')" 
                   [class.text-emerald-400]="sortBy() === 'cagr'" 
                   [class.bg-gray-700]="sortBy() === 'cagr'"
                   class="px-3 py-1.5 rounded transition-all hover:text-white font-medium">
             CAGR
           </button>
           
           <button (click)="setSort('maxDrawdown')" 
                   [class.text-rose-400]="sortBy() === 'maxDrawdown'" 
                   [class.bg-gray-700]="sortBy() === 'maxDrawdown'"
                   class="px-3 py-1.5 rounded transition-all hover:text-white font-medium">
             Drawdown
           </button>
        </div>
      </div>
      
      <div class="overflow-auto max-h-[600px] custom-scrollbar">
        <table class="w-full text-left text-sm border-collapse">
          <thead class="bg-gray-800/95 text-gray-400 font-semibold sticky top-0 z-20 backdrop-blur-sm shadow-lg">
            <tr>
              <th class="px-6 py-4 whitespace-nowrap bg-gray-800">Rank</th>
              <th class="px-6 py-4 whitespace-nowrap bg-gray-800">Freq</th>
              <th class="px-6 py-4 text-right whitespace-nowrap bg-gray-800">Lookback</th>
              <th class="px-6 py-4 text-right whitespace-nowrap bg-gray-800">Smooth</th>
              <th class="px-6 py-4 text-right cursor-pointer hover:text-emerald-400 transition-colors bg-gray-800 whitespace-nowrap" (click)="setSort('cagr')">CAGR</th>
              <th class="px-6 py-4 text-right cursor-pointer hover:text-white transition-colors bg-gray-800 whitespace-nowrap" (click)="setSort('volatility')">Vol</th>
              <th class="px-6 py-4 text-right cursor-pointer hover:text-rose-400 transition-colors bg-gray-800 whitespace-nowrap" (click)="setSort('maxDrawdown')">Max DD</th>
              <th class="px-6 py-4 text-right cursor-pointer hover:text-yellow-400 transition-colors bg-gray-800 whitespace-nowrap" (click)="setSort('sharpeRatio')">Sharpe</th>
              <th class="px-6 py-4 text-right cursor-pointer hover:text-blue-300 transition-colors bg-gray-800 whitespace-nowrap" (click)="setSort('tradeCount')">Trades</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700/30">
            @for (row of sortedData(); track $index) {
              <tr class="hover:bg-gray-700/40 transition-colors group">
                <td class="px-6 py-4 text-gray-500 font-mono group-hover:text-white font-medium border-l-2 border-transparent group-hover:border-emerald-500/50">#{{ $index + 1 }}</td>
                <td class="px-6 py-4 text-gray-300">{{ row.freq }}</td>
                <td class="px-6 py-4 text-right text-gray-400">{{ row.lookback }}m</td>
                <td class="px-6 py-4 text-right text-gray-400">{{ row.smoothing }}d</td>
                
                <td class="px-6 py-4 text-right font-mono font-medium tracking-tight" [class.text-emerald-400]="row.metrics.cagr > 0">
                  {{ row.metrics.cagr | percent:'1.1-1' }}
                </td>
                
                <td class="px-6 py-4 text-right font-mono text-gray-400 tracking-tight">
                  {{ row.metrics.volatility | percent:'1.1-1' }}
                </td>
                
                <td class="px-6 py-4 text-right font-mono tracking-tight"
                    [class.text-emerald-400]="row.metrics.maxDrawdown > -0.15"
                    [class.text-yellow-400]="row.metrics.maxDrawdown <= -0.15 && row.metrics.maxDrawdown > -0.25"
                    [class.text-rose-400]="row.metrics.maxDrawdown <= -0.25"
                >
                    {{ row.metrics.maxDrawdown | percent:'1.1-1' }}
                </td>

                <td class="px-6 py-4 text-right font-mono font-bold text-base tracking-tight" [class.text-yellow-400]="row.metrics.sharpeRatio > 1">
                  {{ row.metrics.sharpeRatio | number:'1.2-2' }}
                </td>
                
                <td class="px-6 py-4 text-right font-mono text-blue-300/80">
                  {{ row.metrics.tradeCount }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      
      <div class="p-3 bg-gray-900/30 border-t border-gray-700/50 text-center">
         <p class="text-[10px] text-gray-600 uppercase tracking-widest">Showing Top 50 Configurations</p>
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(17, 24, 39, 0.4); }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(75, 85, 99, 0.6); border-radius: 4px; border: 2px solid transparent; background-clip: content-box; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.8); }
  `]
})
export class RankingTableComponent {
  data = input.required<SweepPoint[]>();
  sortBy = signal<'sharpeRatio' | 'cagr' | 'maxDrawdown' | 'volatility' | 'tradeCount'>('sharpeRatio');

  sortedData = computed(() => {
    const raw = [...this.data()];
    const key = this.sortBy();
    
    return raw.sort((a, b) => {
      if (key === 'volatility' || key === 'tradeCount') {
        return a.metrics[key] - b.metrics[key];
      }
      return b.metrics[key] - a.metrics[key];
    }).slice(0, 50); 
  });

  setSort(key: any) {
    this.sortBy.set(key);
  }
}
