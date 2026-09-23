import React, { useState, useMemo } from 'react';
import { db, Customer } from '../db/db';
import { adjustAccountBalance, mapPaymentMethodToAccountId } from '../services/accountService';
import { logCustomerDelete, logCustomerEdit, logDueEdit } from '../services/activityLogService';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Coins, 
  User
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateStr } from '../utils/dateFormatter';

export function Customers() {
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'clear'>('all');
  const [sortBy, setSortBy] = useState<'highest-due' | 'name' | 'newest'>('highest-due');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Delete modal state
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState<Customer | null>(null);

  // Collect Due modal state
  const [collectDueCustomer, setCollectDueCustomer] = useState<Customer | null>(null);
  const [collectDueAmount, setCollectDueAmount] = useState('');
  const [collectDueMethod, setCollectDueMethod] = useState<'Cash' | 'bKash' | 'Nagad' | 'Rocket'>('Cash');
  const [collectDueNote, setCollectDueNote] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  // Live queries
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const dues = useLiveQuery(() => db.dues.toArray()) || [];

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

  const totalCustomers = customers.length;
  const customersWithDueCount = customers.filter(c => getCustomerDueInfo(c).pendingDue > 0).length;
  const totalOutstandingDue = customers.reduce((sum, c) => sum + getCustomerDueInfo(c).pendingDue, 0);

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

  const resetForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setEditingCustomerId(null);
  };

  const handleEditCustomer = (c: Customer) => {
    setName(c.name);
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setNotes(c.notes || '');
    setEditingCustomerId(c.id!);
    setIsFormOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const now = new Date().toISOString();
    try {
      if (editingCustomerId) {
        await db.customers.update(editingCustomerId, {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          notes: notes.trim(),
          updatedAt: now
        });
        await logCustomerEdit(editingCustomerId, name.trim(), { phone: phone.trim(), address: address.trim(), notes: notes.trim() });
        setSuccessMsg('Customer updated successfully!');
      } else {
        await db.customers.add({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          notes: notes.trim(),
          createdAt: now,
          updatedAt: now
        });
        setSuccessMsg('Customer added successfully!');
      }
      setTimeout(() => setSuccessMsg(''), 3000);
      resetForm();
      setIsFormOpen(false);
    } catch (err) {
      console.error('Failed to save customer', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCustomerTarget || !deleteCustomerTarget.id) return;
    try {
      await db.transaction('rw', db.customers, db.dues, db.activityLogs, async () => {
        await db.customers.delete(deleteCustomerTarget.id!);
        const custPhone = deleteCustomerTarget.phone?.trim();
        const custName = deleteCustomerTarget.name?.trim().toLowerCase();
        const duesToDelete = await db.dues.filter(d => {
          const dPhone = d.phone?.trim();
          const dName = d.customerName?.trim().toLowerCase();
          return (custPhone && dPhone && custPhone === dPhone) || (dName && dName === custName);
        }).toArray();
        if (duesToDelete.length > 0) {
          await db.dues.bulkDelete(duesToDelete.map(d => d.id!).filter(Boolean));
        }
      });
      await logCustomerDelete(deleteCustomerTarget);
      setSuccessMsg('Customer and associated records deleted successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error('Failed to delete customer:', error);
    }
    setDeleteCustomerTarget(null);
  };

  const handleCollectDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectDueCustomer) return;
    
    setIsCollecting(true);
    try {
      const amount = parseFloat(collectDueAmount);
      if (isNaN(amount) || amount <= 0) return;

      const customerDues = dues.filter(d => 
        (collectDueCustomer.phone && d.phone === collectDueCustomer.phone) || 
        d.customerName.toLowerCase() === collectDueCustomer.name.toLowerCase()
      ).sort((a, b) => (a.id || 0) - (b.id || 0));

      let remainingToCollect = amount;
      const now = new Date().toISOString();
      const meta = { date: formatDateStr(new Date().toISOString()), time: new Date().toLocaleTimeString(), updatedAt: now };

      await db.transaction('rw', db.dues, db.accounts, db.balanceLogs, async () => {
        for (const d of customerDues) {
          if (remainingToCollect <= 0) break;
          const pendingForThisDue = (d.totalAmount || 0) - (d.paidAmount || 0);
          if (pendingForThisDue > 0) {
            const collectFromThis = Math.min(pendingForThisDue, remainingToCollect);
            const newPaid = (d.paidAmount || 0) + collectFromThis;
            await db.dues.update(d.id!, {
              paidAmount: newPaid,
              status: newPaid >= (d.totalAmount || 0) ? 'Paid' : 'Partial',
              updatedAt: now
            });
            remainingToCollect -= collectFromThis;
          }
        }
        
        const accountId = mapPaymentMethodToAccountId(collectDueMethod);
        await adjustAccountBalance(accountId, amount);
      });

      await logDueEdit(collectDueCustomer.name, amount, collectDueMethod);
      setSuccessMsg(`Successfully collected Tk ${amount} from ${collectDueCustomer.name}`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setIsCollecting(false);
      setCollectDueCustomer(null);
      setCollectDueAmount('');
      setCollectDueNote('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 font-medium">Manage your clients and their dues</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsFormOpen(true); }}
          className="w-full sm:w-auto bg-[#084b3e] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#0c5e4e] transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <UserPlus size={20} />
          Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Total Customers</p>
            <p className="text-2xl font-black text-gray-900">{totalCustomers}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Customers w/ Due</p>
            <p className="text-2xl font-black text-gray-900">{customersWithDueCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Total Outstanding</p>
            <p className="text-2xl font-black text-red-600">Tk {totalOutstandingDue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm border border-emerald-100 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-all text-sm font-medium"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#084b3e] bg-gray-50 w-full sm:w-auto"
            >
              <option value="all">All Status</option>
              <option value="due">Has Due</option>
              <option value="clear">No Due</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#084b3e] bg-gray-50 w-full sm:w-auto"
            >
              <option value="highest-due">Highest Due</option>
              <option value="newest">Newest First</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {sortedAndFilteredCustomers.length > 0 ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 text-gray-500 font-bold text-xs uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-4 px-4">Customer Info</th>
                  <th className="py-4 px-4">Contact</th>
                  <th className="py-4 px-4 text-right">Outstanding Due</th>
                  <th className="py-4 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedAndFilteredCustomers.map((c) => {
                  const dueInfo = getCustomerDueInfo(c);
                  const hasDue = dueInfo.pendingDue > 0;
                  
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-4">
                        <Link to={`/customers/${c.id}`} className="font-bold text-gray-900 hover:text-[#084b3e] hover:underline flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                            <User size={14} />
                          </div>
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-4 px-4 text-gray-600 font-medium">
                        {c.phone || <span className="text-gray-400 italic">No phone</span>}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className={`font-black text-base ${hasDue ? 'text-red-600' : 'text-emerald-600'}`}>
                          Tk {dueInfo.pendingDue.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {hasDue && (
                            <button
                              onClick={() => {
                                setCollectDueCustomer(c);
                                setCollectDueAmount(dueInfo.pendingDue.toString());
                                setCollectDueNote('');
                              }}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
                            >
                              Collect Due
                            </button>
                          )}
                          <button
                            onClick={() => handleEditCustomer(c)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteCustomerTarget(c)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
              <Users size={32} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-bold text-gray-900 mb-1">No customers found</h3>
              <p className="text-sm text-gray-500">Try adjusting your filters or add a new customer.</p>
            </div>
          )}
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setIsFormOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-900 mb-5 flex justify-between items-center">
              {editingCustomerId ? 'Edit Customer' : 'Add New Customer'}
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </h3>
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Name *</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-[#084b3e]" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-[#084b3e]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Address (Optional)</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-[#084b3e]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Notes (Optional)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-[#084b3e]" />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-[#084b3e] text-white font-bold py-3 rounded-xl hover:bg-[#0c5e4e] transition-colors shadow-sm">
                  {editingCustomerId ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COLLECT DUE MODAL */}
      {collectDueCustomer && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setCollectDueCustomer(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-900 mb-2 flex justify-between items-center">
              Collect Due
              <button onClick={() => setCollectDueCustomer(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </h3>
            <p className="text-sm text-gray-500 mb-5 font-medium">From <span className="font-bold text-gray-900">{collectDueCustomer.name}</span></p>
            <form onSubmit={handleCollectDue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Amount to Collect (Tk)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">TK</span>
                  <input type="number" step="any" required max={getCustomerDueInfo(collectDueCustomer).pendingDue} value={collectDueAmount} onChange={e => setCollectDueAmount(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-black outline-none font-mono focus:border-[#084b3e]" autoFocus />
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5 font-bold">Max due: Tk {getCustomerDueInfo(collectDueCustomer).pendingDue}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Payment Method</label>
                <select value={collectDueMethod} onChange={e => setCollectDueMethod(e.target.value as any)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-[#084b3e]">
                  <option value="Cash">Cash</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={isCollecting} className="w-full bg-[#084b3e] text-white font-bold py-3 rounded-xl hover:bg-[#0c5e4e] transition-colors shadow-sm disabled:opacity-50">
                  {isCollecting ? 'Processing...' : 'Confirm Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteCustomerTarget && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setDeleteCustomerTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle size={28} strokeWidth={2.5} />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-2">Delete Customer?</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">Remove <span className="font-black text-gray-900">{deleteCustomerTarget.name}</span> and all related data?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteCustomerTarget(null)} className="flex-1 py-3 font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleConfirmDelete} className="flex-1 py-3 font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
