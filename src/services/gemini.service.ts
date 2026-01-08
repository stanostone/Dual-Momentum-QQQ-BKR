import { Injectable } from '@angular/core';
import { SimulationConfig, SweepConfig, UploadedData } from '../components/config-form.component';

export interface BacktestMetrics {
  cagr: number;
  maxDrawdown: number;
  sharpeRatio: number;
  finalBalance: number;
  volatility: number;
  tradeCount: number;
}

export interface HistoryPoint {
  date: string;
  strategy: number;
  brk: number;
  ndx: number;
  heldAsset: string;
  drawdown: number;
}

export interface BacktestResult {
  config: SimulationConfig;
  metrics: { strategy: BacktestMetrics; brk: BacktestMetrics; ndx: BacktestMetrics };
  history: Array<HistoryPoint>;
  analysis: string;
}

export interface SweepPoint {
  lookback: number;
  smoothing: number;
  freq: string;
  metrics: BacktestMetrics;
}

export interface SweepResult {
  config: SweepConfig;
  points: SweepPoint[];
  benchmarks: { brk: BacktestMetrics; ndx: BacktestMetrics };
}

@Injectable({
  providedIn: 'root'
})
export class BacktestService {

  // --- Main Entries ---

  runBacktest(config: SimulationConfig, dataFiles: UploadedData): BacktestResult {
    let marketData = this.prepareData(dataFiles, config.startDate, config.endDate);
    
    // Apply Leverage if enabled
    if (config.useLeverage) {
        marketData = this.transformToLeveraged(marketData, 3.0);
    }

    const result = this.executeStrategy(marketData, config.lookbackPeriod, config.rebalanceFreq, config.smoothingWindow, config.transactionCost, config.initialCapital, true);

    return {
      config,
      metrics: result.metrics,
      history: result.history!,
      analysis: this.generateAnalysis(result.metrics, config.lookbackPeriod, config.rebalanceFreq, config.smoothingWindow, config.useLeverage)
    };
  }

  runSweep(config: SweepConfig, dataFiles: UploadedData): SweepResult {
    // Single alignment and filtering
    let marketData = this.prepareData(dataFiles, config.startDate, config.endDate);
    
    // Apply Leverage if enabled (for the whole sweep)
    if (config.useLeverage) {
        marketData = this.transformToLeveraged(marketData, 3.0);
    }

    const points: SweepPoint[] = [];

    // Loop through ranges
    for (let lb = config.lookbackStart; lb <= config.lookbackEnd; lb += config.lookbackStep) {
      for (let sm = config.smoothingStart; sm <= config.smoothingEnd; sm += config.smoothingStep) {
        for (const freq of config.rebalanceFreqs) {
           const result = this.executeStrategy(marketData, lb, freq, sm, config.transactionCost, config.initialCapital, false);
           points.push({
             lookback: lb,
             smoothing: sm,
             freq: freq,
             metrics: result.metrics.strategy
           });
        }
      }
    }

    // Compute Benchmarks for Scatter Plot
    const brkArr = marketData.map(d => d.brk);
    const ndxArr = marketData.map(d => d.ndx); // This is now TQQQ if leverage was on
    // Normalize to initial capital for accurate final balance calc (though CAGR/Sharpe are independent of capital)
    const initCap = config.initialCapital;
    const brkNorm = brkArr.map(v => v * (initCap / brkArr[0]));
    const ndxNorm = ndxArr.map(v => v * (initCap / ndxArr[0]));

    const brkMetrics = { ...this.calcMetrics(brkNorm), tradeCount: 1 };
    const ndxMetrics = { ...this.calcMetrics(ndxNorm), tradeCount: 1 };

    return { config, points, benchmarks: { brk: brkMetrics, ndx: ndxMetrics } };
  }

  // --- Data Visualization Helper ---
  
  getVisualizableData(dataFiles: UploadedData) {
      // 1. Prepare raw data (no date filter initially, or we could add optional filters)
      // We want to show the full range usually for data inspection
      let data = this.prepareData(dataFiles);

      // 2. Create the Hybrid TQQQ Column
      // This logic mirrors transformToLeveraged but keeps the original NDX column intact
      // and adds a new 'hybrid_tqqq' column.
      
      const leverage = 3.0;
      let currentPrice = data[0].ndx; // Start at NDX price for normalized view, or 100? Let's use NDX price.
      
      const vizData = data.map((d, i) => {
          let tqqqVal = currentPrice;

          if (i > 0) {
             const prev = data[i-1];
             const curr = data[i];
             
             let effectiveReturn = 0;
             const hasRealTqqq = curr.tqqq && prev.tqqq && curr.tqqq > 0 && prev.tqqq > 0;

             if (hasRealTqqq) {
                 effectiveReturn = (curr.tqqq - prev.tqqq) / prev.tqqq;
             } else {
                 const ndxRet = (curr.ndx - prev.ndx) / prev.ndx;
                 effectiveReturn = ndxRet * leverage;
             }

             // Compound
             currentPrice = currentPrice * (1 + effectiveReturn);
             if (currentPrice < 0.01) currentPrice = 0.01;
             tqqqVal = currentPrice;
          }

          return {
              date: d.date,
              brk: d.brk,
              ndx: d.ndx,
              hybrid_tqqq: tqqqVal,
              is_real_tqqq: (d.tqqq !== undefined && d.tqqq > 0)
          };
      });

      return vizData;
  }

  // --- Leverage Logic ---
  private transformToLeveraged(data: any[], leverage: number): any[] {
     // Clone the array to avoid mutating source
     const newData = data.map(d => ({ ...d }));
     
     if (newData.length < 2) return newData;

     let currentPrice = newData[0].ndx;

     // Check if we have any real TQQQ data to use
     const hasRealTqqqData = newData.some(d => d.tqqq !== undefined && d.tqqq > 0);

     for (let i = 1; i < newData.length; i++) {
        const prev = data[i-1]; 
        const curr = data[i];
        
        let effectiveReturn = 0;

        // Condition 1: Use Real TQQQ return if available
        if (hasRealTqqqData && curr.tqqq && prev.tqqq && curr.tqqq > 0 && prev.tqqq > 0) {
            effectiveReturn = (curr.tqqq - prev.tqqq) / prev.tqqq;
        } 
        // Condition 2: Fallback to Synthetic (NDX * Leverage)
        else {
             const ndxRet = (curr.ndx - prev.ndx) / prev.ndx;
             effectiveReturn = ndxRet * leverage;
        }
        
        // Compounding
        currentPrice = currentPrice * (1 + effectiveReturn);
        
        if (currentPrice < 0.01) currentPrice = 0.01;

        // Overwrite the 'ndx' column which is used by the strategy as the "Growth Asset"
        newData[i].ndx = currentPrice;
     }

     return newData;
  }

  // --- Data Prep ---

  private prepareData(dataFiles: UploadedData, startDate?: string, endDate?: string) {
    const brkData = this.parseCSV(dataFiles.brkCsv);
    const ndxData = this.parseCSV(dataFiles.ndxCsv);
    const irxData = this.parseCSV(dataFiles.irxCsv);
    
    // Optional TQQQ
    let tqqqData: {date: string, close: number}[] = [];
    if (dataFiles.tqqqCsv && dataFiles.tqqqCsv.trim().length > 0) {
        tqqqData = this.parseCSV(dataFiles.tqqqCsv);
    }

    if (brkData.length === 0) throw new Error("BRK-A CSV is empty or invalid. Ensure it has Date and Close/Adj Close columns.");
    if (ndxData.length === 0) throw new Error("NDX CSV is empty or invalid. Ensure it has Date and Close/Adj Close columns.");
    if (irxData.length === 0) throw new Error("IRX CSV is empty or invalid. Ensure it has Date and Price/Rate/Close columns.");
    
    let merged = this.alignData(brkData, ndxData, irxData, tqqqData);

    // Date Filtering
    if (startDate) {
      const startTs = new Date(startDate).getTime();
      merged = merged.filter(d => new Date(d.date).getTime() >= startTs);
    }
    if (endDate) {
      const endTs = new Date(endDate).getTime();
      merged = merged.filter(d => new Date(d.date).getTime() <= endTs);
    }
    
    if (merged.length < 50) {
        throw new Error("Data set is too small after filtering (<50 points). Expand your date range.");
    }

    return merged;
  }

  private parseCSV(content: string): { date: string, close: number }[] {
    const lines = content.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headerLine = lines[0].toLowerCase();
    const header = headerLine.split(',').map(h => h.trim());
    
    // 1. Detect Date Column
    let dateIdx = header.findIndex(h => h === 'date' || h === 'time' || h === 'day' || h === 'observation_date');
    if (dateIdx === -1) dateIdx = 0; // Fallback to first column

    // 2. Detect Value/Price Column
    // Priority: Adj Close -> Close -> Price -> Value -> Rate -> Yield
    const valueKeywords = ['adj close', 'adjclose', 'close', 'price', 'value', 'rate', 'yield', 'irx', 'tnx', 'dgs3mo'];
    let closeIdx = -1;
    
    for (const kw of valueKeywords) {
      const idx = header.findIndex(h => h === kw);
      if (idx !== -1) {
        closeIdx = idx;
        break;
      }
    }

    // Fallback strategy for value column
    if (closeIdx === -1) {
       // If standard Yahoo format (6+ cols), assume index 5 (Adj Close)
       if (header.length >= 6) closeIdx = 5;
       // If FRED or simple format (2 cols), assume index 1
       else if (header.length === 2) closeIdx = 1;
       // Last resort fallback
       else closeIdx = 1;
    }

    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      // Simple validation of column count
      if (parts.length <= closeIdx || parts.length <= dateIdx) continue;
      
      let dateStr = parts[dateIdx].trim();
      let valStr = parts[closeIdx].trim();
      
      const closeVal = parseFloat(valStr);

      // Normalize Date Formats
      if (dateStr.includes('/')) {
        const dParts = dateStr.split('/');
        if (dParts.length === 3) {
          const p0 = parseInt(dParts[0]); const p1 = parseInt(dParts[1]); const p2 = parseInt(dParts[2]);
          if (p0 > 1000) { dateStr = `${p0}-${String(p1).padStart(2,'0')}-${String(p2).padStart(2,'0')}`; } 
          else if (p2 > 1000) {
             // Heuristic: If first part > 12, it's YYYY/MM/DD or similar? usually MM/DD/YYYY
             dateStr = (p0 > 12) 
               ? `${p2}-${String(p1).padStart(2,'0')}-${String(p0).padStart(2,'0')}` 
               : `${p2}-${String(p0).padStart(2,'0')}-${String(p1).padStart(2,'0')}`;
          }
        }
      }

      // Check for valid date YYYY-MM-DD and numeric value
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/) && !isNaN(closeVal)) {
        data.push({ date: dateStr, close: closeVal });
      }
    }
    return data.sort((a, b) => a.date.localeCompare(b.date));
  }

  private alignData(brk: any[], ndx: any[], irx: any[], tqqq: any[] = []) {
    const brkMap = new Map(brk.map(d => [d.date, d.close]));
    const ndxMap = new Map(ndx.map(d => [d.date, d.close]));
    const irxMap = new Map(irx.map(d => [d.date, d.close]));
    const tqqqMap = new Map(tqqq.map(d => [d.date, d.close]));

    const allDates = new Set([...brkMap.keys(), ...ndxMap.keys()]);
    const sortedDates = Array.from(allDates).sort();
    const merged = [];
    let lastIrx = 0;
    
    // Initialize lastIrx with the first available value if possible to avoid 0% start
    const firstIrx = irx.find(d => d.close > 0);
    if (firstIrx) lastIrx = firstIrx.close;

    for (const date of sortedDates) {
      const bVal = brkMap.get(date);
      const nVal = ndxMap.get(date);
      let iVal = irxMap.get(date);
      
      if (iVal !== undefined && !isNaN(iVal)) lastIrx = iVal;
      
      if (bVal !== undefined && nVal !== undefined) {
        // We include TQQQ in the row if available, otherwise undefined
        const tVal = tqqqMap.get(date);
        merged.push({ date, brk: bVal, ndx: nVal, rf_rate: lastIrx, tqqq: tVal });
      }
    }
    return merged;
  }

  // --- Core Engine ---

  private executeStrategy(
    data: any[], 
    lookbackMonths: number, 
    freq: string, 
    smoothing: number, 
    transCostPct: number, 
    initialCap: number,
    returnHistoryArray: boolean
  ) {
    const transCost = transCostPct / 100;
    let strategyBalance = initialCap;
    let brkBalance = initialCap;
    let ndxBalance = initialCap;
    let currentHolding = 0; // 0=Cash, 1=BRK, 2=NDX
    let tradeCount = 0;
    
    let stratPeak = initialCap;
    
    // We always need temporary history to calculate full metrics (Sharpe/MaxDD) properly
    // Storing simplified array for calculation
    const historyVals: number[] = [initialCap];
    const brkVals: number[] = [initialCap];
    const ndxVals: number[] = [initialCap];
    
    // Full history object for UI plotting (optional)
    const fullHistory: HistoryPoint[] = [];

    let lookbackPtr = 0;
    const targetLookbackMs = lookbackMonths * 30.44 * 24 * 60 * 60 * 1000; 

    for (let i = 0; i < data.length; i++) {
      const today = data[i];
      const todayDateTs = new Date(today.date).getTime();
      let heldAssetString = 'CASH';

      // Daily Returns
      if (i > 0) {
        const prev = data[i-1];
        const retBRK = (today.brk - prev.brk) / prev.brk;
        const retNDX = (today.ndx - prev.ndx) / prev.ndx;
        // IRX is annual yield %, so daily return = yield / 100 / 252
        const retCash = (prev.rf_rate / 100) / 252;

        if (currentHolding === 1) strategyBalance *= (1 + retBRK);
        else if (currentHolding === 2) strategyBalance *= (1 + retNDX);
        else strategyBalance *= (1 + retCash);

        brkBalance *= (1 + retBRK);
        ndxBalance *= (1 + retNDX);
      }
      
      if (strategyBalance > stratPeak) stratPeak = strategyBalance;
      const currentDD = (strategyBalance - stratPeak) / stratPeak;

      // Rebalance Logic
      const isRebalance = this.isRebalanceTime(data, i, freq);
      
      if (isRebalance) {
        while (lookbackPtr < i && (todayDateTs - new Date(data[lookbackPtr].date).getTime()) > targetLookbackMs) {
          lookbackPtr++;
        }
        
        const pastIndex = lookbackPtr > 0 ? lookbackPtr - 1 : 0;
        const past = data[pastIndex]; 
        const timeDiff = todayDateTs - new Date(past.date).getTime();
        
        if (timeDiff >= targetLookbackMs * 0.9) {
            const priceTodayBRK = this.getSMA(data, i, smoothing, 'brk');
            const pricePastBRK = this.getSMA(data, pastIndex, smoothing, 'brk');
            const priceTodayNDX = this.getSMA(data, i, smoothing, 'ndx');
            const pricePastNDX = this.getSMA(data, pastIndex, smoothing, 'ndx');

            const momBRK = (priceTodayBRK - pricePastBRK) / pricePastBRK;
            const momNDX = (priceTodayNDX - pricePastNDX) / pricePastNDX;
            // Hurdle Rate: IRX Yield (Annualized) scaled to lookback period
            // e.g. if Yield is 4%, and lookback is 6mo, hurdle is ~2%
            const momTBill = (today.rf_rate / 100) * (lookbackMonths / 12); 

            let newHolding = 0; 
            if (momBRK > momNDX) {
               if (momBRK > momTBill) newHolding = 1; 
            } else {
               if (momNDX > momTBill) newHolding = 2; 
            }

            if (newHolding !== currentHolding) {
              strategyBalance *= (1 - transCost);
              currentHolding = newHolding;
              tradeCount++;
            }
        }
      }
      
      // Store Values
      historyVals.push(strategyBalance);
      brkVals.push(brkBalance);
      ndxVals.push(ndxBalance);

      if (returnHistoryArray) {
        if (currentHolding === 1) heldAssetString = 'BRK';
        if (currentHolding === 2) heldAssetString = 'NDX'; // Or TQQQ if leveraged

        if (i % 5 === 0 || i === data.length - 1) {
          fullHistory.push({
            date: today.date,
            strategy: strategyBalance,
            brk: brkBalance,
            ndx: ndxBalance,
            heldAsset: heldAssetString,
            drawdown: currentDD
          });
        }
      }
    }
    
    // Final metric calc
    const stratMetrics = { ...this.calcMetrics(historyVals), tradeCount };
    
    // Only calc these if needed to save time
    const brkMetrics = returnHistoryArray ? { ...this.calcMetrics(brkVals), tradeCount: 1 } : stratMetrics;
    const ndxMetrics = returnHistoryArray ? { ...this.calcMetrics(ndxVals), tradeCount: 1 } : stratMetrics;

    const result = {
        metrics: {
            strategy: stratMetrics,
            brk: brkMetrics,
            ndx: ndxMetrics
        },
        history: returnHistoryArray ? fullHistory : undefined
    };
    return result;
  }

  // --- Helpers ---

  private getSMA(data: any[], index: number, window: number, key: 'brk' | 'ndx'): number {
    if (window <= 1) return data[index][key];
    let sum = 0; let count = 0;
    for (let i = 0; i < window; i++) {
      if (index - i < 0) break;
      sum += data[index - i][key];
      count++;
    }
    return count > 0 ? sum / count : data[index][key];
  }

  private isRebalanceTime(data: any[], index: number, freq: string): boolean {
    if (index === data.length - 1) return true;
    const d1 = new Date(data[index].date);
    const d2 = new Date(data[index+1].date);
    
    if (freq === 'Weekly') {
      const day1 = d1.getDay();
      const day2 = d2.getDay();
      const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 3600 * 24);
      return day2 < day1 || diffDays > 6;
    }

    const isMonthChange = d1.getMonth() !== d2.getMonth();
    
    if (freq === 'Monthly') return isMonthChange;
    if (freq === 'Quarterly') return isMonthChange && (d1.getMonth() + 1) % 3 === 0;
    if (freq === 'Semi-Annually') return isMonthChange && (d1.getMonth() + 1) % 6 === 0;
    if (freq === 'Annually') return d1.getFullYear() !== d2.getFullYear();
    
    return isMonthChange;
  }

  private calcMetrics(arr: number[]): Omit<BacktestMetrics, 'tradeCount'> {
    const periods = 252; // Daily data
    const years = arr.length / periods; 
    const initial = arr[0];
    const final = arr[arr.length-1];

    const cagr = years > 0 ? Math.pow((final / initial), (1/years)) - 1 : 0;

    let peak = -Infinity; let maxDD = 0;
    for (const val of arr) {
      if (val > peak) peak = val;
      const dd = (val - peak) / peak;
      if (dd < maxDD) maxDD = dd;
    }
    
    // Stats for Sharpe
    let sumR = 0;
    let sumSqR = 0;
    let count = 0;
    
    for(let k=1; k<arr.length; k++) {
        const ret = (arr[k] - arr[k-1])/arr[k-1];
        sumR += ret;
        sumSqR += ret * ret;
        count++;
    }

    const avg = count > 0 ? sumR / count : 0;
    const variance = count > 1 ? (sumSqR - (sumR * sumR) / count) / (count - 1) : 0;
    const std = Math.sqrt(variance);
    const annualizedVol = std * Math.sqrt(periods);
    
    const sharpe = annualizedVol === 0 ? 0 : (avg - (0.04/periods)) / std * Math.sqrt(periods);

    return { cagr, maxDrawdown: maxDD, sharpeRatio: sharpe, finalBalance: final, volatility: annualizedVol };
  }

  private generateAnalysis(metrics: any, lb: number, freq: string, smooth: number, leveraged: boolean): string {
    const s = metrics.strategy;
    const levText = leveraged ? ' | 3x LEVERAGE (Synth TQQQ)' : '';
    return `ANALYSIS (${freq} Rebalancing${levText})\nCAGR: ${(s.cagr * 100).toFixed(1)}% | Max DD: ${(s.maxDrawdown * 100).toFixed(1)}% | Sharpe: ${s.sharpeRatio.toFixed(2)}\nTrades: ${s.tradeCount} | Signal: ${smooth}d SMA, Lookback: ${lb} Mo`;
  }
}