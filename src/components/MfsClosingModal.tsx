import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MfsClosing } from '../db/db';
import { getTodayMfsSummary, saveMfsDailyClosing, deleteMfsDailyClosing, TodayMfsSummary } from '../services/mfsClosingService';
import { 
  CheckCircle2, AlertTriangle, AlertCircle, X, 
  Smartphone, Calculator, History, Trash2, Printer, 
  ArrowUpRight, ArrowDownLeft, DollarSign, Calendar
} from 'lucide-react';
import { format } from 'date-fns';

interface MfsClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MfsClosingModal({ isOpen, onClose }: MfsClosingModalProps) {
  const [activeTab, setActiveTab] = useState<'reconcile' | 'history'>('reconcile');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedOperator, setSelectedOperator] = useState<'All' | 'bKash' | 'Nagad' | 'Rocket'>('All');

  // Input states
  const [simBalanceInput, setSimBalanceInput] = useState<string>('');
  const [drawerCashInput, setDrawerCashInput] = useState<string>('');
  const [closingNote, setClosingNote] = useState<string>('');

  // Daily stats state
  const [summary, setSummary] = useState<TodayMfsSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Past closings query
  const pastClosings = useLiveQuery(
    () => db.mfsClosings.orderBy('date').reverse().toArray(),
    []
  ) || [];

  // Fetch summary when date or operator changes
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoadingSummary(true);
      try {
        const data = await getTodayMfsSummary(selectedDate, selectedOperator);
        if (isMounted) {
          setSummary(data);
          // Autofill system sim balance as initial hint if empty
          if (!simBalanceInput) {
            if (selectedOperator === 'bKash') {
              setSimBalanceInput(String(data.currentSimBalances.bkash || 0));
            } else if (selectedOperator === 'Nagad') {
              setSimBalanceInput(String(data.currentSimBalances.nagad || 0));
            } else if (selectedOperator === 'Rocket') {
              setSimBalanceInput(String(data.currentSimBalances.rocket || 0));
            } else {
              setSimBalanceInput(String(data.currentSimBalances.total || 0));
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoadingSummary(false);
      }
    }
    if (isOpen) {
      load();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedDate, selectedOperator]);

  // Calculations
  const calculations = useMemo(() => {
    const simCount = Number(simBalanceInput) || 0;
    const cashCount = Number(drawerCashInput) || 0;
    const actualTotal = simCount + cashCount;

    // Expected drawer cash movement:
    // Cash-In increases drawer cash (customer paid cash to shop)
    // Cash-Out decreases drawer cash (shop paid cash to customer)
    // Net cash flow = CashIn - CashOut + Profit
    const cashIn = summary?.cashInTotal || 0;
    const cashOut = summary?.cashOutTotal || 0;
    const profit = summary?.totalProfit || 0;
    const expectedNetCashChange = cashIn - cashOut + profit;

    // System expected SIM balance
    let expectedSim = 0;
    if (summary) {
      if (selectedOperator === 'bKash') expectedSim = summary.currentSimBalances.bkash;
      else if (selectedOperator === 'Nagad') expectedSim = summary.currentSimBalances.nagad;
      else if (selectedOperator === 'Rocket') expectedSim = summary.currentSimBalances.rocket;
      else expectedSim = summary.currentSimBalances.total;
    }

    // Expected total in ecosystem (SIM + Cash drawer)
    // If starting drawer cash is unknown, discrepancy is evaluated against SIM + Net Cash
    const discrepancy = actualTotal - (expectedSim + cashCount); // Or difference between actual SIM and system SIM
    const simDiscrepancy = simCount - expectedSim;

    let status: 'Balanced' | 'Surplus' | 'Shortage' = 'Balanced';
    if (simDiscrepancy > 2) status = 'Surplus';
    else if (simDiscrepancy < -2) status = 'Shortage';

    return {
      simCount,
      cashCount,
      actualTotal,
      expectedSim,
      expectedNetCashChange,
      simDiscrepancy,
      status
    };
  }, [simBalanceInput, drawerCashInput, summary, selectedOperator]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simBalanceInput) {
      setErrorMsg('Please enter your actual SIM balance.');
      return;
    }

    try {
      await saveMfsDailyClosing({
        date: selectedDate,
        operator: selectedOperator,
        simClosingBalance: Number(simBalanceInput) || 0,
        drawerCashCount: Number(drawerCashInput) || 0,
        systemExpectedSimBalance: calculations.expectedSim,
        systemExpectedCash: calculations.cashCount,
        todayCashInTotal: summary?.cashInTotal || 0,
        todayCashOutTotal: summary?.cashOutTotal || 0,
        todayProfitTotal: summary?.totalProfit || 0,
        note: closingNote
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setActiveTab('history');
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save closing report.');
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleDeleteClosing = async (id: number) => {
    await deleteMfsDailyClosing(id);
    setConfirmDeleteId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-100 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-[#084b3e] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-200">
              <Calculator size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Daily MFS Closing & SIM Reconciliation
              </h2>
              <p className="text-xs text-emerald-100/80">
                Match Agent SIM balance with physical cash drawer at end of day
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-xl transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-gray-100 bg-gray-50/70 px-5 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('reconcile')}
            className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'reconcile'
                ? 'border-[#084b3e] text-[#084b3e]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Calculator size={15} />
            <span>Reconciliation Calculator</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#084b3e] text-[#084b3e]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <History size={15} />
            <span>Past Closings ({pastClosings.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 flex-1 space-y-5">
          {activeTab === 'reconcile' ? (
            <>
              {/* Date & Operator Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200/80">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#084b3e]" />
                    <span>Closing Date</span>
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#084b3e]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Smartphone size={13} className="text-[#084b3e]" />
                    <span>Operator</span>
                  </label>
                  <select
                    value={selectedOperator}
                    onChange={(e) => {
                      setSelectedOperator(e.target.value as any);
                      setSimBalanceInput(''); // Reset so it autofills with new operator
                    }}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#084b3e]"
                  >
                    <option value="All">All Operators (bKash + Nagad + Rocket)</option>
                    <option value="bKash">bKash Agent SIM</option>
                    <option value="Nagad">Nagad Uddokta SIM</option>
                    <option value="Rocket">Rocket Agent SIM</option>
                  </select>
                </div>
              </div>

              {/* Today's Auto Activity Summary */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Today's Activity for {selectedOperator} ({selectedDate})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Cash In */}
                  <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                      <ArrowUpRight size={13} className="text-emerald-600" />
                      <span>Cash-In</span>
                    </div>
                    <p className="text-base font-black text-emerald-950 mt-0.5">
                      Tk {(summary?.cashInTotal || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-emerald-700">{summary?.cashInCount || 0} transactions</p>
                  </div>

                  {/* Cash Out */}
                  <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-blue-800">
                      <ArrowDownLeft size={13} className="text-blue-600" />
                      <span>Cash-Out</span>
                    </div>
                    <p className="text-base font-black text-blue-950 mt-0.5">
                      Tk {(summary?.cashOutTotal || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-blue-700">{summary?.cashOutCount || 0} transactions</p>
                  </div>

                  {/* Net Profit */}
                  <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800">
                      <DollarSign size={13} className="text-amber-600" />
                      <span>Profit Earned</span>
                    </div>
                    <p className="text-base font-black text-amber-950 mt-0.5">
                      Tk {(summary?.totalProfit || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-amber-700">Commission & fees</p>
                  </div>

                  {/* System Expected SIM */}
                  <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-100">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-purple-800">
                      <Smartphone size={13} className="text-purple-600" />
                      <span>Expected SIM</span>
                    </div>
                    <p className="text-base font-black text-purple-950 mt-0.5">
                      Tk {calculations.expectedSim.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-purple-700">In database record</p>
                  </div>
                </div>
              </div>

              {/* Form Input for SIM Balance & Cash */}
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Physical SIM Balance Input */}
                  <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500/40 shadow-xs space-y-1.5">
                    <label className="block text-xs font-extrabold text-gray-900 flex items-center justify-between">
                      <span>1. Actual SIM Balance (Tk) *</span>
                      <span className="text-[10px] text-emerald-700 font-semibold">From SMS / USSD</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={simBalanceInput}
                      onChange={(e) => setSimBalanceInput(e.target.value)}
                      placeholder="e.g. 25000"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-lg font-black text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e]"
                      required
                    />
                    <p className="text-[11px] text-gray-500">
                      Check your Agent SIM dial balance and type here.
                    </p>
                  </div>

                  {/* Physical Cash Drawer Count */}
                  <div className="bg-white p-4 rounded-2xl border-2 border-blue-500/40 shadow-xs space-y-1.5">
                    <label className="block text-xs font-extrabold text-gray-900 flex items-center justify-between">
                      <span>2. Drawer Cash Count (Tk)</span>
                      <span className="text-[10px] text-blue-700 font-semibold">Paper Banknotes</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={drawerCashInput}
                      onChange={(e) => setDrawerCashInput(e.target.value)}
                      placeholder="e.g. 15000"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-lg font-black text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <p className="text-[11px] text-gray-500">
                      Physical paper cash counted from the drawer for MFS.
                    </p>
                  </div>
                </div>

                {/* RECONCILIATION RESULT CARD */}
                {simBalanceInput && (
                  <div className={`p-5 rounded-2xl border transition-all ${
                    calculations.status === 'Balanced'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : calculations.status === 'Surplus'
                      ? 'bg-blue-50 border-blue-300 text-blue-950'
                      : 'bg-red-50 border-red-300 text-red-950'
                  }`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        {calculations.status === 'Balanced' ? (
                          <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <CheckCircle2 size={24} />
                          </div>
                        ) : calculations.status === 'Surplus' ? (
                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                            <CheckCircle2 size={24} />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 animate-bounce">
                            <AlertTriangle size={24} />
                          </div>
                        )}

                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                            Reconciliation Result
                          </span>
                          <h4 className="text-lg font-black">
                            {calculations.status === 'Balanced' && 'Exact Match! Account is Balanced.'}
                            {calculations.status === 'Surplus' && `Surplus: +Tk ${Math.abs(calculations.simDiscrepancy).toLocaleString()} Extra`}
                            {calculations.status === 'Shortage' && `Shortage Warning: -Tk ${Math.abs(calculations.simDiscrepancy).toLocaleString()} Missing`}
                          </h4>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-semibold opacity-75">Combined Net Total:</span>
                        <p className="text-xl font-black">
                          Tk {(calculations.simCount + calculations.cashCount).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-black/10 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="opacity-70">Physical SIM:</span>{' '}
                        <strong>Tk {calculations.simCount.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="opacity-70">System Target:</span>{' '}
                        <strong>Tk {calculations.expectedSim.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="opacity-70">Discrepancy:</span>{' '}
                        <strong className={calculations.simDiscrepancy < 0 ? 'text-red-700' : 'text-emerald-700'}>
                          {calculations.simDiscrepancy >= 0 ? '+' : ''}{calculations.simDiscrepancy} Tk
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional Note */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Closing Notes / Audit Remarks
                  </label>
                  <input
                    type="text"
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                    placeholder="e.g. Night shift closing by Hasan. Checked SIM balances."
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e]"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    <span>{errorMsg}</span>
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!simBalanceInput}
                    className="px-6 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    <span>{saveSuccess ? 'Saved Successfully!' : 'Save Closing Record'}</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* HISTORY TAB */
            <div className="space-y-3">
              {pastClosings.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <History size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs font-bold text-gray-600">No past closing records found</p>
                  <p className="text-[11px] text-gray-400">Perform a daily closing to save your first audit record.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-white">
                  {pastClosings.map(c => {
                    const isBalanced = c.status === 'Balanced';
                    const isShortage = c.status === 'Shortage';

                    return (
                      <div key={c.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-gray-900">{c.date}</span>
                            <span className="text-[10px] text-gray-400">{c.time}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-md">
                              {c.operator}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                              isBalanced 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : isShortage 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {c.status}: {c.discrepancy >= 0 ? '+' : ''}{c.discrepancy} Tk
                            </span>
                          </div>

                          <div className="text-xs text-gray-600 flex items-center gap-4">
                            <span>SIM: <strong>Tk {c.simClosingBalance.toLocaleString()}</strong></span>
                            <span>Drawer Cash: <strong>Tk {c.drawerCashCount.toLocaleString()}</strong></span>
                            <span>Total: <strong className="text-[#084b3e]">Tk {c.totalCalculatedBalance.toLocaleString()}</strong></span>
                          </div>

                          {c.note && (
                            <p className="text-[11px] text-gray-500 italic">{c.note}</p>
                          )}
                        </div>

                        {confirmDeleteId === c.id ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => c.id && handleDeleteClosing(c.id)}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => c.id && setConfirmDeleteId(c.id)}
                            title="Delete Record"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
