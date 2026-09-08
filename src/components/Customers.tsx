import React, { useState, useMemo } from 'react';
import { db, Customer } from '../db/db';
import { adjustAccountBalance, mapPaymentMethodToAccountId } from '../services/accountService';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  MapPin, 
  FileText, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Save, 
  PhoneCall, 
  MessageSquare,
  Clock,
  ArrowUpRight,
  UserCheck,
  DollarSign,
  Coins,
  Check,
  LayoutGrid,
  List,
  ArrowUpDown,
  User
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function Customers() {
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'clear'>('all');
  const [sortBy, setSortBy] = useState<'highest-due' | 'name' | 'newest'>('highest-due');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Delete modal state
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState<Customer | null>(null);

  // Customer Ledger modal state
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);

  // Collect Due modal state
  const [collectDueCustomer, setCollectDueCustomer] = useState<Customer | null>(null);
  const [collectDueAmount, setCollectDueAmount] = useState('');
  const [collectDueMethod, setCollectDueMethod] = useState<'Cash' | 'bKash' | 'Nagad' | 'Rocket' | 'Bank'>('Cash');
  const [collectDueNote, setCollectDueNote] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  // Live queries
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const dues = useLiveQuery(() => db.dues.toArray()) || [];
  const sales = useLiveQuery(() => db.sales.toArray()) || [];

  // Calculate customer financial metrics
  const customerDueMap = useMemo(() => {
    const map = new Map<string, { totalDue: number; totalPaid: number; pendingDue: number; count: number }>();
    dues.forEach(d => {
      const keyPhone = d.phone?.trim();
      const keyName = d.customerName?.trim().toLowerCase();
      const key = keyPhone || keyName;
      if (!key) return;

      const current = map.get(key) || { totalDue: 0, totalPaid: 0, pendingDue: 0, count: 0 };
      current.totalDue += d.totalAmount || 0;
      current.totalPaid += d.paidAmount || 0;
      current.pendingDue += Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
      current.count += 1;
      map.set(key, current);
    });
    return map;
  }, [dues]);

  const getCustomerDueInfo = (c: Customer) => {
    const keyPhone = c.phone?.trim();
    const keyName = c.name?.trim().toLowerCase();
    return (keyPhone && customerDueMap.get(keyPhone)) || (keyName && customerDueMap.get(keyName)) || {
      totalDue: 0,
      totalPaid: 0,
      pendingDue: 0,
      count: 0
    };
  };

  // Top metric stats
  const totalCustomers = customers.length;
  const customersWithDueCount = customers.filter(c => getCustomerDueInfo(c).pendingDue > 0).length;
  const totalOutstandingDue = customers.reduce((sum, c) => sum + getCustomerDueInfo(c).pendingDue, 0);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const dueInfo = getCustomerDueInfo(c);
      if (statusFilter === 'due') return dueInfo.pendingDue > 0;
      if (statusFilter === 'clear') return dueInfo.pendingDue <= 0;
      return true;
    });
  }, [customers, searchQuery, statusFilter, customerDueMap]);

  // Sorted customers
  const sortedAndFilteredCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      const dueA = getCustomerDueInfo(a).pendingDue;
      const dueB = getCustomerDueInfo(b).pendingDue;

      if (sortBy === 'highest-due') {
        if (dueB !== dueA) return dueB - dueA;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'newest') {
        return (b.id || 0) - (a.id || 0);
      }
      return 0;
    });
  }, [filteredCustomers, sortBy, customerDueMap]);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const now = new Date().toISOString();

    if (editingCustomerId) {
      await db.customers.update(editingCustomerId, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
        updatedAt: now,
      });
      setSuccessMsg('Customer updated successfully.');
    } else {
      await db.customers.add({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
        createdAt: now,
        updatedAt: now,
      });
      setSuccessMsg('Customer added successfully.');
    }

    handleCancelForm();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleStartEdit = (c: Customer) => {
    setEditingCustomerId(c.id!);
    setName(c.name);
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setNotes(c.notes || '');
    setIsFormOpen(true);
  };

  const handleCancelForm = () => {
    setEditingCustomerId(null);
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setIsFormOpen(false);
  };

  const confirmDeleteCustomer = async () => {
    if (!deleteCustomerTarget?.id) return;
    try {
      await db.customers.delete(deleteCustomerTarget.id);
      setSuccessMsg(`"${deleteCustomerTarget.name}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteCustomerTarget(null);
    }
  };

  const handleOpenCollectDue = (c: Customer) => {
    const dueInfo = getCustomerDueInfo(c);
    setCollectDueCustomer(c);
    setCollectDueAmount(dueInfo.pendingDue > 0 ? dueInfo.pendingDue.toString() : '');
    setCollectDueMethod('Cash');
    setCollectDueNote('');
  };

  const handleConfirmCollectDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectDueCustomer) return;

    const amountToCollect = parseFloat(collectDueAmount);
    if (isNaN(amountToCollect) || amountToCollect <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    setIsCollecting(true);

    try {
      const customerDues = dues.filter(d => 
        (collectDueCustomer.phone && d.phone?.trim() === collectDueCustomer.phone.trim()) ||
        (d.customerName?.trim().toLowerCase() === collectDueCustomer.name.trim().toLowerCase())
      ).filter(d => (d.totalAmount || 0) > (d.paidAmount || 0));

      customerDues.sort((a, b) => {
        if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.id || 0) - (b.id || 0);
      });

      let remainingToAllocate = amountToCollect;
      const nowIso = new Date().toISOString();

      if (customerDues.length > 0) {
        for (const d of customerDues) {
          if (remainingToAllocate <= 0) break;
          const currentTotal = d.totalAmount || 0;
          const currentPaid = d.paidAmount || 0;
          const currentRemaining = Math.max(0, currentTotal - currentPaid);
          if (currentRemaining <= 0) continue;

          const payment = Math.min(remainingToAllocate, currentRemaining);
          const newPaid = currentPaid + payment;
          const newStatus = newPaid >= currentTotal ? 'Paid' : 'Partial';

          await db.dues.update(d.id!, {
            paidAmount: newPaid,
            status: newStatus,
            updatedAt: nowIso
          });

          remainingToAllocate -= payment;
        }
      }

      setSuccessMsg(`Collected Tk ${amountToCollect.toLocaleString()} from "${collectDueCustomer.name}".`);
      
      // Update corresponding account with collected money
      try {
        const targetAccountId = mapPaymentMethodToAccountId(collectDueMethod) || 'cash';
        await adjustAccountBalance(targetAccountId, amountToCollect);
      } catch (err) {
        console.error('Failed to update account balance on due collection:', err);
      }

      setCollectDueCustomer(null);
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      console.error('Error collecting due:', err);
      alert('Failed to record due collection.');
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto mb-16 md:mb-0 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Customers
            </h1>
            <span className="text-xs font-black bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full border border-gray-100">
              {totalCustomers}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Profiles, dues balance and ledger history
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            handleCancelForm();
            setIsFormOpen(true);
          }}
          className="flex items-center gap-1.5 bg-[#084b3e] hover:bg-[#126b55] active:scale-95 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-sm cursor-pointer"
        >
          <UserPlus size={16} />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-gray-100 border border-[#084b3e] rounded-xl flex items-center text-gray-900 font-bold text-xs sm:text-sm tracking-wider uppercase">
          <CheckCircle2 className="mr-2 shrink-0 text-gray-900" size={18} />
          {successMsg}
        </div>
      )}

      {/* Metric Cards - Sleek Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Customers</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{totalCustomers}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">With Balance Due</p>
            <p className="text-2xl font-black text-red-600 mt-0.5">{customersWithDueCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Due Balance</p>
            <p className="text-2xl font-black text-red-600 mt-0.5">Tk {totalOutstandingDue.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#084b3e] text-white flex items-center justify-center">
            <span className="font-black text-xs">TK</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search + Filters + Sort + View Mode */}
      <div className="bg-white p-3.5 rounded-[20px] border border-gray-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, phone, address..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-[#084b3e] focus:bg-white focus:ring-1 focus:ring-[#084b3e] outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200/60 text-gray-500 hover:bg-gray-300 hover:text-gray-900 transition-colors"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Filters, Sort & View Mode Toggle */}
        <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
          {/* Status Filter Pills */}
          <div className="flex gap-1 p-1 bg-gray-100/80 rounded-xl border border-gray-200/50">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-[8px] text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              All ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('due')}
              className={`px-3 py-1.5 rounded-[8px] text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                statusFilter === 'due' ? 'bg-white text-red-600 shadow-[0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-500 hover:text-red-600 hover:bg-gray-200/50'
              }`}
            >
              Due ({customersWithDueCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('clear')}
              className={`px-3 py-1.5 rounded-[8px] text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                statusFilter === 'clear' ? 'bg-white text-emerald-700 shadow-[0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-500 hover:text-emerald-700 hover:bg-gray-200/50'
              }`}
            >
              Paid ({customers.length - customersWithDueCount})
            </button>
          </div>

          <div className="w-[1px] h-6 bg-gray-200 hidden sm:block"></div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <ArrowUpDown size={14} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-[11px] font-bold text-gray-700 outline-none uppercase tracking-wider cursor-pointer pr-2"
            >
              <option value="highest-due">Highest Due</option>
              <option value="name">Name (A-Z)</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100/80 p-1 rounded-xl border border-gray-200/50 ml-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-[8px] transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid Cards"
              className={`p-1.5 rounded-[8px] transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Directory View */}
      {sortedAndFilteredCustomers.length > 0 ? (
        viewMode === 'table' ? (
          /* TABLE LIST VIEW - BEAUTIFULLY STYLED ROWS */
          <div className="bg-white rounded-[24px] border border-gray-200/80 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-gray-50/90 border-b border-gray-200/80 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-6 font-black">Customer</th>
                    <th className="py-4 px-6 font-black">Contact</th>
                    <th className="py-4 px-6 font-black text-right">Balance</th>
                    <th className="py-4 px-6 font-black text-right pr-7">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {sortedAndFilteredCustomers.map(c => {
                    const dueInfo = getCustomerDueInfo(c);
                    const hasDue = dueInfo.pendingDue > 0;
                    const cleanPhone = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';

                    return (
                      <tr 
                        key={c.id}
                        className={`transition-all duration-150 group ${
                          hasDue 
                            ? 'bg-red-50/20 hover:bg-red-50/40 border-l-4 border-l-red-500' 
                            : 'hover:bg-gray-50/80 border-l-4 border-l-transparent hover:border-l-[#084b3e]/40'
                        }`}
                      >
                        {/* Customer */}
                        <td className="py-4.5 px-6 align-middle">
                          <Link
                            to={`/customers/${c.id}`}
                            className="flex items-center gap-3.5 group/link cursor-pointer"
                            title={`View ${c.name}'s Profile & Statement`}
                          >
                            <div className={`w-10.5 h-10.5 rounded-2xl flex items-center justify-center font-black text-xs uppercase shrink-0 transition-transform duration-150 group-hover/link:scale-105 shadow-xs ${
                              hasDue 
                                ? 'bg-red-100/80 text-red-700 border border-red-200' 
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                              {c.name.slice(0, 2)}
                            </div>
                            <div className="overflow-hidden">
                              <span className="font-black text-gray-900 text-sm block truncate group-hover/link:text-[#084b3e] transition-colors" title={c.name}>
                                {c.name}
                              </span>
                              {c.address ? (
                                <span className="text-[12px] text-gray-500 flex items-center gap-1.5 truncate mt-0.5 font-medium">
                                  <MapPin size={12} className="shrink-0 text-gray-400" />
                                  <span className="truncate">{c.address}</span>
                                </span>
                              ) : c.notes ? (
                                <span className="text-[12px] text-gray-400 italic block truncate mt-0.5">
                                  {c.notes}
                                </span>
                              ) : null}
                            </div>
                          </Link>
                        </td>

                        {/* Contact */}
                        <td className="py-4.5 px-6 align-middle">
                          {c.phone ? (
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-gray-800 text-xs sm:text-sm tracking-wide font-mono">
                                {c.phone}
                              </span>
                              <div className="flex items-center gap-1">
                                <a
                                  href={`tel:${c.phone}`}
                                  title="Direct Call"
                                  className="w-7.5 h-7.5 rounded-xl border border-gray-200 bg-white text-gray-600 inline-flex items-center justify-center shadow-xs hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300 active:scale-95 transition-all duration-150"
                                >
                                  <PhoneCall size={13} />
                                </a>
                                {cleanPhone && (
                                  <a
                                    href={`https://wa.me/88${cleanPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Chat on WhatsApp"
                                    className="w-7.5 h-7.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 inline-flex items-center justify-center shadow-xs hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:shadow-xs active:scale-95 transition-all duration-150"
                                  >
                                    <MessageSquare size={13} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-medium text-xs">—</span>
                          )}
                        </td>

                        {/* Balance */}
                        <td className="py-4.5 px-6 text-right align-middle">
                          {hasDue ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-red-600 font-black text-sm sm:text-base leading-none tracking-tight">
                                Tk {dueInfo.pendingDue.toLocaleString()}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100/70 px-2 py-0.5 rounded-md border border-red-200 leading-none">
                                DUE
                              </span>
                            </div>
                          ) : (
                            <span className="text-emerald-700 font-bold text-xs inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <UserCheck size={13} className="text-emerald-600" />
                              <span>Clear</span>
                            </span>
                          )}
                        </td>

                        {/* Actions - Fixed Design with Distinct Hover Effects */}
                        <td className="py-4.5 px-6 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Profile Button */}
                            <Link
                              to={`/customers/${c.id}`}
                              title={`View ${c.name}'s Profile & Statement`}
                              className="h-8.5 px-3 min-w-[78px] rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300 active:scale-95 transition-all duration-150"
                            >
                              <User size={13} className="shrink-0 text-gray-500" />
                              <span>Profile</span>
                            </Link>

                            {/* Collect Due Button */}
                            {hasDue && (
                              <button
                                type="button"
                                onClick={() => handleOpenCollectDue(c)}
                                title="Collect Due Payment"
                                className="h-8.5 px-3 min-w-[82px] rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs hover:bg-red-600 hover:text-white hover:border-red-600 hover:shadow-md hover:shadow-red-500/20 active:scale-95 transition-all duration-150 cursor-pointer"
                              >
                                <DollarSign size={13} strokeWidth={2.5} className="shrink-0" />
                                <span>Collect</span>
                              </button>
                            )}

                            {/* New Sale Button */}
                            <Link
                              to={`/sales?customer=${encodeURIComponent(c.name)}&phone=${encodeURIComponent(c.phone || '')}`}
                              title="Create New Sale"
                              className="h-8.5 px-3 min-w-[74px] rounded-xl border border-[#084b3e] bg-[#084b3e] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs hover:bg-[#126b55] hover:border-[#126b55] hover:shadow-md hover:shadow-[#084b3e]/25 active:scale-95 transition-all duration-150"
                            >
                              <span>Sale</span>
                              <ArrowUpRight size={13} strokeWidth={2.5} className="shrink-0" />
                            </Link>

                            {/* Divider */}
                            <div className="w-[1px] h-4 bg-gray-200 mx-0.5 shrink-0"></div>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(c)}
                              title="Edit Customer Details"
                              className="w-8.5 h-8.5 rounded-xl border border-gray-200 bg-white text-gray-500 inline-flex items-center justify-center shadow-xs hover:bg-[#084b3e]/10 hover:text-[#084b3e] hover:border-[#084b3e]/30 active:scale-95 transition-all duration-150 cursor-pointer shrink-0"
                            >
                              <Edit2 size={13} />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => setDeleteCustomerTarget(c)}
                              title="Delete Customer"
                              className="w-8.5 h-8.5 rounded-xl border border-gray-200 bg-white text-gray-400 inline-flex items-center justify-center shadow-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 transition-all duration-150 cursor-pointer shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* MODERN COMPACT GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {sortedAndFilteredCustomers.map(c => {
              const dueInfo = getCustomerDueInfo(c);
              const hasDue = dueInfo.pendingDue > 0;
              const cleanPhone = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';

              return (
                <div 
                  key={c.id} 
                  className={`bg-white rounded-[20px] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] transition-all flex flex-col justify-between border ${
                    hasDue ? 'border-red-100 hover:border-red-200 hover:shadow-[0_4px_16px_-4px_rgba(220,38,38,0.08)]' : 'border-gray-100 hover:border-gray-200 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]'
                  }`}
                >
                  <div>
                    {/* Top Row: Avatar + Name + Actions */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <Link 
                        to={`/customers/${c.id}`}
                        className="flex items-center gap-3.5 min-w-0 group cursor-pointer"
                        title={`View ${c.name}'s Profile & Statement`}
                      >
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-[14px] uppercase shrink-0 transition-transform group-hover:scale-105 border ${
                          hasDue ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {c.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm truncate group-hover:text-[#084b3e] transition-colors" title={c.name}>
                            {c.name}
                          </h3>
                          {c.address ? (
                            <p className="text-[12px] text-gray-500 flex items-center gap-1.5 truncate mt-0.5 font-medium">
                              <MapPin size={12} className="shrink-0 text-gray-400" />
                              <span className="truncate">{c.address}</span>
                            </p>
                          ) : (
                            <span className="text-[12px] text-gray-400 font-medium">View Profile</span>
                          )}
                        </div>
                      </Link>

                      {/* Edit & Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(c)}
                          title="Edit Customer Details"
                          className="w-8 h-8 rounded-xl border border-gray-200 bg-white text-gray-500 inline-flex items-center justify-center shadow-xs hover:bg-[#084b3e]/10 hover:text-[#084b3e] hover:border-[#084b3e]/30 active:scale-95 transition-all duration-150 cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCustomerTarget(c)}
                          title="Delete Customer"
                          className="w-8 h-8 rounded-xl border border-gray-200 bg-white text-gray-400 inline-flex items-center justify-center shadow-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 transition-all duration-150 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Phone & Shortcuts */}
                    {c.phone ? (
                      <div className="flex items-center justify-between bg-gray-50/50 rounded-xl p-2.5 mb-4 border border-gray-100/80 text-sm">
                        <span className="font-semibold text-gray-700 tracking-wide truncate">{c.phone}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`tel:${c.phone}`}
                            title="Call"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all"
                          >
                            <PhoneCall size={13} />
                          </a>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/88${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="WhatsApp"
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all"
                            >
                              <MessageSquare size={13} />
                            </a>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Notes if any */}
                    {c.notes && (
                      <p className="text-[12px] text-gray-500 mb-4 bg-gray-50/50 p-2.5 rounded-lg border border-dashed border-gray-200 line-clamp-2 leading-relaxed">
                        {c.notes}
                      </p>
                    )}
                  </div>

                  {/* Financial Footer */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Balance</p>
                      {hasDue ? (
                        <p className="text-[15px] font-bold text-red-600 leading-none">
                          Tk {dueInfo.pendingDue.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-gray-500 flex items-center gap-1.5 leading-none">
                          <UserCheck size={14} className="text-gray-400" /> Clear
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <Link
                        to={`/customers/${c.id}`}
                        title={`View ${c.name}'s Profile & Statement`}
                        className="h-8.5 px-3 min-w-[76px] rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300 active:scale-95 transition-all duration-150"
                      >
                        <User size={13} className="shrink-0 text-gray-500" />
                        <span>Profile</span>
                      </Link>

                      {hasDue && (
                        <button
                          type="button"
                          onClick={() => handleOpenCollectDue(c)}
                          className="h-8.5 px-3 min-w-[80px] rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs hover:bg-red-600 hover:text-white hover:border-red-600 hover:shadow-md hover:shadow-red-500/20 active:scale-95 transition-all duration-150 cursor-pointer"
                          title="Collect Due Payment"
                        >
                          <DollarSign size={13} strokeWidth={2.5} className="shrink-0" />
                          <span>Collect</span>
                        </button>
                      )}

                      <Link
                        to={`/sales?customer=${encodeURIComponent(c.name)}&phone=${encodeURIComponent(c.phone || '')}`}
                        title="Create New Sale"
                        className="h-8.5 px-3 min-w-[74px] rounded-xl border border-[#084b3e] bg-[#084b3e] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs hover:bg-[#126b55] hover:border-[#126b55] hover:shadow-md hover:shadow-[#084b3e]/25 active:scale-95 transition-all duration-150"
                      >
                        <span>Sale</span>
                        <ArrowUpRight size={13} strokeWidth={2.5} className="shrink-0" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Empty State */
        <div className="bg-white rounded-[20px] border border-gray-100 p-12 text-center shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)]">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <Users size={32} strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1.5">
            {searchQuery ? 'No customers found' : 'No customers yet'}
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
            {searchQuery
              ? 'No customer records match your filter criteria.'
              : 'Add customer profiles to track sales history and dues.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="bg-[#084b3e] text-white px-5 py-2.5 rounded-xl font-bold text-[13px] hover:bg-[#126b55] shadow-[0_2px_8px_-2px_rgba(8,75,62,0.3)] transition-all cursor-pointer"
            >
              Add Customer
            </button>
          )}
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isFormOpen && (
        <div 
          className="fixed inset-0 bg-[#084b3e]/20 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={handleCancelForm}
        >
          <div 
            className="bg-white rounded-[24px] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-gray-100">
              <h2 className="text-sm sm:text-base font-bold text-gray-900">
                {editingCustomerId ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button
                type="button"
                onClick={handleCancelForm}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. John Doe, Mizan"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-[14px] focus:bg-white focus:border-[#084b3e] focus:ring-1 focus:ring-[#084b3e] outline-none text-sm transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="01712345678"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-[14px] focus:bg-white focus:border-[#084b3e] focus:ring-1 focus:ring-[#084b3e] outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                  Address / Location
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. Shop 3, Market Rd"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-[14px] focus:bg-white focus:border-[#084b3e] focus:ring-1 focus:ring-[#084b3e] outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Regular studio client"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-[14px] focus:bg-white focus:border-[#084b3e] focus:ring-1 focus:ring-[#084b3e] outline-none text-sm transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="flex-1 py-3 rounded-[14px] border border-gray-200 text-gray-700 font-bold text-[13px] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-[14px] bg-[#084b3e] hover:bg-[#126b55] text-white font-bold text-[13px] flex items-center justify-center gap-2 shadow-[0_2px_8px_-2px_rgba(8,75,62,0.3)] transition-all cursor-pointer"
                >
                  <Save size={16} />
                  <span>{editingCustomerId ? 'Update' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger / History Modal */}
      {ledgerCustomer && (
        <div 
          className="fixed inset-0 bg-[#084b3e]/20 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => setLedgerCustomer(null)}
        >
          <div 
            className="bg-white rounded-[24px] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#084b3e] flex items-center justify-center font-bold text-sm border border-emerald-100">
                  {ledgerCustomer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {ledgerCustomer.name}
                  </h3>
                  <p className="text-[12px] text-gray-500 flex items-center gap-3 mt-0.5 font-medium">
                    {ledgerCustomer.phone && <span className="flex items-center gap-1.5"><PhoneCall size={12} className="text-gray-400" /> {ledgerCustomer.phone}</span>}
                    {ledgerCustomer.address && <span className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-400" /> {ledgerCustomer.address}</span>}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLedgerCustomer(null)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              {/* Summary Banner */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-[16px] border border-gray-100">
                  <span className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">Total Recorded</span>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    Tk {getCustomerDueInfo(ledgerCustomer).totalDue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-[16px] border border-red-100 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">Outstanding Balance</span>
                    <p className="text-xl font-bold text-red-600 mt-1">
                      Tk {getCustomerDueInfo(ledgerCustomer).pendingDue.toLocaleString()}
                    </p>
                  </div>
                  {getCustomerDueInfo(ledgerCustomer).pendingDue > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const c = ledgerCustomer;
                        setLedgerCustomer(null);
                        handleOpenCollectDue(c);
                      }}
                      className="mt-3 text-[12px] font-bold text-red-700 bg-red-100 hover:bg-red-200 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <DollarSign size={14} strokeWidth={2.5} />
                      <span>Collect Due</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Dues History */}
              <div>
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-900 mb-3 flex items-center gap-2">
                  <FileText size={14} className="text-gray-400" />
                  Dues History
                </h4>
                {(() => {
                  const customerDues = dues.filter(d => 
                    (ledgerCustomer.phone && d.phone?.trim() === ledgerCustomer.phone.trim()) ||
                    (d.customerName?.trim().toLowerCase() === ledgerCustomer.name.trim().toLowerCase())
                  );

                  if (customerDues.length === 0) {
                    return (
                      <p className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-[16px] border border-dashed border-gray-200 font-medium">
                        No due records for this customer.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {customerDues.map(d => {
                        const remaining = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
                        return (
                          <div key={d.id} className="p-4 bg-white border border-gray-200 rounded-[16px] flex items-center justify-between text-sm shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)]">
                            <div>
                              <p className="font-bold text-gray-900">Date: {d.date || 'N/A'}</p>
                              <p className="text-gray-500 text-[12px] mt-1 font-medium">
                                Total: Tk {d.totalAmount} | Paid: Tk {d.paidAmount}
                              </p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1.5">
                              <span className={`px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider ${
                                d.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {d.status === 'Paid' ? 'Paid' : `Due Tk ${remaining.toLocaleString()}`}
                              </span>
                              {remaining > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const c = ledgerCustomer;
                                    setLedgerCustomer(null);
                                    handleOpenCollectDue(c);
                                    setCollectDueAmount(remaining.toString());
                                  }}
                                  className="text-[10px] font-bold text-red-600 hover:text-white hover:bg-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 transition-colors inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                  <DollarSign size={10} />
                                  <span>Collect</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setLedgerCustomer(null)}
                className="px-4 py-2 rounded-xl bg-[#084b3e] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#126b55]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCustomerTarget && (
        <div 
          className="fixed inset-0 bg-[#084b3e]/20 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => setDeleteCustomerTarget(null)}
        >
          <div 
            className="bg-white rounded-[24px] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] w-full max-w-md overflow-hidden border border-gray-100 transform transition-all animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto mb-5 shadow-[0_4px_12px_-4px_rgba(220,38,38,0.2)]">
                <AlertTriangle size={28} strokeWidth={2.5} />
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Delete Customer?
              </h3>
              
              <p className="text-sm text-gray-500 mb-6 font-medium">
                Are you sure you want to remove this customer from directory? This action cannot be undone.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-[16px] p-4 mb-8 text-left shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="text-[11px] uppercase font-bold text-gray-500 tracking-wider mb-1">
                  Customer
                </div>
                <div className="text-base font-bold text-gray-900">
                  {deleteCustomerTarget.name}
                </div>
                {deleteCustomerTarget.phone && (
                  <div className="text-[13px] font-medium text-gray-600 mt-1 flex items-center gap-1.5">
                    <PhoneCall size={12} className="text-gray-400" />
                    {deleteCustomerTarget.phone}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteCustomerTarget(null)}
                  className="flex-1 px-4 py-3 rounded-[14px] border border-gray-200 text-gray-700 font-bold text-[13px] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCustomer}
                  className="flex-1 px-4 py-3 rounded-[14px] bg-red-600 hover:bg-red-700 text-white font-bold text-[13px] transition-colors flex items-center justify-center gap-2 shadow-[0_2px_8px_-2px_rgba(220,38,38,0.4)] cursor-pointer"
                >
                  <Trash2 size={16} strokeWidth={2.5} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collect Customer Due Modal */}
      {collectDueCustomer && (() => {
        const dueInfo = getCustomerDueInfo(collectDueCustomer);
        const currentPending = dueInfo.pendingDue;
        const enteredAmount = parseFloat(collectDueAmount) || 0;
        const remainingAfter = Math.max(0, currentPending - enteredAmount);

        return (
          <div 
            className="fixed inset-0 bg-[#084b3e]/20 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
            onClick={() => setCollectDueCustomer(null)}
          >
            <div 
              className="bg-white rounded-[24px] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
                    <DollarSign size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      Collect Due
                    </h3>
                    <p className="text-[12px] text-gray-500 font-medium flex items-center gap-2 mt-0.5">
                      <span>{collectDueCustomer.name}</span>
                      {collectDueCustomer.phone && (
                        <span className="flex items-center gap-1.5"><PhoneCall size={12} className="text-gray-400" /> {collectDueCustomer.phone}</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCollectDueCustomer(null)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleConfirmCollectDue} className="p-5 sm:p-6 overflow-y-auto space-y-6">
                {/* Due Amount Highlight Card */}
                <div className="bg-red-50 border border-red-100 rounded-[16px] p-5 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                      Outstanding Due
                    </span>
                    <div className="text-2xl font-bold text-red-600 mt-1">
                      Tk {currentPending.toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCollectDueAmount(currentPending.toString())}
                    className="bg-white border border-red-200 hover:bg-red-50 text-red-700 font-bold text-[12px] px-4 py-2 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors cursor-pointer"
                  >
                    Pay Full
                  </button>
                </div>

                {/* Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[12px] font-bold text-gray-700">
                      Amount (Tk) <span className="text-red-500">*</span>
                    </label>
                    {enteredAmount > 0 && (
                      <span className="text-[11px] font-medium text-gray-500">
                        Remaining: <span className="text-gray-900 font-bold">Tk {remainingAfter.toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">TK</span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={collectDueAmount}
                      onChange={e => setCollectDueAmount(e.target.value)}
                      placeholder="Enter amount..."
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-[14px] bg-gray-50 focus:bg-white focus:border-[#084b3e] focus:ring-1 focus:ring-[#084b3e] outline-none text-base font-bold transition-all"
                      autoFocus
                    />
                  </div>

                  {/* Preset quick buttons if due is larger */}
                  {currentPending > 50 && (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick:</span>
                      {[100, 200, 500, 1000, 2000]
                        .filter(amt => amt < currentPending)
                        .map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setCollectDueAmount(amt.toString())}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                          >
                            Tk {amt}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {(['Cash', 'bKash', 'Nagad', 'Rocket', 'Bank'] as const).map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setCollectDueMethod(method)}
                        className={`py-2 px-1 text-center rounded-[10px] text-[12px] font-bold border transition-all cursor-pointer ${
                          collectDueMethod === method
                            ? 'bg-[#084b3e] text-white border-[#084b3e] shadow-[0_1px_3px_rgba(8,75,62,0.3)]'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-2">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={collectDueNote}
                    onChange={e => setCollectDueNote(e.target.value)}
                    placeholder="e.g. Receipt #123, Paid at counter"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-[14px] focus:bg-white focus:border-[#084b3e] focus:ring-1 focus:ring-[#084b3e] outline-none text-sm transition-all"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setCollectDueCustomer(null)}
                    disabled={isCollecting}
                    className="flex-1 py-3 rounded-[14px] border border-gray-200 text-gray-700 font-bold text-[13px] hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCollecting || !enteredAmount || enteredAmount <= 0}
                    className="flex-1 py-3 rounded-[14px] bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-[13px] flex items-center justify-center gap-2 shadow-[0_2px_8px_-2px_rgba(220,38,38,0.4)] transition-all cursor-pointer"
                  >
                    <Check size={16} strokeWidth={2.5} />
                    <span>{isCollecting ? 'Saving...' : 'Confirm'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
