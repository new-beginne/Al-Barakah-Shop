import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ActivityLog } from '../db/db';
import { clearAllActivityLogs, deleteActivityLog } from '../services/activityLogService';
import { 
  History, 
  Trash2, 
  Edit3, 
  Search, 
  Calendar, 
  Clock, 
  Eye, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Download, 
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCcw,
  Sparkles
} from 'lucide-react';
import { format, subDays, startOfMonth } from 'date-fns';

export function HistoryView() {
  const rawLogs = useLiveQuery(() => db.activityLogs.orderBy('id').reverse().toArray()) || [];

  const [selectedActionFilter, setSelectedActionFilter] = useState<'all' | 'DELETE' | 'EDIT' | 'BULK_DELETE' | 'RESET'>('all');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'this_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Modal inspection
  const [inspectLog, setInspectLog] = useState<ActivityLog | null>(null);

  // Clear all confirmation modal
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Delete single log target
  const [deleteTargetLog, setDeleteTargetLog] = useState<ActivityLog | null>(null);

  // Stats calculation
  const stats = useMemo(() => {
    let totalDeletes = 0;
    let totalEdits = 0;
    let totalBulk = 0;

    rawLogs.forEach(log => {
      if (log.action === 'DELETE') totalDeletes++;
      else if (log.action === 'EDIT') totalEdits++;
      else if (log.action === 'BULK_DELETE' || log.action === 'RESET') totalBulk++;
    });

    return {
      totalLogs: rawLogs.length,
      totalDeletes,
      totalEdits,
      totalBulk,
    };
  }, [rawLogs]);

  // Filtering
  const filteredLogs = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const sevenDaysAgoStr = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const startOfCurrentMonthStr = format(startOfMonth(new Date()), 'yyyy-MM-dd');

    return rawLogs.filter(log => {
      // Action filter
      if (selectedActionFilter !== 'all') {
        if (selectedActionFilter === 'DELETE') {
          if (log.action !== 'DELETE' && log.action !== 'BULK_DELETE') return false;
        } else if (log.action !== selectedActionFilter) {
          return false;
        }
      }

      // Module filter
      if (selectedModuleFilter !== 'all' && log.module !== selectedModuleFilter) {
        return false;
      }

      // Date filter
      if (dateFilter === 'today' && log.date !== todayStr) return false;
      if (dateFilter === '7days' && log.date < sevenDaysAgoStr) return false;
      if (dateFilter === 'this_month' && log.date < startOfCurrentMonthStr) return false;
      if (dateFilter === 'custom') {
        if (customStartDate && log.date < customStartDate) return false;
        if (customEndDate && log.date > customEndDate) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = log.title?.toLowerCase().includes(q);
        const detailsMatch = log.details?.toLowerCase().includes(q);
        const moduleMatch = log.module?.toLowerCase().includes(q);
        const dateMatch = log.date?.includes(q);
        const idMatch = log.id?.toString().includes(q);
        if (!titleMatch && !detailsMatch && !moduleMatch && !dateMatch && !idMatch) {
          return false;
        }
      }

      return true;
    });
  }, [rawLogs, selectedActionFilter, selectedModuleFilter, dateFilter, customStartDate, customEndDate, searchQuery]);

  // Paginated records
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIdx, startIdx + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Reset to page 1 on filter changes
  const handleActionFilterChange = (filter: 'all' | 'DELETE' | 'EDIT' | 'BULK_DELETE' | 'RESET') => {
    setSelectedActionFilter(filter);
    setCurrentPage(1);
  };

  const handleModuleFilterChange = (mod: string) => {
    setSelectedModuleFilter(mod);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (d: 'all' | 'today' | '7days' | 'this_month' | 'custom') => {
    setDateFilter(d);
    setCurrentPage(1);
  };

  // Clear all handler
  const handleConfirmClearAll = async () => {
    try {
      await clearAllActivityLogs();
      setIsClearAllOpen(false);
      setSuccessMsg('Activity logs cleared successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete single handler
  const handleConfirmDeleteSingle = async () => {
    if (!deleteTargetLog?.id) return;
    try {
      await deleteActivityLog(deleteTargetLog.id);
      setDeleteTargetLog(null);
      setSuccessMsg('Record removed from history.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Export logs to JSON
  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rawLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `albarakah_history_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'DELETE':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-100',
          dot: 'bg-rose-500',
          label: 'Deleted',
        };
      case 'BULK_DELETE':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-100',
          dot: 'bg-purple-500',
          label: 'Range Delete',
        };
      case 'RESET':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
          label: 'Data Reset',
        };
      case 'EDIT':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-100',
          dot: 'bg-blue-500',
          label: 'Edited',
        };
      default:
        return {
          bg: 'bg-gray-50 text-gray-700 border-gray-100',
          dot: 'bg-gray-400',
          label: action,
        };
    }
  };

  return (
    <div className="p-4 md:p-6 mx-auto mb-16 md:mb-0 w-full max-w-7xl space-y-4 animate-in fade-in duration-200">
      
      {/* Minimal Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Activity History
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#084b3e] border border-emerald-100">
              {rawLogs.length} logs
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Automatic audit trail for all edits, deletions, and database operations.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportLogs}
            disabled={rawLogs.length === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Export JSON audit log"
          >
            <Download size={14} className="text-gray-500" />
            <span>Export</span>
          </button>

          {rawLogs.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearAllOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 shadow-2xs transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="mr-2 shrink-0 text-emerald-600" size={16} />
          {successMsg}
        </div>
      )}

      {/* Minimal Stat Strip (3 sleek cards) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-400 block uppercase tracking-wider">
            Total Logged
          </span>
          <div className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5">
            {stats.totalLogs.toLocaleString()}
          </div>
        </div>

        <div className="bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-600 block uppercase tracking-wider">
            Edits
          </span>
          <div className="text-xl sm:text-2xl font-black text-blue-700 mt-0.5">
            {stats.totalEdits.toLocaleString()}
          </div>
        </div>

        <div className="bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-rose-600 block uppercase tracking-wider">
            Deletions
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-700 mt-0.5">
            {(stats.totalDeletes + stats.totalBulk).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Main Card: Filters & Ledger Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-5 space-y-4">
        
        {/* Minimal Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl">
          <button
            type="button"
            onClick={() => handleActionFilterChange('all')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedActionFilter === 'all'
                ? 'bg-[#084b3e] text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              selectedActionFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {rawLogs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleActionFilterChange('DELETE')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedActionFilter === 'DELETE'
                ? 'bg-[#084b3e] text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <span>Deletions</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              selectedActionFilter === 'DELETE' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {stats.totalDeletes + stats.totalBulk}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleActionFilterChange('EDIT')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedActionFilter === 'EDIT'
                ? 'bg-[#084b3e] text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <span>Edits</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              selectedActionFilter === 'EDIT' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {stats.totalEdits}
            </span>
          </button>

          {stats.totalBulk > 0 && (
            <button
              type="button"
              onClick={() => handleActionFilterChange('BULK_DELETE')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedActionFilter === 'BULK_DELETE'
                  ? 'bg-[#084b3e] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              <span>Range / Reset</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                selectedActionFilter === 'BULK_DELETE' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {stats.totalBulk}
              </span>
            </button>
          )}
        </div>

        {/* Minimal Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by title, details, date..."
              className="w-full pl-9 pr-8 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:border-[#084b3e] outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Module Selector */}
          <select
            value={selectedModuleFilter}
            onChange={e => handleModuleFilterChange(e.target.value)}
            className="px-3 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-gray-700 focus:bg-white focus:border-[#084b3e] outline-none cursor-pointer sm:w-44 shrink-0"
          >
            <option value="all">All Modules</option>
            <option value="Sales">Sales</option>
            <option value="Expenses">Expenses</option>
            <option value="MFS">MFS</option>
            <option value="Customers">Customers</option>
            <option value="Dues">Dues</option>
            <option value="Borrowings">Borrowings</option>
            <option value="Services">Services</option>
            <option value="Balance">Balance</option>
            <option value="All Data">All Data / Range</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={e => handleDateFilterChange(e.target.value as any)}
            className="px-3 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-gray-700 focus:bg-white focus:border-[#084b3e] outline-none cursor-pointer sm:w-36 shrink-0"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="this_month">This Month</option>
            <option value="custom">Custom...</option>
          </select>
        </div>

        {/* Custom Date Inputs when 'custom' is active */}
        {dateFilter === 'custom' && (
          <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500 font-bold uppercase text-[10px]">Range:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={e => {
                setCustomStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white focus:border-[#084b3e] outline-none"
            />
            <span className="text-gray-400 font-bold">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => {
                setCustomEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white focus:border-[#084b3e] outline-none"
            />
          </div>
        )}

        {/* Table View */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/80 text-gray-500 font-bold text-xs uppercase tracking-wider border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Event Description</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {paginatedLogs.map(log => {
                const badge = getActionBadge(log.action);

                return (
                  <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                    {/* Action badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    {/* Module */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md font-semibold text-[11px]">
                        {log.module}
                      </span>
                    </td>

                    {/* Title and details */}
                    <td className="py-3 px-4 max-w-xs sm:max-w-md whitespace-normal">
                      <div className="font-semibold text-gray-900 leading-snug">
                        {log.title}
                      </div>
                      {log.details && (
                        <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                          {log.details}
                        </div>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                      <div className="font-semibold text-gray-800">
                        {log.date}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {log.time}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setInspectLog(log)}
                          className="p-1.5 text-gray-500 hover:text-[#084b3e] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetLog(log)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete from log"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100">
                        <History size={20} />
                      </div>
                      <p className="text-xs font-bold text-gray-600">No activity records found</p>
                      <p className="text-[11px] text-gray-400">
                        Edits, deletions, and updates will be logged here automatically.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Minimal Pagination & Footer */}
        {filteredLogs.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-gray-100 text-xs">
            <div className="text-gray-500 font-medium text-[11px]">
              Showing <span className="font-bold text-gray-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-gray-800">
                {Math.min(currentPage * pageSize, filteredLogs.length)}
              </span>{' '}
              of <span className="font-bold text-gray-800">{filteredLogs.length}</span> logs
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft size={15} />
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <React.Fragment key={p}>
                          {prev && p - prev > 1 && <span className="px-1 text-gray-400 text-[10px]">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={`min-w-6 h-6 px-1.5 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                              currentPage === p
                                ? 'bg-[#084b3e] text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Minimal Log Inspection Modal */}
      {inspectLog && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectLog(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-3.5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-gray-100 pb-2.5">
              <div>
                <h3 className="text-sm font-black text-gray-900 leading-tight">
                  Activity Record #{inspectLog.id}
                </h3>
                <p className="text-[11px] text-gray-400 font-medium">
                  {inspectLog.date} • {inspectLog.time}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-gray-500 font-medium">Action</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${getActionBadge(inspectLog.action).bg}`}>
                  {inspectLog.action}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-gray-500 font-medium">Module</span>
                <span className="font-bold text-gray-900">{inspectLog.module}</span>
              </div>

              <div className="py-1.5 border-b border-gray-50">
                <span className="text-gray-500 font-medium block text-[11px]">Title</span>
                <p className="font-bold text-gray-900 mt-0.5">{inspectLog.title}</p>
              </div>

              {inspectLog.details && (
                <div className="py-1.5 border-b border-gray-50">
                  <span className="text-gray-500 font-medium block text-[11px]">Details</span>
                  <p className="text-gray-700 mt-0.5 leading-relaxed">{inspectLog.details}</p>
                </div>
              )}

              {/* JSON Metadata snapshot if exists */}
              {inspectLog.meta && (
                <div className="p-2.5 bg-gray-900 text-emerald-400 rounded-xl font-mono text-[10px] max-h-40 overflow-y-auto mt-2">
                  <span className="text-[10px] text-gray-400 font-bold block mb-1">Payload / Snapshot:</span>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(inspectLog.meta, null, 2)}</pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="px-4 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Log Modal */}
      {deleteTargetLog && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTargetLog(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-sm font-black text-gray-900">Remove from History?</h3>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              This will only remove this audit log entry from your device. Your actual sales, expenses, and accounts will not be affected.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteTargetLog(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All History Modal */}
      {isClearAllOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsClearAllOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-3 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={20} />
            </div>

            <h3 className="text-sm font-black text-gray-900">Clear All Activity History?</h3>

            <p className="text-xs text-gray-500 leading-relaxed">
              This will permanently delete all {rawLogs.length} audit records. Your sales, expenses, customer accounts, and cash balances will NOT be altered.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllOpen(false)}
                className="flex-1 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
