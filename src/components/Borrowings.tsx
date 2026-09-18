import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Borrowing } from '../db/db';
import { recordActivityLog } from '../services/activityLogService';
import { Plus, Search, HandCoins, AlertCircle, Calendar } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

export function Borrowings() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBorrowing, setSelectedBorrowing] = useState<Borrowing | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [lenderName, setLenderName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  // Payment Form State
  const [payAmount, setPayAmount] = useState('');

  const borrowings = useLiveQuery(() => 
    db.borrowings.orderBy('id').reverse().toArray()
  ) || [];

  const filteredBorrowings = borrowings.filter(b => 
    b.lenderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.phone.includes(searchQuery)
  );

  const totalBorrowed = borrowings.reduce((acc, b) => acc + b.amount, 0);
  const totalRepaid = borrowings.reduce((acc, b) => acc + b.paidAmount, 0);
  const totalOutstanding = totalBorrowed - totalRepaid;

  const handleAddBorrowing = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    await db.borrowings.add({
      date: format(now, 'yyyy-MM-dd'),
      time: format(now, 'hh:mm:ss a'),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lenderName,
      phone,
      amount: Number(amount),
      paidAmount: 0,
      dueDate,
      status: 'Unpaid',
      note
    });

    setLenderName('');
    setPhone('');
    setAmount('');
    setDueDate('');
    setNote('');
    setIsModalOpen(false);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrowing || !selectedBorrowing.id) return;

    const newPaidAmount = selectedBorrowing.paidAmount + Number(payAmount);
    const newStatus = newPaidAmount >= selectedBorrowing.amount ? 'Paid' : 'Partial';

    await db.borrowings.update(selectedBorrowing.id, {
      paidAmount: newPaidAmount,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    await recordActivityLog({
      action: 'EDIT',
      module: 'Borrowings',
      title: `Repaid Tk ${Number(payAmount).toLocaleString()} for ${selectedBorrowing.lenderName}`,
      details: `Paid amount updated to Tk ${newPaidAmount.toLocaleString()} of Tk ${selectedBorrowing.amount.toLocaleString()} (Status: ${newStatus})`,
      meta: {
        borrowingId: selectedBorrowing.id,
        lenderName: selectedBorrowing.lenderName,
        paymentAmount: Number(payAmount),
        newStatus
      }
    });

    setPayAmount('');
    setSelectedBorrowing(null);
    setIsPaymentModalOpen(false);
  };

  const openPaymentModal = (borrowing: Borrowing) => {
    setSelectedBorrowing(borrowing);
    setPayAmount((borrowing.amount - borrowing.paidAmount).toString());
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Borrowings</h1>
          <p className="text-sm text-gray-500 font-medium">Track money you owe others</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto bg-[#084b3e] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#0c5e4e] transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus size={20} />
          Add Borrowing
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="text-sm font-bold text-gray-500 mb-1">Total Borrowed</div>
          <div className="text-2xl font-black text-gray-900">Tk {totalBorrowed.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="text-sm font-bold text-emerald-600 mb-1">Total Repaid</div>
          <div className="text-2xl font-black text-emerald-700">Tk {totalRepaid.toLocaleString()}</div>
        </div>
        <div className="bg-rose-50 p-5 rounded-2xl shadow-sm border border-rose-100 flex flex-col justify-center">
          <div className="text-sm font-bold text-rose-600 mb-1">Total Outstanding</div>
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
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none transition-all shadow-sm font-medium"
        />
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Lender Details</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBorrowings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <HandCoins size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="font-medium text-base">No borrowings found</p>
                    <p className="text-xs mt-1 text-gray-400">Add a record to start tracking.</p>
                  </td>
                </tr>
              ) : (
                filteredBorrowings.map((b) => {
                  const balance = b.amount - b.paidAmount;
                  const dueTime = new Date(b.dueDate);
                  const isLate = b.status !== 'Paid' && (isPast(dueTime) && !isToday(dueTime));

                  return (
                    <tr key={b.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{b.lenderName}</div>
                        <div className="text-xs text-gray-500">{b.phone}</div>
                        {b.note && <div className="text-[10px] text-gray-400 mt-1 max-w-[200px] truncate">{b.note}</div>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-bold text-gray-900">Tk {b.amount.toLocaleString()}</div>
                        <div className="text-xs text-emerald-600">Paid: Tk {b.paidAmount.toLocaleString()}</div>
                        <div className="text-xs text-rose-600 font-bold">Due: Tk {balance.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-1.5 text-xs font-bold ${isLate ? 'text-rose-600 bg-rose-50 px-2 py-1 rounded-md inline-flex' : 'text-gray-600'}`}>
                          <Calendar size={14} />
                          {format(new Date(b.dueDate), 'dd/MM/yy')}
                        </div>
                        {isLate && <div className="text-[10px] text-rose-500 mt-1 flex items-center gap-1"><AlertCircle size={10}/> Overdue</div>}
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
                      <td className="px-6 py-4 text-right">
                        {b.status !== 'Paid' && (
                          <button
                            onClick={() => openPaymentModal(b)}
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                          >
                            Repay
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Borrowing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <HandCoins size={20} className="text-[#084b3e]" />
                Record Borrowing
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="add-borrowing-form" onSubmit={handleAddBorrowing} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Lender Name</label>
                  <input
                    type="text"
                    required
                    value={lenderName}
                    onChange={(e) => setLenderName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-colors text-sm font-medium outline-none"
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Phone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-colors text-sm font-medium outline-none"
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Amount (Tk)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-colors text-sm font-medium outline-none font-mono"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Due Date</label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-colors text-sm font-medium outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Note (Optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-colors text-sm font-medium outline-none resize-none"
                    placeholder="Reason for borrowing..."
                  />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-borrowing-form"
                className="px-6 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white text-sm font-bold rounded-xl shadow-sm transition-colors"
              >
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {isPaymentModalOpen && selectedBorrowing && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-lg text-gray-900">Repayment</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="font-medium text-gray-600">Repaying to: <span className="font-bold text-gray-900">{selectedBorrowing.lenderName}</span></div>
                <div className="font-medium text-gray-600 mt-1">Outstanding: <span className="font-bold text-rose-600">Tk {(selectedBorrowing.amount - selectedBorrowing.paidAmount).toLocaleString()}</span></div>
              </div>

              <form id="payment-form" onSubmit={handlePayment}>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Payment Amount (Tk)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedBorrowing.amount - selectedBorrowing.paidAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-colors text-lg font-black outline-none font-mono text-center"
                />
              </form>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="payment-form"
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
