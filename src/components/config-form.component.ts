import { Component, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';

export interface SimulationConfig {
  mode: 'SINGLE';
  lookbackPeriod: number;
  transactionCost: number;
  initialCapital: number;
  rebalanceFreq: string;
  smoothingWindow: number;
  useLeverage: boolean; // 3x Leverage
  startDate?: string;
  endDate?: string;
}

export interface SweepConfig {
  mode: 'SWEEP';
  transactionCost: number;
  initialCapital: number;
  // Ranges
  lookbackStart: number;
  lookbackEnd: number;
  lookbackStep: number;
  smoothingStart: number;
  smoothingEnd: number;
  smoothingStep: number;
  useLeverage: boolean; // 3x Leverage
  // Multi-select
  rebalanceFreqs: string[];
  startDate?: string;
  endDate?: string;
}

export interface UploadedData {
  brkCsv: string;
  ndxCsv: string;
  irxCsv: string;
  tqqqCsv?: string; // Optional Real TQQQ Data
}

@Component({
  selector: 'app-config-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700 shadow-2xl max-w-2xl mx-auto backdrop-blur-sm relative z-10">
      <div class="flex items-center justify-between mb-6 border-b border-gray-700 pb-4">
        <h2 class="text-2xl font-bold text-white">Configuration</h2>
        <div class="flex items-center gap-4">
            <button *ngIf="hasCachedData()" (click)="clearCache()" class="text-xs text-red-400 hover:text-red-300 underline cursor-pointer">Clear Cached Data</button>
            <div class="flex bg-gray-900 rounded-lg p-1">
            <button (click)="setMode('SINGLE')" [class.bg-emerald-600]="mode() === 'SINGLE'" class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors text-gray-300 hover:text-white cursor-pointer">Single Run</button>
            <button (click)="setMode('SWEEP')" [class.bg-purple-600]="mode() === 'SWEEP'" class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors text-gray-300 hover:text-white cursor-pointer">Param Sweep</button>
            </div>
        </div>
      </div>
      
      <!-- File Upload Section (Common) -->
      <div class="mb-8 space-y-4">
        <h3 class="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">1. Data Source</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- BRK Input -->
          <div class="relative flex items-center justify-between gap-3 bg-gray-900/50 p-2 rounded border border-gray-700">
             <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full" [class.bg-emerald-500]="brkLoaded()" [class.bg-red-900]="!brkLoaded()"></div>
                <span class="text-sm text-gray-300 w-12 font-bold">BRK-A</span>
             </div>
             <div class="flex-1 text-right overflow-hidden">
                <input type="file" accept=".csv" (change)="onFileSelected($event, 'brk')" class="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-700 file:text-white cursor-pointer">
             </div>
          </div>

          <!-- NDX Input -->
          <div class="relative flex items-center justify-between gap-3 bg-gray-900/50 p-2 rounded border border-gray-700">
             <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full" [class.bg-rose-500]="ndxLoaded()" [class.bg-red-900]="!ndxLoaded()"></div>
                <span class="text-sm text-gray-300 w-12 font-bold">NDX</span>
             </div>
             <div class="flex-1 text-right overflow-hidden">
                <input type="file" accept=".csv" (change)="onFileSelected($event, 'ndx')" class="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-700 file:text-white cursor-pointer">
             </div>
          </div>

          <!-- IRX Input -->
          <div class="relative flex items-center justify-between gap-3 bg-gray-900/50 p-2 rounded border border-gray-700">
             <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full" [class.bg-yellow-500]="irxLoaded()" [class.bg-red-900]="!irxLoaded()"></div>
                <span class="text-sm text-gray-300 w-12 font-bold">IRX</span>
             </div>
             <div class="flex-1 text-right overflow-hidden">
                <input type="file" accept=".csv" (change)="onFileSelected($event, 'irx')" class="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-700 file:text-white cursor-pointer">
             </div>
          </div>

           <!-- TQQQ Input (Optional) -->
          <div class="relative flex items-center justify-between gap-3 bg-gray-900/50 p-2 rounded border border-dashed border-gray-600">
             <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full" [class.bg-purple-500]="tqqqLoaded()" [class.bg-gray-700]="!tqqqLoaded()"></div>
                <div class="flex flex-col leading-none">
                    <span class="text-sm text-purple-300 font-bold w-12">TQQQ</span>
                    <span class="text-[9px] text-gray-500 uppercase">Optional</span>
                </div>
             </div>
             <div class="flex-1 text-right overflow-hidden">
                <input type="file" accept=".csv" (change)="onFileSelected($event, 'tqqq')" class="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-700 file:text-white cursor-pointer">
             </div>
          </div>
        </div>
        
        <!-- Visualize Data Button -->
        <button type="button" (click)="requestDataViz()" [disabled]="!allFilesLoaded()" class="w-full mt-2 py-2 border border-gray-600 text-gray-300 text-xs uppercase font-bold rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
           Visualize Input Data & Hybrid Construction
        </button>
      </div>

      <!-- Single Run Form -->
      @if (mode() === 'SINGLE') {
        <form [formGroup]="singleForm" (ngSubmit)="submitSingle()">
          <h3 class="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-4">2. Single Parameters</h3>
          
          <!-- Date Range -->
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="space-y-1">
              <label class="text-xs text-gray-400">Start Date</label>
              <input type="date" formControlName="startDate" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer">
            </div>
            <div class="space-y-1">
              <label class="text-xs text-gray-400">End Date</label>
              <input type="date" formControlName="endDate" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer">
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-1">
              <label class="text-xs text-gray-400">Lookback (Months)</label>
              <input type="number" formControlName="lookbackPeriod" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all">
            </div>
            <div class="space-y-1">
              <label class="text-xs text-gray-400">Smoothing (Days)</label>
              <input type="number" formControlName="smoothingWindow" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all">
            </div>
            <div class="space-y-1">
              <label class="text-xs text-gray-400">Rebalance</label>
              <select formControlName="rebalanceFreq" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all appearance-none cursor-pointer">
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annually">Annually</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-xs text-gray-400">Cost (%)</label>
              <input type="number" formControlName="transactionCost" step="0.01" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all">
            </div>
          </div>

          <!-- Leverage Toggle -->
          <div class="mt-4 bg-gray-900/40 p-3 rounded border border-gray-700/50 flex items-center justify-between transition-colors" [class.border-purple-500]="singleForm.get('useLeverage')?.value">
              <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-300">3x Leverage (Hybrid)</span>
                  <span class="text-[10px] text-gray-500" *ngIf="!tqqqLoaded()">Simulating 3x via NDX returns (1987-Present)</span>
                  <span class="text-[10px] text-purple-400" *ngIf="tqqqLoaded()">Using Real TQQQ data where available, NDX otherwise.</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" formControlName="useLeverage" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
          </div>

          <button type="submit" [disabled]="singleForm.invalid || !allFilesLoaded()" class="w-full text-white font-bold py-3 px-8 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 bg-emerald-600 hover:bg-emerald-500 mt-6 cursor-pointer">
            Run Single Backtest
          </button>
        </form>
      }

      <!-- Sweep Form -->
      @if (mode() === 'SWEEP') {
        <form [formGroup]="sweepForm" (ngSubmit)="submitSweep()">
          <h3 class="text-sm font-bold uppercase tracking-wider text-purple-400 mb-4">2. Parameter Ranges</h3>
          
          <!-- Date Range (Sweep) -->
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="space-y-1">
              <label class="text-xs text-gray-400">Start Date</label>
              <input type="date" formControlName="startDate" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all cursor-pointer">
            </div>
            <div class="space-y-1">
              <label class="text-xs text-gray-400">End Date</label>
              <input type="date" formControlName="endDate" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all cursor-pointer">
            </div>
          </div>

          <!-- Lookback Range -->
          <div class="mb-4 bg-gray-900/30 p-3 rounded border border-gray-700/50">
            <label class="text-xs text-purple-300 font-bold mb-2 block">Lookback Period (Months)</label>
            <div class="flex gap-2">
              <div class="flex-1"><span class="text-[10px] text-gray-500">Start</span><input type="number" formControlName="lookbackStart" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all"></div>
              <div class="flex-1"><span class="text-[10px] text-gray-500">End</span><input type="number" formControlName="lookbackEnd" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all"></div>
              <div class="flex-1"><span class="text-[10px] text-gray-500">Step</span><input type="number" formControlName="lookbackStep" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all"></div>
            </div>
          </div>

          <!-- Smoothing Range -->
          <div class="mb-4 bg-gray-900/30 p-3 rounded border border-gray-700/50">
            <label class="text-xs text-purple-300 font-bold mb-2 block">Smoothing (Days)</label>
            <div class="flex gap-2">
              <div class="flex-1"><span class="text-[10px] text-gray-500">Start</span><input type="number" formControlName="smoothingStart" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all"></div>
              <div class="flex-1"><span class="text-[10px] text-gray-500">End</span><input type="number" formControlName="smoothingEnd" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all"></div>
              <div class="flex-1"><span class="text-[10px] text-gray-500">Step</span><input type="number" formControlName="smoothingStep" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all"></div>
            </div>
          </div>

          <!-- Rebalance Multi-select -->
           <div class="mb-4">
            <label class="text-xs text-gray-400 mb-2 block">Rebalance Frequencies (Select at least one)</label>
            <div class="flex flex-wrap gap-3">
              <label class="flex items-center space-x-2 cursor-pointer bg-gray-900 px-3 py-2 rounded border border-gray-700 hover:border-purple-500" *ngFor="let freq of availableFreqs">
                <input type="checkbox" [value]="freq" (change)="onFreqChange($event, freq)" [checked]="isFreqSelected(freq)" class="form-checkbox text-purple-500 rounded bg-gray-700 border-gray-600 focus:ring-0">
                <span class="text-sm text-gray-300">{{freq}}</span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
             <div class="space-y-1">
              <label class="text-xs text-gray-400">Cost (%)</label>
              <input type="number" formControlName="transactionCost" step="0.01" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all">
            </div>
             <div class="space-y-1">
              <label class="text-xs text-gray-400">Initial Cap</label>
              <input type="number" formControlName="initialCapital" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all">
            </div>
          </div>

          <!-- Leverage Toggle (Sweep) -->
          <div class="mt-4 bg-gray-900/40 p-3 rounded border border-gray-700/50 flex items-center justify-between" [class.border-purple-500]="sweepForm.get('useLeverage')?.value">
              <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-300">3x Leverage (Hybrid)</span>
                  <span class="text-[10px] text-gray-500" *ngIf="!tqqqLoaded()">Simulating 3x via NDX returns (1987-Present)</span>
                  <span class="text-[10px] text-purple-400" *ngIf="tqqqLoaded()">Using Real TQQQ data where available, NDX otherwise.</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" formControlName="useLeverage" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
          </div>

          <button type="submit" [disabled]="sweepForm.invalid || !allFilesLoaded() || selectedFreqs.length === 0" class="w-full text-white font-bold py-3 px-8 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 bg-purple-600 hover:bg-purple-500 mt-6 cursor-pointer">
            Run Parameter Sweep
          </button>
        </form>
      }

    </div>
  `
})
export class ConfigFormComponent implements OnInit {
  startSingle = output<{ config: SimulationConfig, data: UploadedData }>();
  startSweep = output<{ config: SweepConfig, data: UploadedData }>();
  viewData = output<UploadedData>();
  
  mode = signal<'SINGLE' | 'SWEEP'>('SINGLE');
  
  // State for file contents
  brkCsv = ''; ndxCsv = ''; irxCsv = ''; tqqqCsv = '';
  brkLoaded = signal(false); ndxLoaded = signal(false); irxLoaded = signal(false); tqqqLoaded = signal(false);
  
  // Sources to display (Cache vs File)
  brkSource = signal('File'); ndxSource = signal('File'); irxSource = signal('File');

  fb = new FormBuilder();
  
  singleForm: FormGroup = this.fb.group({
    lookbackPeriod: [12, [Validators.required, Validators.min(1)]],
    rebalanceFreq: ['Monthly', [Validators.required]],
    smoothingWindow: [0, [Validators.required, Validators.min(0)]],
    transactionCost: [0.1, [Validators.required, Validators.min(0)]],
    initialCapital: [10000, [Validators.required]],
    useLeverage: [false], // Default Off
    startDate: [null],
    endDate: [null]
  });

  sweepForm: FormGroup = this.fb.group({
    lookbackStart: [1, [Validators.required, Validators.min(1)]],
    lookbackEnd: [12, [Validators.required, Validators.min(1)]],
    lookbackStep: [1, [Validators.required, Validators.min(1)]],
    smoothingStart: [1, [Validators.required, Validators.min(0)]],
    smoothingEnd: [50, [Validators.required, Validators.min(0)]],
    smoothingStep: [5, [Validators.required, Validators.min(1)]],
    transactionCost: [0.1, [Validators.required]],
    initialCapital: [10000, [Validators.required]],
    useLeverage: [false], // Default Off
    startDate: [null],
    endDate: [null]
  });

  availableFreqs = ['Weekly', 'Monthly', 'Quarterly', 'Annually'];
  selectedFreqs: string[] = ['Monthly', 'Quarterly'];

  ngOnInit() {
    this.loadFromCache();
  }

  setMode(m: 'SINGLE' | 'SWEEP') { this.mode.set(m); }

  onFileSelected(event: any, type: 'brk' | 'ndx' | 'irx' | 'tqqq') {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
            if (type === 'brk') { 
                this.brkCsv = content; this.brkLoaded.set(true); this.brkSource.set('File');
                localStorage.setItem('qm_brk_csv', content);
            } else if (type === 'ndx') { 
                this.ndxCsv = content; this.ndxLoaded.set(true); this.ndxSource.set('File');
                localStorage.setItem('qm_ndx_csv', content);
            } else if (type === 'irx') { 
                this.irxCsv = content; this.irxLoaded.set(true); this.irxSource.set('File');
                localStorage.setItem('qm_irx_csv', content);
            } else if (type === 'tqqq') {
                this.tqqqCsv = content; this.tqqqLoaded.set(true);
                localStorage.setItem('qm_tqqq_csv', content);
            }
        } catch (err) {
            console.warn('Storage quota exceeded, could not cache file.');
        }
      };
      reader.readAsText(file);
    }
  }

  loadFromCache() {
    try {
        const b = localStorage.getItem('qm_brk_csv');
        const n = localStorage.getItem('qm_ndx_csv');
        const i = localStorage.getItem('qm_irx_csv');
        const t = localStorage.getItem('qm_tqqq_csv');

        if (b) { this.brkCsv = b; this.brkLoaded.set(true); this.brkSource.set('Cache'); }
        if (n) { this.ndxCsv = n; this.ndxLoaded.set(true); this.ndxSource.set('Cache'); }
        if (i) { this.irxCsv = i; this.irxLoaded.set(true); this.irxSource.set('Cache'); }
        if (t) { this.tqqqCsv = t; this.tqqqLoaded.set(true); }
    } catch (e) {
        console.error('Error loading from cache', e);
    }
  }

  clearCache() {
    localStorage.removeItem('qm_brk_csv');
    localStorage.removeItem('qm_ndx_csv');
    localStorage.removeItem('qm_irx_csv');
    localStorage.removeItem('qm_tqqq_csv');
    this.brkCsv = ''; this.ndxCsv = ''; this.irxCsv = ''; this.tqqqCsv = '';
    this.brkLoaded.set(false); this.ndxLoaded.set(false); this.irxLoaded.set(false); this.tqqqLoaded.set(false);
  }

  hasCachedData(): boolean {
     return !!(localStorage.getItem('qm_brk_csv') || localStorage.getItem('qm_ndx_csv') || localStorage.getItem('qm_irx_csv'));
  }

  allFilesLoaded(): boolean { return this.brkLoaded() && this.ndxLoaded() && this.irxLoaded(); }

  onFreqChange(e: any, freq: string) {
    if (e.target.checked) {
      this.selectedFreqs.push(freq);
    } else {
      this.selectedFreqs = this.selectedFreqs.filter(f => f !== freq);
    }
  }

  isFreqSelected(freq: string) { return this.selectedFreqs.includes(freq); }

  requestDataViz() {
     if (this.allFilesLoaded()) {
         this.viewData.emit({
             brkCsv: this.brkCsv,
             ndxCsv: this.ndxCsv,
             irxCsv: this.irxCsv,
             tqqqCsv: this.tqqqCsv
         });
     }
  }

  submitSingle() {
    if (this.singleForm.valid && this.allFilesLoaded()) {
      const formVal = this.singleForm.value;
      this.startSingle.emit({
        config: { ...formVal, mode: 'SINGLE' },
        data: { brkCsv: this.brkCsv, ndxCsv: this.ndxCsv, irxCsv: this.irxCsv, tqqqCsv: this.tqqqCsv }
      });
    }
  }

  submitSweep() {
    if (this.sweepForm.valid && this.allFilesLoaded() && this.selectedFreqs.length > 0) {
      const formVal = this.sweepForm.value;
      this.startSweep.emit({
        config: { ...formVal, rebalanceFreqs: this.selectedFreqs, mode: 'SWEEP' },
        data: { brkCsv: this.brkCsv, ndxCsv: this.ndxCsv, irxCsv: this.irxCsv, tqqqCsv: this.tqqqCsv }
      });
    }
  }
}
