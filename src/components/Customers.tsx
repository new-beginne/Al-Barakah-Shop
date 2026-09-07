import React, { useState, useMemo } from 'react';
import { db, Customer } from '../db/db';
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
      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Search by name, phone, address..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs sm:text-sm font-medium focus:border-[#084b3e] focus:bg-white outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters, Sort & View Mode Toggle */}
        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          {/* Status Filter Pills */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('due')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                statusFilter === 'due' ? 'bg-white text-red-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Due ({customersWithDueCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('clear')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                statusFilter === 'clear' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Paid ({customers.length - customersWithDueCount})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded-xl">
            <ArrowUpDown size={13} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-[11px] font-bold text-gray-700 outline-none uppercase tracking-wider cursor-pointer"
            >
              <option value="highest-due">Highest Due</option>
              <option value="name">Name (A-Z)</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-100">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-400 hover:text-gray-900'
              }`}
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid Cards"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-400 hover:text-gray-900'
              }`}
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Directory View */}
      {sortedAndFilteredCustomers.length > 0 ? (
        viewMode === 'table' ? (
          /* TABLE LIST VIEW */
          <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[620px]">
                <thead>
                  <tr className="bg-gray-50/90 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4 text-center w-52">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {sortedAndFilteredCustomers.map(c => {
                    const dueInfo = getCustomerDueInfo(c);
                    const hasDue = dueInfo.pendingDue > 0;
                    const cleanPhone = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';

                    return (
                      <tr 
                        key={c.id}
                        className={`transition-colors hover:bg-gray-50/80 ${hasDue ? 'bg-red-50/15' : ''}`}
                      >
                        {/* Customer */}
                        <td className="py-3 px-4">
                          <Link
                            to={`/customers/${c.id}`}
                            className="flex items-center gap-2.5 group cursor-pointer"
                            title={`View ${c.name}'s Profile & Statement`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 transition-transform group-hover:scale-105 ${
                              hasDue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {c.name.slice(0, 2)}
                            </div>
                            <div className="overflow-hidden">
                              <span className="font-black text-gray-900 text-xs sm:text-sm block truncate group-hover:text-[#084b3e] group-hover:underline" title={c.name}>
                                {c.name}
                              </span>
                              {c.address ? (
                                <span className="text-[11px] text-gray-400 flex items-center gap-1 truncate mt-0.5">
                                  <MapPin size={10} className="shrink-0" />
                                  <span className="truncate">{c.address}</span>
                                </span>
                              ) : c.notes ? (
                                <span className="text-[10px] text-gray-400 italic block truncate">
                                  {c.notes}
                                </span>
                              ) : null}
                            </div>
                          </Link>
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-4">
                          {c.phone ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-800 text-xs">{c.phone}</span>
                              <div className="flex items-center gap-1">
                                <a
                                  href={`tel:${c.phone}`}
                                  title="Call"
                                  className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                >
                                  <PhoneCall size={13} />
                                </a>
                                {cleanPhone && (
                                  <a
                                    href={`https://wa.me/88${cleanPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="WhatsApp"
                                    className="p-1 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                                  >
                                    <MessageSquare size={13} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Balance */}
                        <td className="py-3 px-4 text-right">
                          {hasDue ? (
                            <div>
                              <span className="text-red-600 font-black text-xs sm:text-sm block">
                                Tk {dueInfo.pendingDue.toLocaleString()}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-wider text-red-500 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                                DUE
                              </span>
                            </div>
                          ) : (
                            <span className="text-emerald-600 font-bold text-xs inline-flex items-center gap-1">
                              <UserCheck size={13} /> Clear
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              to={`/customers/${c.id}`}
                              title="Full Profile & Statement"
                              className="bg-[#084b3e] hover:bg-[#126b55] text-white font-bold text-[11px] px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1 uppercase tracking-wider"
                            >
                              <User size={12} />
                              <span>Profile</span>
                            </Link>

                            {hasDue && (
                              <button
                                type="button"
                                onClick={() => handleOpenCollectDue(c)}
                                className="bg-red-600 hover:bg-red-700 text-white font-black text-[11px] uppercase tracking-wider px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                                title="Collect Due"
                              >
                                <DollarSign size={12} strokeWidth={2.5} />
                                <span>Collect</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setLedgerCustomer(c)}
                              title="Ledger History"
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] px-2 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                            >
                              <FileText size={12} />
                              <span>Ledger</span>
                            </button>

                            <Link
                              to={`/sales?customer=${encodeURIComponent(c.name)}&phone=${encodeURIComponent(c.phone || '')}`}
                              title="New Sale"
                              className="bg-[#084b3e] hover:bg-[#126b55] text-white font-bold text-[11px] px-2 py-1.5 rounded-xl transition-colors flex items-center gap-1 uppercase tracking-wider"
                            >
                              <span>Sale</span>
                              <ArrowUpRight size={11} />
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(c)}
                              title="Edit"
                              className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteCustomerTarget(c)}
                              title="Delete"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sortedAndFilteredCustomers.map(c => {
              const dueInfo = getCustomerDueInfo(c);
              const hasDue = dueInfo.pendingDue > 0;
              const cleanPhone = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';

              return (
                <div 
                  key={c.id} 
                  className={`bg-white rounded-xl border p-4 shadow-xs transition-all flex flex-col justify-between ${
                    hasDue ? 'border-red-200 hover:border-red-300' : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div>
                    {/* Top Row: Avatar + Name + Actions */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <Link 
                        to={`/customers/${c.id}`}
                        className="flex items-center gap-2.5 min-w-0 group cursor-pointer"
                        title={`View ${c.name}'s Profile & Statement`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 transition-transform group-hover:scale-105 ${
                          hasDue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {c.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-gray-900 text-sm truncate group-hover:text-[#084b3e] group-hover:underline" title={c.name}>
                            {c.name}
                          </h3>
                          {c.address ? (
                            <p className="text-[11px] text-gray-500 flex items-center gap-1 truncate mt-0.5">
                              <MapPin size={10} className="shrink-0 text-gray-400" />
                              <span className="truncate">{c.address}</span>
                            </p>
                          ) : (
                            <span className="text-[10px] text-gray-400">View Profile</span>
                          )}
                        </div>
                      </Link>

                      {/* Edit & Delete */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(c)}
                          title="Edit"
                          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCustomerTarget(c)}
                          title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Phone & Shortcuts */}
                    {c.phone ? (
                      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-2 mb-2.5 border border-gray-100 text-xs">
                        <span className="font-semibold text-gray-800 truncate">{c.phone}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={`tel:${c.phone}`}
                            title="Call"
                            className="p-1 rounded bg-white border border-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                          >
                            <PhoneCall size={12} />
                          </a>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/88${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="WhatsApp"
                              className="p-1 rounded bg-white border border-gray-100 text-emerald-600 hover:bg-emerald-50"
                            >
                              <MessageSquare size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Notes if any */}
                    {c.notes && (
                      <p className="text-[10px] text-gray-500 mb-2.5 bg-gray-50/60 p-1.5 rounded border border-dashed border-gray-100 line-clamp-2">
                        {c.notes}
                      </p>
                    )}
                  </div>

                  {/* Financial Footer */}
                  <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">Balance</p>
                      {hasDue ? (
                        <p className="text-xs sm:text-sm font-black text-red-600">
                          Tk {dueInfo.pendingDue.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <UserCheck size={12} /> Clear
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <Link
                        to={`/customers/${c.id}`}
                        title="Full Profile & Statement"
                        className="text-[11px] font-bold text-white bg-[#084b3e] hover:bg-[#126b55] px-2.5 py-1.5 rounded-xl flex items-center gap-1 uppercase tracking-wider"
                      >
                        <User size={11} />
                        <span>Profile</span>
                      </Link>

                      {hasDue && (
                        <button
                          type="button"
                          onClick={() => handleOpenCollectDue(c)}
                          className="text-[11px] font-black text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Collect Due"
                        >
                          <DollarSign size={11} strokeWidth={2.5} />
                          <span>Collect</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setLedgerCustomer(c)}
                        title="Ledger"
                        className="text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 rounded-xl"
                      >
                        <FileText size={11} />
                      </button>
                      
                      <Link
                        to={`/sales?customer=${encodeURIComponent(c.name)}&phone=${encodeURIComponent(c.phone || '')}`}
                        title="New Sale"
                        className="text-[11px] font-bold text-white bg-[#084b3e] hover:bg-[#126b55] px-2.5 py-1.5 rounded-xl flex items-center gap-1 uppercase tracking-wider"
                      >
                        <span>Sale</span>
                        <ArrowUpRight size={11} />
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
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2.5">
            <Users size={24} />
          </div>
          <h3 className="text-sm font-bold text-gray-800 mb-1">
            {searchQuery ? 'No customers found' : 'No customers yet'}
          </h3>
          <p className="text-xs text-gray-400 max-w-xs mx-auto mb-3">
            {searchQuery
              ? 'No customer records match your filter criteria.'
              : 'Add customer profiles to track sales history and dues.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="bg-[#084b3e] text-white px-3.5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#126b55] transition-colors cursor-pointer"
            >
              Add Customer
            </button>
          )}
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isFormOpen && (
        <div 
          className="fixed inset-0 bg-[#084b3e]/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4"
          onClick={handleCancelForm}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-gray-900">
                {editingCustomerId ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-4 sm:p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. John Doe, Mizan"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="01712345678"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Address / Location
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. Shop 3, Market Rd"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Regular studio client"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium bg-white"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs uppercase tracking-wider hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#084b3e] hover:bg-[#126b55] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save size={15} />
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
          className="fixed inset-0 bg-[#084b3e]/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4"
          onClick={() => setLedgerCustomer(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#084b3e] text-white flex items-center justify-center font-black text-sm">
                  {ledgerCustomer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-sm sm:text-base">
                    {ledgerCustomer.name}
                  </h3>
                  <p className="text-xs text-gray-500 flex items-center gap-2">
                    {ledgerCustomer.phone && <span>📞 {ledgerCustomer.phone}</span>}
                    {ledgerCustomer.address && <span>📍 {ledgerCustomer.address}</span>}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLedgerCustomer(null)}
                className="p-1 text-gray-400 hover:text-gray-900 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Summary Banner */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Recorded</span>
                  <p className="text-lg font-black text-gray-900 mt-0.5">
                    Tk {getCustomerDueInfo(ledgerCustomer).totalDue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Outstanding Balance</span>
                    <p className="text-lg font-black text-red-600 mt-0.5">
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
                      className="mt-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <DollarSign size={13} strokeWidth={2.5} />
                      <span>Collect Due</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Dues History */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                  Dues History
                </h4>
                {(() => {
                  const customerDues = dues.filter(d => 
                    (ledgerCustomer.phone && d.phone?.trim() === ledgerCustomer.phone.trim()) ||
                    (d.customerName?.trim().toLowerCase() === ledgerCustomer.name.trim().toLowerCase())
                  );

                  if (customerDues.length === 0) {
                    return (
                      <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-100">
                        No due records for this customer.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {customerDues.map(d => {
                        const remaining = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
                        return (
                          <div key={d.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-gray-900">Date: {d.date || 'N/A'}</p>
                              <p className="text-gray-500 text-[11px] mt-0.5">
                                Total: Tk {d.totalAmount} | Paid: Tk {d.paidAmount}
                              </p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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
          className="fixed inset-0 bg-[#084b3e]/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4"
          onClick={() => setDeleteCustomerTarget(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 transform transition-all animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} />
              </div>
              
              <h3 className="text-lg font-black text-gray-900 mb-1">
                Delete Customer?
              </h3>
              
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Are you sure you want to remove this customer from directory?
              </p>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 mb-6 text-left">
                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                  Customer
                </div>
                <div className="text-sm font-black text-gray-900">
                  {deleteCustomerTarget.name}
                </div>
                {deleteCustomerTarget.phone && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    Phone: {deleteCustomerTarget.phone}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteCustomerTarget(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-50 transition-colors uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCustomer}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider"
                >
                  <Trash2 size={16} />
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
            className="fixed inset-0 bg-[#084b3e]/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4"
            onClick={() => setCollectDueCustomer(null)}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-red-50 to-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <DollarSign size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-base">
                      Collect Due
                    </h3>
                    <p className="text-xs text-gray-600 font-bold flex items-center gap-1.5 mt-0.5">
                      <span>{collectDueCustomer.name}</span>
                      {collectDueCustomer.phone && (
                        <span className="text-gray-400 font-mono font-normal">({collectDueCustomer.phone})</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCollectDueCustomer(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-900 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleConfirmCollectDue} className="p-4 sm:p-5 overflow-y-auto space-y-4">
                {/* Due Amount Highlight Card */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-600">
                      Outstanding Due
                    </span>
                    <div className="text-2xl font-black text-red-600 mt-0.5">
                      Tk {currentPending.toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCollectDueAmount(currentPending.toString())}
                    className="bg-white border border-red-300 hover:bg-red-100/50 text-red-700 font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Pay Full
                  </button>
                </div>

                {/* Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider">
                      Amount (Tk) <span className="text-red-500">*</span>
                    </label>
                    {enteredAmount > 0 && (
                      <span className="text-[11px] font-bold text-gray-500">
                        Remaining: <span className="text-gray-900 font-black">Tk {remainingAfter.toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">TK</span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={collectDueAmount}
                      onChange={e => setCollectDueAmount(e.target.value)}
                      placeholder="Enter amount..."
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-base font-black bg-white"
                      autoFocus
                    />
                  </div>

                  {/* Preset quick buttons if due is larger */}
                  {currentPending > 50 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick:</span>
                      {[100, 200, 500, 1000, 2000]
                        .filter(amt => amt < currentPending)
                        .map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setCollectDueAmount(amt.toString())}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                          >
                            Tk {amt}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {(['Cash', 'bKash', 'Nagad', 'Rocket', 'Bank'] as const).map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setCollectDueMethod(method)}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          collectDueMethod === method
                            ? 'bg-[#084b3e] text-white border-[#084b3e] shadow-xs'
                            : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={collectDueNote}
                    onChange={e => setCollectDueNote(e.target.value)}
                    placeholder="e.g. Receipt #123, Paid at counter"
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium bg-gray-50/50 focus:bg-white"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setCollectDueCustomer(null)}
                    disabled={isCollecting}
                    className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs uppercase tracking-wider hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCollecting || !enteredAmount || enteredAmount <= 0}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-red-200 transition-all cursor-pointer"
                  >
                    <Check size={16} />
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
