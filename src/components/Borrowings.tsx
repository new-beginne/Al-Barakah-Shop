import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Borrowing, Customer } from '../db/db';
import { recordActivityLog } from '../services/activityLogService';
import { adjustAccountBalance } from '../services/accountService';
import { 
  Plus, 
  Search, 
  HandCoins, 
  AlertCircle, 
  Calendar, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  Phone, 
  Clock, 
  Wallet, 
  FileText, 
  X, 
  Check, 
  Copy,
  User
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

  // Form State (Add)
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

  // Borrow More State (Row Details Modal)
  const [isBorrowMoreModalOpen, setIsBorrowMoreModalOpen] = useState(false);
  const [borrowMoreTarget, setBorrowMoreTarget] = useState<Borrowing | null>(null);
  const [borrowMoreAmount, setBorrowMoreAmount] = useState('');
  const [borrowMoreDate, setBorrowMoreDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [borrowMoreAccount, setBorrowMoreAccount] = useState('cash');
  const [borrowMoreDueDate, setBorrowMoreDueDate] = useState('');
  const [borrowMoreNote, setBorrowMoreNote] = useState('');

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

  // Live lookup for active details modal
  const activeDetailsBorrowing = detailsBorrowingId 
    ? borrowings.find(b => b.id === detailsBorrowingId) || null 
    : null;

  const filteredBorrowings = borrowings.filter(b => 
    b.lenderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.phone || '').includes(searchQuery)
  );

  const totalBorrowed = borrowings.reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalRepaid = borrowings.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
  const totalOutstanding = totalBorrowed - totalRepaid;

  const getAccountName = (accId?: string) => {
    if (!accId || accId === 'none') return 'None';
    if (accId.toLowerCase() === 'cash') return 'Cash Drawer';
    const found = accounts.find(a => a.id.toLowerCase() === accId.toLowerCase());
    return found ? `${found.name} (${found.type.toUpperCase()})` : accId;
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

  const handleDirectDueDateChange = (newDueDate: string) => {
    setDueDate(newDueDate);
    if (newDueDate && borrowDate) {
      try {
        const diff = differenceInDays(new Date(newDueDate), new Date(borrowDate));
        if (diff > 0) {
          setDurationDays(String(diff));
        }
      } catch {}
    }
  };

  const handleAddBorrowing = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const parsedAmount = Number(amount) || 0;
    const entryDate = borrowDate || format(now, 'yyyy-MM-dd');

    // Requirement: If lender is not in customer list, auto-add to customers!
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
          notes: 'Auto-added from Borrowings (Lender)',
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
      await adjustAccountBalance(receiveAccount, parsedAmount);
    }

    await recordActivityLog({
      action: 'CREATE',
      module: 'Borrowings',
      title: `Borrowing Tk ${parsedAmount.toLocaleString()} from ${lenderName}`,
      details: `Received in ${getAccountName(receiveAccount)} (Due: ${dueDate}, Date: ${entryDate})`,
      meta: { borrowingId: newId, lenderName, amount: parsedAmount, receiveAccount, date: entryDate }
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
    setSuccessMsg(`Recorded borrowing of Tk ${parsedAmount.toLocaleString()} successfully.`);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrowing || !selectedBorrowing.id) return;

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
      await adjustAccountBalance(payAccount, -paymentNum);
    }

    await recordActivityLog({
      action: 'EDIT',
      module: 'Borrowings',
      title: `Repaid Tk ${paymentNum.toLocaleString()} to ${selectedBorrowing.lenderName}`,
      details: `Paid amount updated to Tk ${newPaidAmount.toLocaleString()} of Tk ${totalAmount.toLocaleString()} from ${getAccountName(payAccount)}`,
      meta: {
        borrowingId: selectedBorrowing.id,
        lenderName: selectedBorrowing.lenderName,
        paymentAmount: paymentNum,
        payAccount,
        newStatus
      }
    });

    setPayAmount('');
    setSelectedBorrowing(null);
    setIsPaymentModalOpen(false);
    setSuccessMsg(`Repayment of Tk ${paymentNum.toLocaleString()} processed successfully.`);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const openPaymentModal = (borrowing: Borrowing) => {
    setSelectedBorrowing(borrowing);
    setPayAmount(((borrowing.amount || 0) - (borrowing.paidAmount || 0)).toString());
    setPayAccount('cash');
    setIsPaymentModalOpen(true);
  };

  const openBorrowMoreModal = (b: Borrowing) => {
    setBorrowMoreTarget(b);
    setBorrowMoreAmount('');
    setBorrowMoreDate(format(new Date(), 'yyyy-MM-dd'));
    setBorrowMoreAccount(b.receiveAccount || 'cash');
    setBorrowMoreDueDate(b.dueDate || '');
    setBorrowMoreNote('');
    setIsBorrowMoreModalOpen(true);
  };

  const handleConfirmBorrowMore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowMoreTarget || !borrowMoreTarget.id) return;

    const additionalNum = Number(borrowMoreAmount) || 0;
    if (additionalNum <= 0) return;

    const currentAmount = borrowMoreTarget.amount || 0;
    const currentPaid = borrowMoreTarget.paidAmount || 0;
    const newTotalAmount = currentAmount + additionalNum;
    const newStatus = currentPaid >= newTotalAmount ? 'Paid' : (currentPaid > 0 ? 'Partial' : 'Unpaid');

    const entryDate = borrowMoreDate || format(new Date(), 'yyyy-MM-dd');
    const appendNote = `[+Tk ${additionalNum.toLocaleString()} on ${entryDate}${borrowMoreNote.trim() ? `: ${borrowMoreNote.trim()}` : ''}]`;
    const updatedNote = borrowMoreTarget.note ? `${borrowMoreTarget.note}\n${appendNote}` : appendNote;

    await db.transaction('rw', [db.borrowings, db.accounts, db.balanceLogs, db.activityLogs], async () => {
      await db.borrowings.update(borrowMoreTarget.id!, {
        amount: newTotalAmount,
        status: newStatus,
        dueDate: borrowMoreDueDate || borrowMoreTarget.dueDate,
        note: updatedNote,
        receiveAccount: borrowMoreAccount !== 'none' ? borrowMoreAccount : borrowMoreTarget.receiveAccount,
        updatedAt: new Date().toISOString()
      });

      if (borrowMoreAccount !== 'none' && additionalNum > 0) {
        await adjustAccountBalance(borrowMoreAccount, additionalNum);
      }
    });

    await recordActivityLog({
      action: 'EDIT',
      module: 'Borrowings',
      title: `Borrowed additional Tk ${additionalNum.toLocaleString()} from ${borrowMoreTarget.lenderName}`,
      details: `Total increased from Tk ${currentAmount.toLocaleString()} to Tk ${newTotalAmount.toLocaleString()} (Received in ${getAccountName(borrowMoreAccount)})`,
      meta: {
        borrowingId: borrowMoreTarget.id,
        lenderName: borrowMoreTarget.lenderName,
        additionalAmount: additionalNum,
        newTotalAmount,
        borrowDate: entryDate,
        receiveAccount: borrowMoreAccount
      }
    });

    setIsBorrowMoreModalOpen(false);
    setBorrowMoreTarget(null);
    setSuccessMsg(`Successfully added Tk ${additionalNum.toLocaleString()} to ${borrowMoreTarget.lenderName}'s account.`);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const openEditModal = (b: Borrowing) => {
    setEditingBorrowing(b);
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

    let newStatus: 'Unpaid' | 'Partial' | 'Paid' = 'Unpaid';
    if (parsedNewPaid >= parsedNewAmount && parsedNewAmount > 0) {
      newStatus = 'Paid';
    } else if (parsedNewPaid > 0) {
      newStatus = 'Partial';
    } else {
      newStatus = 'Unpaid';
    }

    // Account Balance adjustment logic if requested by user
    if (editAdjustBalance) {
      if (oldAccount === newAccount) {
        if (newAccount !== 'none') {
          const diff = parsedNewAmount - oldAmount;
          if (diff !== 0) {
            await adjustAccountBalance(newAccount, diff);
          }
        }
      } else {
        if (oldAccount !== 'none' && oldAmount > 0) {
          await adjustAccountBalance(oldAccount, -oldAmount);
        }
        if (newAccount !== 'none' && parsedNewAmount > 0) {
          await adjustAccountBalance(newAccount, parsedNewAmount);
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
          notes: 'Auto-added from Borrowings (Lender)',
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

    await recordActivityLog({
      action: 'EDIT',
      module: 'Borrowings',
      title: `Updated borrowing for ${editLenderName.trim()}`,
      details: `Amount: Tk ${parsedNewAmount.toLocaleString()} (Paid: Tk ${parsedNewPaid.toLocaleString()}), Account: ${getAccountName(newAccount)}, Due: ${editDueDate}`,
      meta: { 
        borrowingId: editingBorrowing.id,
        oldAmount,
        newAmount: parsedNewAmount,
        oldPaid: editingBorrowing.paidAmount,
        newPaid: parsedNewPaid,
        receiveAccount: newAccount,
        balanceAdjusted: editAdjustBalance
      }
    });

    setIsEditModalOpen(false);
    setEditingBorrowing(null);
    setSuccessMsg('Borrowing record updated successfully.');
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;

    // Calculate un-repaid amount received into account
    const netRemaining = (deleteTarget.amount || 0) - (deleteTarget.paidAmount || 0);
    const targetAccount = deleteTarget.receiveAccount;

    await db.transaction('rw', db.borrowings, db.accounts, db.balanceLogs, db.activityLogs, async () => {
      await db.borrowings.delete(deleteTarget.id!);

      if (targetAccount && targetAccount !== 'none' && netRemaining > 0) {
        await adjustAccountBalance(targetAccount, -netRemaining);
      }
    });

    await recordActivityLog({
      action: 'DELETE',
      module: 'Borrowings',
      title: `Deleted borrowing record: ${deleteTarget.lenderName}`,
      details: `Amount: Tk ${deleteTarget.amount.toLocaleString()}, Repaid: Tk ${deleteTarget.paidAmount.toLocaleString()}${targetAccount && targetAccount !== 'none' && netRemaining > 0 ? ` (Reversed Tk ${netRemaining.toLocaleString()} from ${getAccountName(targetAccount)})` : ''}`,
      meta: { borrowingId: deleteTarget.id, lenderName: deleteTarget.lenderName, reversedAmount: netRemaining, account: targetAccount }
    });

    if (detailsBorrowingId === deleteTarget.id) {
      setDetailsBorrowingId(null);
    }
    setDeleteTarget(null);
    setSuccessMsg('Borrowing record deleted and account balance updated.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#084b3e] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 size={18} className="text-emerald-300" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <HandCoins className="text-[#084b3e]" />
            Borrowings
          </h1>
          <p className="text-sm text-gray-500 font-medium">Track borrowed funds and repayments</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto bg-[#084b3e] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#0c5e4e] transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Plus size={20} />
          Add Borrowing
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Borrowed</div>
          <div className="text-2xl font-black text-gray-900">Tk {totalBorrowed.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Repaid</div>
          <div className="text-2xl font-black text-emerald-700">Tk {totalRepaid.toLocaleString()}</div>
        </div>
        <div className="bg-rose-50 p-5 rounded-2xl shadow-sm border border-rose-100 flex flex-col justify-center">
          <div className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Total Outstanding</div>
          <div className="text-2xl font-black text-rose-700">Tk {totalOutstanding.toLocaleString()}</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none transition-all shadow-sm font-medium text-sm"
        />
      </div>

      {/* Table List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/75 text-gray-500 font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Lender Details</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBorrowings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <HandCoins size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="font-bold text-base text-gray-700">No borrowings found</p>
                    <p className="text-xs mt-1 text-gray-400">Click Add Borrowing to record a loan.</p>
                  </td>
                </tr>
              ) : (
                filteredBorrowings.map((b) => {
                  const balance = (b.amount || 0) - (b.paidAmount || 0);
                  const dueTime = new Date(b.dueDate);
                  const isLate = b.status !== 'Paid' && (isPast(dueTime) && !isToday(dueTime));

                  return (
                    <tr 
                      key={b.id} 
                      onClick={() => setDetailsBorrowingId(b.id || null)}
                      className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 group-hover:text-[#084b3e] transition-colors">
                          {b.lenderName}
                        </div>
                        {b.phone ? (
                          <div className="text-xs text-gray-500 font-mono">{b.phone}</div>
                        ) : (
                          <div className="text-[11px] text-gray-400 italic">No phone</div>
                        )}
                        {b.receiveAccount && (
                          <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                            <Wallet size={11} className="text-gray-400" />
                            <span>{getAccountName(b.receiveAccount)}</span>
                          </div>
                        )}
                        {b.note && <div className="text-[10px] text-gray-400 mt-0.5 max-w-[200px] truncate">{b.note}</div>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-black text-gray-900">Tk {(b.amount || 0).toLocaleString()}</div>
                        <div className="text-xs text-emerald-600 font-medium">Paid: Tk {(b.paidAmount || 0).toLocaleString()}</div>
                        <div className="text-xs text-rose-600 font-bold">Due: Tk {balance.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-1.5 text-xs font-bold ${isLate ? 'text-rose-600 bg-rose-50 px-2 py-1 rounded-md inline-flex' : 'text-gray-600'}`}>
                          <Calendar size={14} />
                          {safeFormatDate(b.dueDate, 'dd/MM/yyyy')}
                        </div>
                        {isLate && (
                          <div className="text-[10px] text-rose-500 mt-1 flex items-center gap-1 font-semibold">
                            <AlertCircle size={10}/> Overdue
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          b.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                          b.status === 'Partial' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {b.status !== 'Paid' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPaymentModal(b);
                              }}
                              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Repay
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(b);
                            }}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(b);
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={15} />
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

      {/* Details Modal (Row Click) */}
      {activeDetailsBorrowing && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/75 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#084b3e]/10 text-[#084b3e] flex items-center justify-center">
                  <HandCoins size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Borrowing Details</h3>
                  <p className="text-xs text-gray-500">ID: #BOR-{activeDetailsBorrowing.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setDetailsBorrowingId(null)} 
                className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Profile Card */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#084b3e] text-white flex items-center justify-center font-black text-xl shadow-xs">
                    {activeDetailsBorrowing.lenderName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-gray-900">{activeDetailsBorrowing.lenderName}</h4>
                    {activeDetailsBorrowing.phone ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <a 
                          href={`tel:${activeDetailsBorrowing.phone}`}
                          className="text-xs font-bold text-gray-600 hover:text-[#084b3e] flex items-center gap-1 font-mono transition-colors"
                        >
                          <Phone size={12} className="text-[#084b3e]" />
                          {activeDetailsBorrowing.phone}
                        </a>
                        <button
                          onClick={() => handleCopyPhone(activeDetailsBorrowing.phone)}
                          className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-white transition-colors cursor-pointer"
                          title="Copy phone"
                        >
                          {copiedPhone ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic mt-0.5">No phone number</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      activeDetailsBorrowing.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                      activeDetailsBorrowing.status === 'Partial' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {activeDetailsBorrowing.status}
                    </span>
                    {activeDetailsBorrowing.status !== 'Paid' && (
                      isPast(new Date(activeDetailsBorrowing.dueDate)) && !isToday(new Date(activeDetailsBorrowing.dueDate))
                    ) && (
                      <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                        <AlertCircle size={11} /> Overdue
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openBorrowMoreModal(activeDetailsBorrowing)}
                    className="px-3 py-1.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
                  >
                    <Plus size={13} />
                    Borrow More
                  </button>
                </div>
              </div>

              {/* Financial Metrics */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-center">
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Amount</div>
                  <div className="text-lg font-black text-gray-900">Tk {(activeDetailsBorrowing.amount || 0).toLocaleString()}</div>
                </div>
                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100 text-center">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Paid Amount</div>
                  <div className="text-lg font-black text-emerald-700">Tk {(activeDetailsBorrowing.paidAmount || 0).toLocaleString()}</div>
                </div>
                <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-100 text-center">
                  <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1">Due Amount</div>
                  <div className="text-lg font-black text-rose-700">
                    Tk {Math.max(0, (activeDetailsBorrowing.amount || 0) - (activeDetailsBorrowing.paidAmount || 0)).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-500">Repayment Progress</span>
                  <span className="text-[#084b3e]">
                    {activeDetailsBorrowing.amount > 0 
                      ? Math.min(100, Math.round(((activeDetailsBorrowing.paidAmount || 0) / activeDetailsBorrowing.amount) * 100))
                      : 0}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#084b3e] to-emerald-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${activeDetailsBorrowing.amount > 0 
                        ? Math.min(100, Math.round(((activeDetailsBorrowing.paidAmount || 0) / activeDetailsBorrowing.amount) * 100))
                        : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Details List */}
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 text-sm">
                <div className="py-2.5 px-4 flex justify-between items-center">
                  <span className="text-gray-500 font-medium flex items-center gap-2">
                    <Calendar size={15} className="text-gray-400" />
                    Date Recorded
                  </span>
                  <span className="font-bold text-gray-900">
                    {safeFormatDate(activeDetailsBorrowing.date, 'dd MMM, yyyy')}
                    {activeDetailsBorrowing.time ? ` (${activeDetailsBorrowing.time})` : ''}
                  </span>
                </div>

                <div className="py-2.5 px-4 flex justify-between items-center">
                  <span className="text-gray-500 font-medium flex items-center gap-2">
                    <Clock size={15} className="text-gray-400" />
                    Due Date
                  </span>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">
                      {safeFormatDate(activeDetailsBorrowing.dueDate, 'dd MMM, yyyy')}
                    </div>
                    {activeDetailsBorrowing.dueDate && activeDetailsBorrowing.status !== 'Paid' && (
                      <div className="text-[11px] text-gray-500 font-medium">
                        {(() => {
                          const diff = differenceInDays(new Date(activeDetailsBorrowing.dueDate), new Date());
                          if (diff > 0) return `${diff} days left`;
                          if (diff === 0) return 'Due today';
                          return `${Math.abs(diff)} days overdue`;
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="py-2.5 px-4 flex justify-between items-center">
                  <span className="text-gray-500 font-medium flex items-center gap-2">
                    <Wallet size={15} className="text-gray-400" />
                    Receive Account
                  </span>
                  <span className="font-bold text-gray-900">
                    {getAccountName(activeDetailsBorrowing.receiveAccount)}
                  </span>
                </div>

                {activeDetailsBorrowing.note && (
                  <div className="py-2.5 px-4 flex flex-col gap-1">
                    <span className="text-gray-500 font-medium flex items-center gap-2">
                      <FileText size={15} className="text-gray-400" />
                      Note
                    </span>
                    <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-xl border border-gray-100 whitespace-pre-wrap">
                      {activeDetailsBorrowing.note}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = activeDetailsBorrowing;
                    setDetailsBorrowingId(null);
                    setDeleteTarget(toDelete);
                  }}
                  className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = activeDetailsBorrowing;
                    setDetailsBorrowingId(null);
                    openEditModal(toEdit);
                  }}
                  className="px-3.5 py-2 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const toBorrow = activeDetailsBorrowing;
                    openBorrowMoreModal(toBorrow);
                  }}
                  className="px-4 py-2 bg-[#084b3e] hover:bg-[#0c5e4e] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  Borrow More
                </button>
                {activeDetailsBorrowing.status !== 'Paid' && (
                  <button
                    type="button"
                    onClick={() => {
                      const toPay = activeDetailsBorrowing;
                      setDetailsBorrowingId(null);
                      openPaymentModal(toPay);
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    Repay
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailsBorrowingId(null)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Borrowing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-[#182236] mb-6 text-center">
              Add New Borrowing
            </h3>

            <form onSubmit={handleAddBorrowing} className="space-y-4">
              <div className="relative" ref={customerSuggestionRef}>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                  Name *
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
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl font-bold outline-none text-sm text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                  placeholder="Enter or search lender name"
                  autoFocus
                />

                {/* Customer Suggestions Dropdown - Only shown when keywords are typed */}
                {showCustomerSuggestions && lenderName.trim().length > 0 && (() => {
                  const query = lenderName.toLowerCase().trim();
                  const matched = customers.filter(c =>
                    c.name.toLowerCase().includes(query) ||
                    (c.phone && c.phone.includes(query))
                  );
                  if (matched.length === 0) return null;
                  return (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#dce1e7] rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-gray-50">
                      {matched.slice(0, 8).map(c => (
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
                          className="w-full p-2.5 text-left hover:bg-emerald-50 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-xs text-gray-900">{c.name}</div>
                            {c.phone && <div className="text-[11px] text-gray-500 font-mono">{c.phone}</div>}
                          </div>
                          <span className="text-[10px] font-bold text-[#075b4d]">Select</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium outline-none text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-mono"
                  placeholder="01XXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                  Amount (Tk) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl font-bold outline-none text-sm text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-mono"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                    Borrow Date
                  </label>
                  <input
                    type="date"
                    required
                    value={borrowDate}
                    onChange={(e) => handleBorrowDateChange(e.target.value)}
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium outline-none text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                    Due In (Days)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={durationDays}
                    onChange={(e) => updateDurationDays(e.target.value)}
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl font-bold outline-none text-sm text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-mono"
                    placeholder="30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                  Receive In Account
                </label>
                <select
                  value={receiveAccount}
                  onChange={(e) => setReceiveAccount(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium outline-none text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all cursor-pointer"
                >
                  <option value="cash">Cash Drawer</option>
                  {accounts.filter(a => a.id !== 'cash').map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type.toUpperCase()})</option>
                  ))}
                  <option value="none">Do not adjust account balance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason or notes..."
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium outline-none text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer active:translate-y-px flex items-center justify-center"
                >
                  Save Borrowing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Borrowing Modal */}
      {isEditModalOpen && editingBorrowing && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setIsEditModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-[#182236] mb-6 text-center">
              Edit Borrowing Record
            </h3>
            
            <form id="edit-borrowing-form" onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">Lender Name *</label>
                  <input
                    type="text"
                    required
                    value={editLenderName}
                    onChange={(e) => setEditLenderName(e.target.value)}
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-mono"
                    placeholder="01XXXXXXXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">Borrow Date</label>
                  <input
                    type="date"
                    required
                    value={editBorrowDate}
                    onChange={(e) => setEditBorrowDate(e.target.value)}
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">Due Date</label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#f8f9fa] rounded-xl border border-[#dce1e7]">
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                    Borrowed Amount (Tk)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full h-[47px] px-4 bg-white border border-[#dce1e7] rounded-xl text-base font-black text-[#1d2939] outline-none focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1.5 uppercase tracking-wider">
                    Repaid Amount (Tk)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(e.target.value)}
                    className="w-full h-[47px] px-4 bg-white border border-[#dce1e7] rounded-xl text-base font-black text-emerald-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
                  />
                </div>
                <div className="sm:col-span-2 pt-1 flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-500">Calculated Due:</span>
                  <span className="text-rose-600 font-mono text-sm">
                    Tk {Math.max(0, (Number(editAmount) || 0) - (Number(editPaidAmount) || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2 p-3.5 bg-[#f8f9fa] rounded-xl border border-[#dce1e7]">
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                    Receive Account
                  </label>
                  <select
                    value={editReceiveAccount}
                    onChange={(e) => setEditReceiveAccount(e.target.value)}
                    className="w-full h-[47px] px-4 bg-white border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] outline-none focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 transition-all cursor-pointer"
                  >
                    <option value="cash">Cash Drawer</option>
                    {accounts.filter(a => a.id !== 'cash').map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type.toUpperCase()})</option>
                    ))}
                    <option value="none">Do not adjust account balance</option>
                  </select>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-gray-700">
                    <input
                      type="checkbox"
                      checked={editAdjustBalance}
                      onChange={(e) => setEditAdjustBalance(e.target.checked)}
                      className="w-4 h-4 rounded text-[#075b4d] focus:ring-[#075b4d] cursor-pointer"
                    />
                    <span>Adjust account balance with amount difference</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">Note (Optional)</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={2}
                  className="w-full min-h-[80px] p-3.5 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all resize-none"
                  placeholder="Notes..."
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer active:translate-y-px flex items-center justify-center"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-2 border border-red-100">
              <AlertCircle size={28} strokeWidth={2.5} />
            </div>
            <h3 className="font-bold text-xl text-[#182236]">Delete Borrowing Record?</h3>
            <p className="text-sm text-gray-500 font-medium">
              Are you sure you want to delete the borrowing record for <span className="font-bold text-gray-900">{deleteTarget.lenderName}</span> (Tk {deleteTarget.amount.toLocaleString()})?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {isPaymentModalOpen && selectedBorrowing && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-[#182236] mb-2 text-center">Record Repayment</h3>
            <div className="mb-5 text-sm bg-[#f8f9fa] p-3.5 rounded-xl border border-[#dce1e7] text-center">
              <div className="font-medium text-gray-600">Lender: <span className="font-bold text-gray-900">{selectedBorrowing.lenderName}</span></div>
              <div className="font-medium text-gray-600 mt-1">Outstanding: <span className="font-bold text-rose-600">Tk {((selectedBorrowing.amount || 0) - (selectedBorrowing.paidAmount || 0)).toLocaleString()}</span></div>
            </div>

            <form id="payment-form" onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">Payment Amount (Tk) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={(selectedBorrowing.amount || 0) - (selectedBorrowing.paidAmount || 0)}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl outline-none text-base font-black text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-mono text-center"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">Pay From Account</label>
                <select
                  value={payAccount}
                  onChange={(e) => setPayAccount(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl outline-none text-sm font-bold text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all cursor-pointer"
                >
                  <option value="cash">Cash Drawer</option>
                  {accounts.filter(a => a.id !== 'cash').map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type.toUpperCase()})</option>
                  ))}
                  <option value="none">Do not adjust account balance</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer active:translate-y-px flex items-center justify-center"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Borrow More Modal (Row Details Action) */}
      {isBorrowMoreModalOpen && borrowMoreTarget && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setIsBorrowMoreModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-[#182236] mb-1 text-center">Borrow Additional Amount</h3>
            <p className="text-center text-xs text-gray-500 font-semibold mb-5">Lender: <span className="font-bold text-gray-800">{borrowMoreTarget.lenderName}</span></p>

            <div className="space-y-4">
              {/* Current Status Banner */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-[#f8f9fa] rounded-xl border border-[#dce1e7] text-center">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Current Loan</span>
                  <div className="font-black text-sm text-gray-900">Tk {(borrowMoreTarget.amount || 0).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Paid Back</span>
                  <div className="font-black text-sm text-emerald-700">Tk {(borrowMoreTarget.paidAmount || 0).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Current Due</span>
                  <div className="font-black text-sm text-rose-700">
                    Tk {Math.max(0, (borrowMoreTarget.amount || 0) - (borrowMoreTarget.paidAmount || 0)).toLocaleString()}
                  </div>
                </div>
              </div>

              <form id="borrow-more-form" onSubmit={handleConfirmBorrowMore} className="space-y-4">
                {/* Additional Amount */}
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                    Additional Amount (Tk) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    autoFocus
                    value={borrowMoreAmount}
                    onChange={(e) => setBorrowMoreAmount(e.target.value)}
                    placeholder="0"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-base font-black text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-mono"
                  />
                </div>

                {/* Dates Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider flex items-center justify-between">
                      <span>Borrow Date</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={borrowMoreDate}
                      onChange={(e) => setBorrowMoreDate(e.target.value)}
                      className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                      Extended Due Date
                    </label>
                    <input
                      type="date"
                      value={borrowMoreDueDate}
                      onChange={(e) => setBorrowMoreDueDate(e.target.value)}
                      className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Receive In Account */}
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                    Receive In Account
                  </label>
                  <select
                    value={borrowMoreAccount}
                    onChange={(e) => setBorrowMoreAccount(e.target.value)}
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all cursor-pointer"
                  >
                    <option value="cash">Cash Drawer</option>
                    {accounts.filter(a => a.id !== 'cash').map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type.toUpperCase()})</option>
                    ))}
                    <option value="none">Do not adjust account balance</option>
                  </select>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={borrowMoreNote}
                    onChange={(e) => setBorrowMoreNote(e.target.value)}
                    placeholder="e.g. Additional emergency fund"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                  />
                </div>

                {/* Calculation Impact Preview */}
                {Number(borrowMoreAmount) > 0 && (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
                    <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Summary After Adding:
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>New Total Loan:</span>
                      <span className="font-black text-gray-900 font-mono">
                        Tk {((borrowMoreTarget.amount || 0) + (Number(borrowMoreAmount) || 0)).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>New Total Due:</span>
                      <span className="font-black font-mono">
                        Tk {Math.max(0, ((borrowMoreTarget.amount || 0) + (Number(borrowMoreAmount) || 0)) - (borrowMoreTarget.paidAmount || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!(Number(borrowMoreAmount) > 0)}
                    className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} />
                    Confirm & Add
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
