import React, { useState, useMemo } from 'react';
import { db, Customer } from '../db/db';
import { adjustAccountBalance, mapPaymentMethodToAccountId } from '../services/accountService';
import { logCustomerDelete, logCustomerEdit, logDueEdit, logDueClear } from '../services/activityLogService';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
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
  const [collectDueDiscount, setCollectDueDiscount] = useState('');
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
      if (!keyPhone && !keyName) return;
      
      const current = (keyPhone && map.get(keyPhone)) || (keyName && map.get(keyName)) || { 
        totalDue: 0, totalPaid: 0, pendingDue: 0, count: 0 
      };
      current.totalDue += d.totalAmount || 0;
      current.totalPaid += d.paidAmount || 0;
      current.pendingDue += Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
      current.count += 1;

      if (keyPhone) map.set(keyPhone, current);
      if (keyName) map.set(keyName, current);
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
      const cashReceived = parseFloat(collectDueAmount) || 0;
      const discountGiven = parseFloat(collectDueDiscount) || 0;
      const totalSettled = cashReceived + discountGiven;

      if (totalSettled <= 0) {
        setIsCollecting(false);
        return;
      }

      const customerDues = dues.filter(d => 
        (collectDueCustomer.phone && d.phone === collectDueCustomer.phone) || 
        d.customerName.toLowerCase() === collectDueCustomer.name.toLowerCase()
      ).sort((a, b) => (a.id || 0) - (b.id || 0));

      let remainingToSettle = totalSettled;
      let remainingCash = cashReceived;
      let remainingDiscount = discountGiven;
      let totalProfitEarned = 0;
      const now = new Date().toISOString();
      const todayDate = format(new Date(), 'yyyy-MM-dd');
      const todayTime = format(new Date(), 'hh:mm:ss a');

      await db.transaction('rw', [db.dues, db.sales, db.accounts, db.balanceLogs, db.activityLogs], async () => {
        for (const d of customerDues) {
          if (remainingToSettle <= 0) break;
          const pendingForThisDue = (d.totalAmount || 0) - (d.paidAmount || 0);
          if (pendingForThisDue > 0) {
            const settleFromThis = Math.min(pendingForThisDue, remainingToSettle);
            const cashForThis = Math.min(settleFromThis, remainingCash);
            const discountForThis = Math.min(settleFromThis - cashForThis, remainingDiscount);

            const newPaid = (d.paidAmount || 0) + settleFromThis;
            const isFullClear = newPaid >= (d.totalAmount || 0);
            const newDiscount = (d.discount || 0) + discountForThis;

            await db.dues.update(d.id!, {
              paidAmount: newPaid,
              discount: newDiscount,
              status: isFullClear ? 'Paid' : 'Partial',
              updatedAt: now
            });

            // If this due was from an MFS transaction, it is a cash reimbursement for wallet balance
            const isMfsDue = d.referenceType === 'mfs';

            if (!isMfsDue) {
              // Calculate proportional cost and profit for studio sales
              const totalDueAmt = d.totalAmount || settleFromThis;
              const ratio = totalDueAmt > 0 ? (settleFromThis / totalDueAmt) : 1;
              const costPart = Math.round(((d.cost || 0) * ratio) * 100) / 100;
              // Net profit after discount
              const profitPart = Math.max(0, Math.round((cashForThis - costPart) * 100) / 100);

              totalProfitEarned += profitPart;

              // When studio due is cleared, record the sale & profit
              if (cashForThis > 0 || discountForThis > 0) {
                await db.sales.add({
                  date: todayDate,
                  time: todayTime,
                  createdAt: now,
                  updatedAt: now,
                  category: d.category || 'Due Collection',
                  serviceName: d.serviceName ? `Due Clear: ${d.serviceName}` : `Due Cleared (${d.customerName})`,
                  amount: cashForThis,
                  cost: costPart,
                  profit: profitPart,
                  discount: discountForThis > 0 ? discountForThis : undefined,
                  paymentMethod: collectDueMethod,
                  note: `Due cleared (${isFullClear ? 'Full' : 'Partial'}): Tk ${cashForThis.toLocaleString()} paid${discountForThis > 0 ? ` [Tk ${discountForThis.toLocaleString()} Discount]` : ''} of Tk ${totalDueAmt.toLocaleString()} for ${d.serviceName || 'Service'}${collectDueNote.trim() ? ` - ${collectDueNote.trim()}` : ''}`,
                  customerName: d.customerName,
                  customerPhone: d.phone,
                  paidAmount: cashForThis,
                  dueAmount: 0,
                  quantity: 1
                });
              }
            } else {
              // MFS Due: Add proportional MFS fee profit if any
              const totalDueAmt = d.totalAmount || settleFromThis;
              const ratio = totalDueAmt > 0 ? (settleFromThis / totalDueAmt) : 1;
              const mfsProfitPart = d.profit ? Math.round((d.profit * ratio) * 100) / 100 : 0;
              totalProfitEarned += Math.max(0, mfsProfitPart - discountForThis);
            }

            remainingToSettle -= settleFromThis;
            remainingCash -= cashForThis;
            remainingDiscount -= discountForThis;
          }
        }

        // If there's an excess payment beyond recorded dues, record as general due collection sale
        if (remainingCash > 0) {
          totalProfitEarned += remainingCash;
          await db.sales.add({
            date: todayDate,
            time: todayTime,
            createdAt: now,
            updatedAt: now,
            category: 'Due Collection',
            serviceName: `Due Payment (${collectDueCustomer.name})`,
            amount: remainingCash,
            cost: 0,
            profit: remainingCash,
            paymentMethod: collectDueMethod,
            note: `Due credit collected: Tk ${remainingCash.toLocaleString()}${collectDueNote.trim() ? ` - ${collectDueNote.trim()}` : ''}`,
            customerName: collectDueCustomer.name,
            customerPhone: collectDueCustomer.phone,
            paidAmount: remainingCash,
            dueAmount: 0,
            quantity: 1
          });
        }
        
        // ONLY the actual cash received is added to account balance
        if (cashReceived > 0) {
          const accountId = mapPaymentMethodToAccountId(collectDueMethod);
          await adjustAccountBalance(accountId, cashReceived);
        }
      });

      // Record clear log in Activity History
      await logDueClear(
        collectDueCustomer.name, 
        cashReceived, 
        collectDueMethod, 
        totalProfitEarned,
        collectDueNote.trim() ? `Note: ${collectDueNote.trim()}` : undefined,
        discountGiven
      );

      const discountMsg = discountGiven > 0 ? ` (Tk ${discountGiven.toLocaleString()} discount)` : '';
      setSuccessMsg(`Successfully cleared Tk ${totalSettled.toLocaleString()} due${discountMsg} for ${collectDueCustomer.name}.`);
      setTimeout(() => setSuccessMsg(''), 4500);
    } finally {
      setIsCollecting(false);
      setCollectDueCustomer(null);
      setCollectDueAmount('');
      setCollectDueDiscount('');
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
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-center font-bold text-xl text-[#182236] mb-6">
              {editingCustomerId ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Name *</label>
                <input 
                  type="text" 
                  required 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Customer full name"
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl outline-none text-sm text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-bold" 
                  autoFocus 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Phone</label>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="01XXXXXXXXX"
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl outline-none text-sm text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-medium font-mono" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Address (Optional)</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={e => setAddress(e.target.value)} 
                  placeholder="Village / Road / Area"
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl outline-none text-sm text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-medium" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Notes (Optional)</label>
                <input 
                  type="text" 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Any additional notes"
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl outline-none text-sm text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-medium" 
                />
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer active:translate-y-px flex items-center justify-center"
                >
                  {editingCustomerId ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COLLECT DUE MODAL */}
      {collectDueCustomer && (() => {
        const pendingDue = getCustomerDueInfo(collectDueCustomer).pendingDue;
        const numCash = parseFloat(collectDueAmount) || 0;
        const numDiscount = parseFloat(collectDueDiscount) || 0;
        const totalSettled = numCash + numDiscount;
        const remainingDue = Math.max(0, pendingDue - totalSettled);

        return (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setCollectDueCustomer(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-center font-bold text-xl text-[#182236] mb-1">
                Collect Due Payment
              </h2>
              <p className="text-center text-xs text-gray-500 font-semibold mb-5">
                Customer: <span className="text-gray-900 font-bold">{collectDueCustomer.name}</span> • Pending: <span className="text-rose-600 font-black">Tk {pendingDue.toLocaleString()}</span>
              </p>

              <form onSubmit={handleCollectDue} className="space-y-4">
                {/* Quick settlement action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setCollectDueAmount(pendingDue.toString());
                      setCollectDueDiscount('');
                    }}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                  >
                    Full Due (Tk {pendingDue.toLocaleString()})
                  </button>
                  {numCash > 0 && numCash < pendingDue && (
                    <button
                      type="button"
                      onClick={() => {
                        const diff = Math.max(0, pendingDue - numCash);
                        setCollectDueDiscount(diff > 0 ? diff.toString() : '');
                      }}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200 transition-colors cursor-pointer"
                    >
                      Set Remaining Tk {(pendingDue - numCash).toLocaleString()} as Discount
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Cash Received Field */}
                  <div>
                    <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                      Received Amount (Tk) *
                    </label>
                    <input 
                      type="number" 
                      step="any" 
                      min="0"
                      required={numDiscount <= 0}
                      value={collectDueAmount} 
                      onChange={e => setCollectDueAmount(e.target.value)} 
                      placeholder="0.00"
                      className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl outline-none text-sm text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-black font-mono" 
                      autoFocus 
                    />
                  </div>

                  {/* Discount Field */}
                  <div>
                    <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                      Discount (Tk)
                    </label>
                    <input 
                      type="number" 
                      step="any" 
                      min="0"
                      value={collectDueDiscount} 
                      onChange={e => setCollectDueDiscount(e.target.value)} 
                      placeholder="0.00"
                      className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl outline-none text-sm text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-black font-mono" 
                    />
                  </div>
                </div>

                {/* Live Settlement Breakdown */}
                <div className="p-3 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-center text-gray-600 font-semibold">
                    <span>Cash Received:</span>
                    <span className="font-bold text-gray-900">Tk {numCash.toLocaleString()}</span>
                  </div>
                  {numDiscount > 0 && (
                    <div className="flex justify-between items-center text-amber-800 font-semibold">
                      <span>Discount:</span>
                      <span className="font-bold text-amber-900">- Tk {numDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-[#dce1e7] pt-1 flex justify-between items-center font-bold">
                    <span className="text-gray-800">Total Settled:</span>
                    <span className="text-emerald-700 font-black">Tk {totalSettled.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-500 pt-0.5">
                    <span>Remaining Due:</span>
                    <span className={`font-bold ${remainingDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {remainingDue > 0 ? `Tk ${remainingDue.toLocaleString()}` : 'Tk 0 (Full Clear)'}
                    </span>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['Cash', 'bKash', 'Nagad', 'Rocket'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCollectDueMethod(m)}
                        className={`h-[40px] text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          collectDueMethod === m
                            ? 'bg-[#075b4d] text-white border-[#075b4d] shadow-xs'
                            : 'bg-[#f8f9fa] text-gray-700 border-[#dce1e7] hover:bg-gray-100'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={collectDueNote}
                    onChange={e => setCollectDueNote(e.target.value)}
                    placeholder="e.g. Paid Tk 450, discount Tk 50"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-gray-800 outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isCollecting || totalSettled <= 0} 
                    className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isCollecting ? 'Processing...' : `Confirm (Tk ${numCash.toLocaleString()} Paid)`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteCustomerTarget && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setDeleteCustomerTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle size={28} strokeWidth={2.5} />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-2">Delete Customer?</h3>
            <p className="text-sm text-gray-500 mb-3 font-medium">Remove <span className="font-black text-gray-900">{deleteCustomerTarget.name}</span> and all related data?</p>
            {getCustomerDueInfo(deleteCustomerTarget).pendingDue > 0 && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold text-left">
                ⚠️ Warning: This customer has <span className="text-rose-950 font-black">Tk {getCustomerDueInfo(deleteCustomerTarget).pendingDue.toLocaleString()}</span> in unpaid dues which will also be deleted!
              </div>
            )}
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
