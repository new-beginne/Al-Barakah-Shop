import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ActivityLog } from '../db/db';
import { clearAllActivityLogs, deleteActivityLog } from '../services/activityLogService';
import { 
  History, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  Search, 
  Calendar, 
  Clock, 
  Filter, 
  Eye, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Download, 
  X,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { format, subDays, startOfMonth, parseISO } from 'date-fns';

export function HistoryView() {
  const rawLogs = useLiveQuery(() => db.activityLogs.orderBy('id').reverse().toArray()) || [];

  const [selectedActionFilter, setSelectedActionFilter] = useState<'all' | 'DELETE' | 'EDIT' | 'BULK_DELETE' | 'RESET'>('all');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'this_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

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

  // Clear all handler
  const handleConfirmClearAll = async () => {
    try {
      await clearAllActivityLogs();
      setIsClearAllOpen(false);
      setSuccessMsg('All activity history logs cleared successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Failed to clear logs.');
    }
  };

  // Delete single handler
  const handleConfirmDeleteSingle = async () => {
    if (!deleteTargetLog?.id) return;
    try {
      await deleteActivityLog(deleteTargetLog.id);
      setDeleteTargetLog(null);
      setSuccessMsg('History entry removed.');
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
    downloadAnchor.setAttribute('download', `albarakah_activity_history_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'DELETE':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <Trash2 size={12} className="shrink-0" />,
          label: 'Deleted',
        };
      case 'BULK_DELETE':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: <Layers size={12} className="shrink-0" />,
          label: 'Range Delete',
        };
      case 'RESET':
        return {
          bg: 'bg-red-100 text-red-800 border-red-300 font-black',
          icon: <AlertTriangle size={12} className="shrink-0" />,
          label: 'Data Reset',
        };
      case 'EDIT':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <Edit3 size={12} className="shrink-0" />,
          label: 'Edited',
        };
      default:
        return {
          bg: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: <Clock size={12} className="shrink-0" />,
          label: action,
        };
    }
  };

  return (
    <div className="p-4 md:p-6 mx-auto mb-16 md:mb-0 w-full max-w-7xl space-y-6 animate-in fade-in duration-200">
      
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#084b3e] flex items-center justify-center shadow-xs">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">
              Activity & History Logs
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Track all deletions, edits, range deletions, and database operations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportLogs}
            disabled={rawLogs.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200 cursor-pointer disabled:opacity-50"
            title="Download JSON audit log"
          >
            <Download size={15} />
            <span>Export JSON</span>
          </button>

          {rawLogs.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearAllOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center text-xs sm:text-sm font-bold animate-in fade-in">
          <CheckCircle2 className="mr-2 shrink-0 text-emerald-600" size={18} />
          {successMsg}
        </div>
      )}

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 block uppercase tracking-wider">
              Total Logged Events
            </span>
            <span className="text-2xl sm:text-3xl font-black text-gray-900 mt-1 block">
              {stats.totalLogs.toLocaleString()}
            </span>
            <span className="text-[11px] font-medium text-gray-400 mt-0.5 block">
              Chronological records
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center">
            <History size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-600 block uppercase tracking-wider">
              Deletions Recorded
            </span>
            <span className="text-2xl sm:text-3xl font-black text-rose-700 mt-1 block">
              {(stats.totalDeletes + stats.totalBulk).toLocaleString()}
            </span>
            <span className="text-[11px] font-medium text-rose-500/80 mt-0.5 block">
              {stats.totalBulk} bulk/range actions
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Trash2 size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-600 block uppercase tracking-wider">
              Edits Recorded
            </span>
            <span className="text-2xl sm:text-3xl font-black text-blue-700 mt-1 block">
              {stats.totalEdits.toLocaleString()}
            </span>
            <span className="text-[11px] font-medium text-blue-500/80 mt-0.5 block">
              Profiles & dues updated
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Edit3 size={24} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        
        {/* Action Type Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="font-bold text-gray-500 uppercase tracking-wider text-[11px] mr-1 hidden sm:inline">
            Action:
          </span>
          <button
            type="button"
            onClick={() => setSelectedActionFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              selectedActionFilter === 'all'
                ? 'bg-[#084b3e] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Actions ({rawLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedActionFilter('DELETE')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedActionFilter === 'DELETE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <Trash2 size={13} />
            <span>Deletions</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedActionFilter('EDIT')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedActionFilter === 'EDIT'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Edit3 size={13} />
            <span>Edits</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedActionFilter('BULK_DELETE')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedActionFilter === 'BULK_DELETE'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <Layers size={13} />
            <span>Range Deletes</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedActionFilter('RESET')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedActionFilter === 'RESET'
                ? 'bg-red-700 text-white shadow-xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Reset Events</span>
          </button>
        </div>

        {/* Search, Module & Date Range Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-gray-100">
          
          {/* Search Box */}
          <div className="sm:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title, description, ID, date..."
              className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:border-[#084b3e] outline-none transition-all"
            />
          </div>

          {/* Module Selector */}
          <div className="sm:col-span-3">
            <select
              value={selectedModuleFilter}
              onChange={e => setSelectedModuleFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-700 focus:bg-white focus:border-[#084b3e] outline-none cursor-pointer"
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
          </div>

          {/* Date Filter */}
          <div className="sm:col-span-4 flex gap-2">
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-700 focus:bg-white focus:border-[#084b3e] outline-none cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker when selected */}
        {dateFilter === 'custom' && (
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-center gap-3 text-xs font-bold animate-in fade-in">
            <span className="text-gray-500 uppercase tracking-wider">Date Range:</span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-xs bg-white focus:border-[#084b3e] outline-none font-medium"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-xs bg-white focus:border-[#084b3e] outline-none font-medium"
              />
            </div>
          </div>
        )}

      </div>

      {/* History Ledger Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <span className="text-xs font-black uppercase tracking-wider text-gray-600">
            Activity Ledger ({filteredLogs.length} Events)
          </span>
          <span className="text-[11px] text-gray-400 font-medium">
            Sorted newest first
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Description / Target</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredLogs.map(log => {
                const badge = getActionBadge(log.action);

                return (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Action badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    {/* Module badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg font-bold text-[11px]">
                        {log.module}
                      </span>
                    </td>

                    {/* Title and details */}
                    <td className="py-3 px-4 min-w-[240px]">
                      <div className="font-bold text-gray-900 leading-snug">
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
                      <div className="flex items-center gap-1.5 font-bold">
                        <Calendar size={13} className="text-gray-400" />
                        <span>{log.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
                        <Clock size={12} />
                        <span>{log.time}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectLog(log)}
                          className="px-2.5 py-1.5 text-xs font-bold text-[#084b3e] bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Inspect record details"
                        >
                          <Eye size={14} />
                          <span className="hidden sm:inline">Inspect</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetLog(log)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete this log entry"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100">
                        <History size={24} />
                      </div>
                      <p className="text-sm font-bold text-gray-600">No activity logs found</p>
                      <p className="text-xs text-gray-400 max-w-sm">
                        Deletions, edits, and bulk operations will appear here as they occur in the app.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Inspection Modal */}
      {inspectLog && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectLog(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-[#084b3e]">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 leading-tight">
                    Activity Details #{inspectLog.id}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {inspectLog.date} at {inspectLog.time}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Main Info */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Action Type</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${getActionBadge(inspectLog.action).bg}`}>
                  {inspectLog.action}
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Module</span>
                <span className="font-bold text-gray-900">{inspectLog.module}</span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px] block">Title</span>
                <p className="font-black text-gray-900 text-sm">{inspectLog.title}</p>
              </div>

              {inspectLog.details && (
                <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                  <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px] block">Details</span>
                  <p className="font-medium text-gray-700 leading-relaxed">{inspectLog.details}</p>
                </div>
              )}

              {/* JSON Metadata snapshot if exists */}
              {inspectLog.meta && (
                <div className="p-3 bg-gray-900 text-emerald-400 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Metadata Snapshot:</span>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(inspectLog.meta, null, 2)}</pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="px-5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
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
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTargetLog(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Remove History Record?</h3>
                <p className="text-xs text-gray-500">Log Entry #{deleteTargetLog.id}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to remove this record from the history logs? This will only remove the log entry, not alter your actual transactions.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteTargetLog(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
              >
                Delete Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All History Modal */}
      {isClearAllOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsClearAllOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-4 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>

            <h3 className="text-lg font-black text-gray-900">Clear All Activity History?</h3>

            <p className="text-xs text-gray-500 leading-relaxed">
              This will permanently delete all {rawLogs.length} audit and history entries from your device. Your sales, expenses, and accounts will NOT be affected.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllOpen(false)}
                className="flex-1 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
              >
                Clear All Logs
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
