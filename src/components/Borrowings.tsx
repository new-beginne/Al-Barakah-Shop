import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Borrowing } from '../db/db';
import { recordActivityLog } from '../services/activityLogService';
import { adjustAccountBalance } from '../services/accountService';
import { 
  Plus, 
  Search, 
  AlertCircle, 
  Calendar, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  Phone, 
  Clock, 
  Wallet, 
  X, 
  Check, 
  Copy,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { format, isPast, isToday, differenceInDays, addDays } from 'date-fns';

export function Borrowings() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Borrowing | null>(null);
  const [selectedBorrowing, setSelectedBorrowing] = useState<Borrowing | null>(null);
  const [editingBorrowing, setEditingBorrowing] = useState<Borrowing | null>(null);
  const [detailsBorrowingId, setDetailsBorrowingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Filter Tabs: 'all' | 'borrow' | 'lend'
  const [activeTab, setActiveTab] = useState<'all' | 'borrow' | 'lend'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Unpaid' | 'Partial' | 'Paid'>('all');

  // Form State (Add)
  const [entryType, setEntryType] = useState<'borrow' | 'lend'>('borrow');
  const [lenderName, setLenderName] = useState('');
  const [phone, setPhone] = useState('');
  const [borrowDate, setBorrowDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [durationDays, setDurationDays] = useState('30');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [receiveAccount, setReceiveAccount] = useState('cash');

  // Customer suggestion state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>(undefined);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const customerSuggestionRef = useRef<HTMLDivElement>(null);

  // Edit Form State
  const [editType, setEditType] = useState<'borrow' | 'lend'>('borrow');
  const [editLenderName, setEditLenderName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBorrowDate, setEditBorrowDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaidAmount, setEditPaidAmount] = useState('');
  const [editReceiveAccount, setEditReceiveAccount] = useState('cash');
  const [editAdjustBalance, setEditAdjustBalance] = useState(true);
  const [editDueDate, setEditDueDate] = useState('');
  const [editNote, setEditNote] = useState('');

  // Payment Form State
  const [payAmount, setPayAmount] = useState('');
  const [payAccount, setPayAccount] = useState('cash');

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];

  const borrowings = useLiveQuery(() => 
    db.borrowings.orderBy('id').reverse().toArray()
  ) || [];

  // Close customer suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerSuggestionRef.current && !customerSuggestionRef.current.contains(event.target as Node)) {
        setShowCustomerSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lookup for active details modal
  const activeDetailsBorrowing = detailsBorrowingId 
    ? borrowings.find(b => b.id === detailsBorrowingId) || null 
    : null;

  // Filtered List
  const filteredBorrowings = borrowings.filter(b => {
    const itemType = b.type || 'borrow';
    if (activeTab !== 'all' && itemType !== activeTab) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return (
      b.lenderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.phone || '').includes(searchQuery)
    );
  });

  // Financial calculations
  const borrowList = borrowings.filter(b => (b.type || 'borrow') === 'borrow');
  const lendList = borrowings.filter(b => b.type === 'lend');

  const totalBorrowed = borrowList.reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalBorrowRepaid = borrowList.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
  const totalPayable = totalBorrowed - totalBorrowRepaid; // I Owe

  const totalLent = lendList.reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalLendCollected = lendList.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
  const totalReceivable = totalLent - totalLendCollected; // Owed to Me

  const netBalance = totalReceivable - totalPayable;

  const getAccountName = (accId?: string) => {
    if (!accId || accId === 'none') return 'None';
    if (accId.toLowerCase() === 'cash') return 'Cash';
    const found = accounts.find(a => a.id.toLowerCase() === accId.toLowerCase());
    return found ? found.name : accId;
  };

  const handleCopyPhone = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    navigator.clipboard.writeText(phoneNumber);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const safeFormatDate = (dateStr?: string, pattern: string = 'dd/MM/yyyy') => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return format(d, pattern);
    } catch {
      return dateStr;
    }
  };

  const updateDurationDays = (daysStr: string, baseDateStr = borrowDate) => {
    setDurationDays(daysStr);
    const numDays = parseInt(daysStr);
    if (!isNaN(numDays) && numDays > 0) {
      try {
        const base = baseDateStr ? new Date(baseDateStr) : new Date();
        setDueDate(format(addDays(base, numDays), 'yyyy-MM-dd'));
      } catch {
        setDueDate(format(addDays(new Date(), numDays), 'yyyy-MM-dd'));
      }
    }
  };

  const handleBorrowDateChange = (newBorrowDate: string) => {
    setBorrowDate(newBorrowDate);
    const numDays = parseInt(durationDays) || 30;
    try {
      const base = newBorrowDate ? new Date(newBorrowDate) : new Date();
      setDueDate(format(addDays(base, numDays), 'yyyy-MM-dd'));
    } catch {}
  };

  const handleAddBorrowing = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const parsedAmount = Number(amount) || 0;
    const entryDate = borrowDate || format(now, 'yyyy-MM-dd');

    // Auto add contact person to customer list if not already present
    let linkedCustomerId = selectedCustomerId;
    if (lenderName.trim()) {
      const existingCustomer = customers.find(c => 
        (selectedCustomerId && c.id === selectedCustomerId) ||
        c.name.toLowerCase().trim() === lenderName.toLowerCase().trim() ||
        (phone.trim() && c.phone && c.phone.trim() === phone.trim())
      );
      if (!existingCustomer) {
        const newCustId = await db.customers.add({
          name: lenderName.trim(),
          phone: phone.trim(),
          notes: entryType === 'lend' ? 'Auto-added from Lend' : 'Auto-added from Borrow',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        });
        linkedCustomerId = Number(newCustId);
      } else {
        linkedCustomerId = existingCustomer.id;
        if (!existingCustomer.phone && phone.trim()) {
          await db.customers.update(existingCustomer.id!, {
            phone: phone.trim(),
            updatedAt: now.toISOString()
          });
        }
      }
    }

    const newId = await db.borrowings.add({
      type: entryType,
      date: entryDate,
      time: format(now, 'hh:mm:ss a'),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      customerId: linkedCustomerId,
      lenderName: lenderName.trim(),
      phone: phone.trim(),
      amount: parsedAmount,
      paidAmount: 0,
      dueDate,
      status: 'Unpaid',
      note: note.trim(),
      receiveAccount: receiveAccount !== 'none' ? receiveAccount : undefined
    });

    if (receiveAccount !== 'none' && parsedAmount > 0) {
      if (entryType === 'lend') {
        // You gave money out to borrower -> deduct from account
        await adjustAccountBalance(receiveAccount, -parsedAmount);
      } else {
        // You received money from lender -> add to account
        await adjustAccountBalance(receiveAccount, parsedAmount);
      }
    }

    await recordActivityLog({
      action: 'CREATE',
      module: 'Borrowings',
      title: entryType === 'lend' 
        ? `Lent Tk ${parsedAmount.toLocaleString()} to ${lenderName}`
        : `Borrowed Tk ${parsedAmount.toLocaleString()} from ${lenderName}`,
      details: `${entryType === 'lend' ? 'Given from' : 'Received in'} ${getAccountName(receiveAccount)} (Due: ${dueDate})`,
      meta: { borrowingId: newId, type: entryType, lenderName, amount: parsedAmount, receiveAccount, date: entryDate }
    });

    setLenderName('');
    setPhone('');
    setSelectedCustomerId(undefined);
    setAmount('');
    const today = format(new Date(), 'yyyy-MM-dd');
    setBorrowDate(today);
    setDurationDays('30');
    setDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    setNote('');
    setReceiveAccount('cash');
    setIsModalOpen(false);
    setSuccessMsg(entryType === 'lend'
      ? `Lent Tk ${parsedAmount.toLocaleString()} to ${lenderName.trim()}`
      : `Borrowed Tk ${parsedAmount.toLocaleString()} from ${lenderName.trim()}`
    );
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrowing || !selectedBorrowing.id) return;

    const isLend = selectedBorrowing.type === 'lend';
    const paymentNum = Number(payAmount) || 0;
    const currentPaid = selectedBorrowing.paidAmount || 0;
    const totalAmount = selectedBorrowing.amount || 0;
    const newPaidAmount = currentPaid + paymentNum;
    const newStatus = newPaidAmount >= totalAmount ? 'Paid' : 'Partial';

    await db.borrowings.update(selectedBorrowing.id, {
      paidAmount: newPaidAmount,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    if (payAccount !== 'none' && paymentNum > 0) {
      if (isLend) {
        // Borrower returns money -> your account increases
        await adjustAccountBalance(payAccount, paymentNum);
      } else {
        // You pay lender back -> your account decreases
        await adjustAccountBalance(payAccount, -paymentNum);
      }
    }

    await recordActivityLog({
      action: 'EDIT',
      module: 'Borrowings',
      title: isLend
        ? `Collected Tk ${paymentNum.toLocaleString()} from ${selectedBorrowing.lenderName}`
        : `Repaid Tk ${paymentNum.toLocaleString()} to ${selectedBorrowing.lenderName}`,
      details: `${isLend ? 'Collected into' : 'Paid from'} ${getAccountName(payAccount)}`,
      meta: {
        borrowingId: selectedBorrowing.id,
        type: selectedBorrowing.type,
        lenderName: selectedBorrowing.lenderName,
        paymentAmount: paymentNum,
        payAccount,
        newStatus
      }
    });

    setPayAmount('');
    setSelectedBorrowing(null);
    setIsPaymentModalOpen(false);
    setSuccessMsg(isLend
      ? `Collected Tk ${paymentNum.toLocaleString()} successfully.`
      : `Paid Tk ${paymentNum.toLocaleString()} successfully.`
    );
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const openPaymentModal = (borrowing: Borrowing) => {
    setSelectedBorrowing(borrowing);
    setPayAmount(((borrowing.amount || 0) - (borrowing.paidAmount || 0)).toString());
    setPayAccount('cash');
    setIsPaymentModalOpen(true);
  };

  const openEditModal = (b: Borrowing) => {
    setEditingBorrowing(b);
    setEditType(b.type || 'borrow');
    setEditLenderName(b.lenderName || '');
    setEditPhone(b.phone || '');
    setEditBorrowDate(b.date || format(new Date(), 'yyyy-MM-dd'));
    setEditAmount((b.amount || 0).toString());
    setEditPaidAmount((b.paidAmount || 0).toString());
    setEditReceiveAccount(b.receiveAccount || 'cash');
    setEditAdjustBalance(true);
    setEditDueDate(b.dueDate || '');
    setEditNote(b.note || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBorrowing?.id) return;

    const parsedNewAmount = Number(editAmount) || 0;
    const parsedNewPaid = Number(editPaidAmount) || 0;
    const oldAmount = editingBorrowing.amount || 0;
    const oldAccount = editingBorrowing.receiveAccount || 'none';
    const newAccount = editReceiveAccount;

    const isOldLend = editingBorrowing.type === 'lend';
    const isNewLend = editType === 'lend';

    let newStatus: 'Unpaid' | 'Partial' | 'Paid' = 'Unpaid';
    if (parsedNewPaid >= parsedNewAmount && parsedNewAmount > 0) {
      newStatus = 'Paid';
    } else if (parsedNewPaid > 0) {
      newStatus = 'Partial';
    } else {
      newStatus = 'Unpaid';
    }

    if (editAdjustBalance) {
      const oldSign = isOldLend ? -1 : 1;
      const newSign = isNewLend ? -1 : 1;

      if (oldAccount === newAccount) {
        if (newAccount !== 'none') {
          const diff = (newSign * parsedNewAmount) - (oldSign * oldAmount);
          if (diff !== 0) {
            await adjustAccountBalance(newAccount, diff);
          }
        }
      } else {
        if (oldAccount !== 'none' && oldAmount > 0) {
          await adjustAccountBalance(oldAccount, -oldSign * oldAmount);
        }
        if (newAccount !== 'none' && parsedNewAmount > 0) {
          await adjustAccountBalance(newAccount, newSign * parsedNewAmount);
        }
      }
    }

    if (editLenderName.trim()) {
      const existingCustomer = customers.find(c => 
        c.name.toLowerCase().trim() === editLenderName.toLowerCase().trim()
      );
      if (!existingCustomer) {
        await db.customers.add({
          name: editLenderName.trim(),
          phone: editPhone.trim(),
          notes: editType === 'lend' ? 'Auto-added from Lend' : 'Auto-added from Borrow',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else if (!existingCustomer.phone && editPhone.trim()) {
        await db.customers.update(existingCustomer.id!, {
          phone: editPhone.trim(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    await db.borrowings.update(editingBorrowing.id, {
      type: editType,
      date: editBorrowDate || editingBorrowing.date || format(new Date(), 'yyyy-MM-dd'),
      lenderName: editLenderName.trim(),
      phone: editPhone.trim(),
      amount: parsedNewAmount,
      paidAmount: parsedNewPaid,
      status: newStatus,
      dueDate: editDueDate,
      note: editNote.trim(),
      receiveAccount: newAccount !== 'none' ? newAccount : undefined,
      updatedAt: new Date().toISOString()
    });

    setIsEditModalOpen(false);
    setEditingBorrowing(null);
    setSuccessMsg('Record updated.');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;

    const isLend = deleteTarget.type === 'lend';
    const netRemaining = (deleteTarget.amount || 0) - (deleteTarget.paidAmount || 0);
    const targetAccount = deleteTarget.receiveAccount;

    await db.transaction('rw', db.borrowings, db.accounts, db.balanceLogs, db.activityLogs, async () => {
      await db.borrowings.delete(deleteTarget.id!);

      if (targetAccount && targetAccount !== 'none' && netRemaining > 0) {
        if (isLend) {
          await adjustAccountBalance(targetAccount, netRemaining);
        } else {
          await adjustAccountBalance(targetAccount, -netRemaining);
        }
      }
    });

    if (detailsBorrowingId === deleteTarget.id) {
      setDetailsBorrowingId(null);
    }
    setDeleteTarget(null);
    setSuccessMsg('Record deleted.');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const openNewEntryModal = (type: 'borrow' | 'lend' = 'borrow') => {
    setEntryType(type);
    setLenderName('');
    setPhone('');
    setSelectedCustomerId(undefined);
    setAmount('');
    const today = format(new Date(), 'yyyy-MM-dd');
    setBorrowDate(today);
    setDurationDays('30');
    setDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    setNote('');
    setReceiveAccount('cash');
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 p-2 sm:p-0">
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#084b3e] text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-300" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Borrow & Lend</h1>
          <p className="text-xs text-gray-500 mt-0.5">Simple loan and borrowing tracker</p>
        </div>

        <button
          onClick={() => openNewEntryModal('borrow')}
          className="bg-[#084b3e] hover:bg-[#0c5e4e] text-white px-4 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 text-xs sm:text-sm shadow-xs cursor-pointer"
        >
          <Plus size={16} />
          <span>New Entry</span>
        </button>
      </div>

      {/* Simplified Metric Cards (Always visible, clean white design) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* I Owe (Payable) */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">I Owe (Payable)</div>
            <div className="text-xl font-bold text-rose-600 mt-0.5">
              Tk {totalPayable.toLocaleString()}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {borrowList.filter(b => b.status !== 'Paid').length} active loans
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ArrowDownLeft size={20} />
          </div>
        </div>

        {/* Owed to Me (Receivable) */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Owed to Me (Receivable)</div>
            <div className="text-xl font-bold text-emerald-600 mt-0.5">
              Tk {totalReceivable.toLocaleString()}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {lendList.filter(b => b.status !== 'Paid').length} active lendings
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowUpRight size={20} />
          </div>
        </div>

        {/* Net Position */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Net Balance</div>
            <div className={`text-xl font-bold mt-0.5 ${netBalance >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
              Tk {Math.abs(netBalance).toLocaleString()}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5 font-medium">
              {netBalance >= 0 ? 'Net Receivable' : 'Net Payable'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center shrink-0">
            <CreditCard size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-2.5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Simple Filter Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'all' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({borrowings.length})
          </button>
          <button
            onClick={() => setActiveTab('borrow')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'borrow' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Borrow ({borrowList.length})
          </button>
          <button
            onClick={() => setActiveTab('lend')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'lend' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Lend ({lendList.length})
          </button>
        </div>

        {/* Search & Status */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:bg-white focus:border-[#084b3e] transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 outline-none cursor-pointer focus:bg-white focus:border-[#084b3e]"
          >
            <option value="all">Status: All</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partial">Partial</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Simple Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200/80">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Name & Contact</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Due Balance</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBorrowings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    <p className="font-semibold text-sm text-gray-600">No records found</p>
                    <p className="text-xs mt-1">Click "New Entry" to add a loan or lending record.</p>
                  </td>
                </tr>
              ) : (
                filteredBorrowings.map((b) => {
                  const isLend = b.type === 'lend';
                  const balance = (b.amount || 0) - (b.paidAmount || 0);
                  const dueTime = new Date(b.dueDate);
                  const isLate = b.status !== 'Paid' && (isPast(dueTime) && !isToday(dueTime));

                  return (
                    <tr 
                      key={b.id} 
                      onClick={() => setDetailsBorrowingId(b.id || null)}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                    >
                      {/* Type Badge */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isLend 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isLend ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />}
                          <span>{isLend ? 'Lend' : 'Borrow'}</span>
                        </span>
                      </td>

                      {/* Name & Phone */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-gray-900 group-hover:text-[#084b3e] transition-colors">
                          {b.lenderName}
                        </div>
                        {b.phone ? (
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{b.phone}</div>
                        ) : null}
                      </td>

                      {/* Total Amount */}
                      <td className="px-4 py-3.5 text-right font-medium text-gray-700">
                        Tk {(b.amount || 0).toLocaleString()}
                      </td>

                      {/* Due Balance */}
                      <td className="px-4 py-3.5 text-right font-bold">
                        <span className={balance > 0 ? (isLend ? 'text-emerald-700' : 'text-rose-600') : 'text-gray-400'}>
                          Tk {balance.toLocaleString()}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3.5 text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <span>{safeFormatDate(b.dueDate)}</span>
                          {isLate ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                              Overdue
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          b.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                          b.status === 'Partial' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {b.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {b.status !== 'Paid' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPaymentModal(b);
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                                isLend 
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              }`}
                            >
                              {isLend ? 'Collect' : 'Pay'}
                            </button>
                          ) : null}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(b);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(b);
                            }}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simple New Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-base text-gray-900">New Entry</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            {/* Segmented Type Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-xl my-4">
              <button
                type="button"
                onClick={() => setEntryType('borrow')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  entryType === 'borrow' ? 'bg-white text-rose-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <ArrowDownLeft size={14} />
                <span>Borrow (I Owe)</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryType('lend')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  entryType === 'lend' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <ArrowUpRight size={14} />
                <span>Lend (They Owe)</span>
              </button>
            </div>

            <form onSubmit={handleAddBorrowing} className="space-y-3">
              {/* Name with customer auto-suggest */}
              <div className="relative" ref={customerSuggestionRef}>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  {entryType === 'lend' ? 'Borrower Name *' : 'Lender Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={lenderName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLenderName(val);
                    setShowCustomerSuggestions(val.trim().length > 0);
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-[#084b3e]"
                  placeholder="Enter name"
                  autoFocus
                />

                {showCustomerSuggestions && lenderName.trim().length > 0 && (() => {
                  const query = lenderName.toLowerCase().trim();
                  const matched = customers.filter(c =>
                    c.name.toLowerCase().includes(query) || (c.phone && c.phone.includes(query))
                  );
                  if (matched.length === 0) return null;
                  return (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-36 overflow-y-auto divide-y divide-gray-50 text-xs">
                      {matched.slice(0, 5).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setLenderName(c.name);
                            if (c.phone) setPhone(c.phone);
                            setSelectedCustomerId(c.id);
                            setShowCustomerSuggestions(false);
                          }}
                          className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-gray-900">{c.name}</div>
                            {c.phone && <div className="text-[10px] text-gray-400">{c.phone}</div>}
                          </div>
                          <span className="text-[10px] text-[#084b3e] font-bold">Pick</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-[#084b3e]"
                  placeholder="01XXXXXXXXX"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Amount (Tk) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#084b3e]"
                  placeholder="0"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={borrowDate}
                    onChange={(e) => handleBorrowDateChange(e.target.value)}
                    className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#084b3e]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#084b3e]"
                  />
                </div>
              </div>

              {/* Account */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  {entryType === 'lend' ? 'Deduct From' : 'Deposit Into'}
                </label>
                <select
                  value={receiveAccount}
                  onChange={(e) => setReceiveAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none cursor-pointer focus:bg-white focus:border-[#084b3e]"
                >
                  <option value="cash">Cash Drawer</option>
                  {accounts.filter(a => a.id !== 'cash').map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                  <option value="none">Don't adjust balance</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Note</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#084b3e]"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Save Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Simple Payment Modal */}
      {isPaymentModalOpen && selectedBorrowing && (() => {
        const isLend = selectedBorrowing.type === 'lend';
        const remaining = (selectedBorrowing.amount || 0) - (selectedBorrowing.paidAmount || 0);

        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setIsPaymentModalOpen(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <h3 className="font-bold text-base text-gray-900">
                  {isLend ? 'Collect Payment' : 'Make Payment'}
                </h3>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={16} />
                </button>
              </div>

              <div className="my-3 p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                <div className="text-gray-600 font-medium">Person: <span className="font-bold text-gray-900">{selectedBorrowing.lenderName}</span></div>
                <div className="text-gray-600 font-medium">Due Balance: <span className="font-bold text-rose-600">Tk {remaining.toLocaleString()}</span></div>
              </div>

              <form onSubmit={handlePayment} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Amount (Tk) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={remaining}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#084b3e]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                    {isLend ? 'Receive Into' : 'Pay From'}
                  </label>
                  <select
                    value={payAccount}
                    onChange={(e) => setPayAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none cursor-pointer focus:bg-white focus:border-[#084b3e]"
                  >
                    <option value="cash">Cash Drawer</option>
                    {accounts.filter(a => a.id !== 'cash').map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                    <option value="none">Don't adjust balance</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className={`w-full mt-2 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer ${
                    isLend ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#084b3e] hover:bg-[#0c5e4e]'
                  }`}
                >
                  Confirm {isLend ? 'Collection' : 'Payment'}
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Simple Edit Modal */}
      {isEditModalOpen && editingBorrowing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setIsEditModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-bold text-base text-gray-900">Edit Record</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 mt-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={editLenderName}
                  onChange={(e) => setEditLenderName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-[#084b3e]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Phone</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#084b3e]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Total (Tk)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#084b3e]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Paid (Tk)</label>
                  <input
                    type="number"
                    min="0"
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#084b3e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#084b3e]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Note</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#084b3e]"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 text-center space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle size={20} />
            </div>
            <h3 className="font-bold text-sm text-gray-900">Delete Record?</h3>
            <p className="text-xs text-gray-500">
              Are you sure you want to delete <span className="font-bold text-gray-800">{deleteTarget.lenderName}</span>?
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Details Modal */}
      {activeDetailsBorrowing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setDetailsBorrowingId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeDetailsBorrowing.type === 'lend' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {activeDetailsBorrowing.type === 'lend' ? 'Lend' : 'Borrow'}
                </span>
                <h3 className="font-bold text-sm text-gray-900">{activeDetailsBorrowing.lenderName}</h3>
              </div>
              <button onClick={() => setDetailsBorrowingId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            {/* Financial summary */}
            <div className="grid grid-cols-3 gap-2 text-center p-3 bg-gray-50 rounded-xl">
              <div>
                <div className="text-[10px] font-medium text-gray-500">Total</div>
                <div className="font-bold text-xs text-gray-900 mt-0.5">
                  Tk {(activeDetailsBorrowing.amount || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-gray-500">Paid</div>
                <div className="font-bold text-xs text-emerald-600 mt-0.5">
                  Tk {(activeDetailsBorrowing.paidAmount || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-gray-500">Due</div>
                <div className="font-bold text-xs text-rose-600 mt-0.5">
                  Tk {Math.max(0, (activeDetailsBorrowing.amount || 0) - (activeDetailsBorrowing.paidAmount || 0)).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Basic details */}
            <div className="space-y-2 text-xs divide-y divide-gray-50">
              {activeDetailsBorrowing.phone ? (
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Phone:</span>
                  <a href={`tel:${activeDetailsBorrowing.phone}`} className="font-semibold text-gray-900 font-mono">
                    {activeDetailsBorrowing.phone}
                  </a>
                </div>
              ) : null}
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Date:</span>
                <span className="font-semibold text-gray-900">{safeFormatDate(activeDetailsBorrowing.date)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Due Date:</span>
                <span className="font-semibold text-gray-900">{safeFormatDate(activeDetailsBorrowing.dueDate)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Account:</span>
                <span className="font-semibold text-gray-900">{getAccountName(activeDetailsBorrowing.receiveAccount)}</span>
              </div>
              {activeDetailsBorrowing.note ? (
                <div className="py-1">
                  <span className="text-gray-500 block mb-0.5">Note:</span>
                  <p className="text-gray-700 bg-gray-50 p-2 rounded-lg text-[11px]">{activeDetailsBorrowing.note}</p>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              {activeDetailsBorrowing.status !== 'Paid' ? (
                <button
                  type="button"
                  onClick={() => {
                    const toPay = activeDetailsBorrowing;
                    setDetailsBorrowingId(null);
                    openPaymentModal(toPay);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer ${
                    activeDetailsBorrowing.type === 'lend' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#084b3e] hover:bg-[#0c5e4e]'
                  }`}
                >
                  {activeDetailsBorrowing.type === 'lend' ? 'Collect Payment' : 'Pay Back'}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  const toEdit = activeDetailsBorrowing;
                  setDetailsBorrowingId(null);
                  openEditModal(toEdit);
                }}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => {
                  const toDelete = activeDetailsBorrowing;
                  setDetailsBorrowingId(null);
                  setDeleteTarget(toDelete);
                }}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
