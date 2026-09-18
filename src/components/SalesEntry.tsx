import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, Sale, getRecordMetadata } from '../db/db';
import { adjustAccountBalance, mapPaymentMethodToAccountId } from '../services/accountService';
import { logSaleDelete } from '../services/activityLogService';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { 
  Search, 
  ShoppingCart, 
  TrendingUp, 
  AlertCircle, 
  Trash2, 
  X, 
  CheckCircle2, 
  User, 
  Share2, 
  Printer, 
  FileText,
  Clock,
  Calendar,
  Layers,
  DollarSign,
  Tag,
  ChevronRight
} from 'lucide-react';
import { formatDateStr } from '../utils/dateFormatter';

export function SalesEntry() {
  const [searchParams] = useSearchParams();
  
  // Modals & Feedback
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [detailsSale, setDetailsSale] = useState<Sale | null>(null);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Filters & Search for History Table
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'amount-high' | 'profit-high'>('newest');

  // Form State (Always visible on top)
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [amount, setAmount] = useState('');
  const [cost, setCost] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [note, setNote] = useState('');

  // Due / Customer Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dueAmount, setDueAmount] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const customerSuggestionRef = useRef<HTMLDivElement>(null);

  // Live queries from Dexie
  const sales = useLiveQuery(() => db.sales.orderBy('id').reverse().toArray()) || [];
  const services = useLiveQuery(() => db.services.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];

  // Today metrics
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaySales = useMemo(() => sales.filter(s => s.date === todayStr), [sales, todayStr]);

  const todaySalesTotal = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + (s.amount || 0), 0);
  }, [todaySales]);

  const todayProfitTotal = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
  }, [todaySales]);

  const todayDueTotal = useMemo(() => {
    return todaySales
      .filter(s => s.paymentMethod === 'Due')
      .reduce((sum, s) => sum + (s.amount || 0), 0);
  }, [todaySales]);

  // Handle URL query parameters for pre-filling customer
  useEffect(() => {
    const cust = searchParams.get('customer');
    const ph = searchParams.get('phone');
    if (cust) {
      setCustomerName(cust);
      if (ph) setCustomerPhone(ph);
    }
  }, [searchParams]);

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

  // Service selection handler
  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedServiceId(val);
    const q = Math.max(1, parseInt(quantity) || 1);
    
    if (val === 'other') {
      setUnitPrice('');
      setUnitCost('');
      setAmount('');
      setCost('');
      setCategory('General');
    } else {
      const found = services.find(s => s.id?.toString() === val);
      if (found) {
        const uPrice = found.defaultPrice ? found.defaultPrice.toString() : '';
        const uCost = found.defaultCost ? found.defaultCost.toString() : '';
        setUnitPrice(uPrice);
        setUnitCost(uCost);
        setCategory(found.category || 'General');

        if (uPrice) {
          setAmount((parseFloat(uPrice) * q).toString());
        } else {
          setAmount('');
        }

        if (uCost) {
          setCost((parseFloat(uCost) * q).toString());
        } else {
          setCost('');
        }
      }
    }
  };

  const updateQuantity = (newQtyStr: string) => {
    setQuantity(newQtyStr);
    const q = parseInt(newQtyStr);
    if (!isNaN(q) && q > 0) {
      if (unitPrice) {
        setAmount((parseFloat(unitPrice) * q).toString());
      }
      if (unitCost) {
        setCost((parseFloat(unitCost) * q).toString());
      }
    } else if (newQtyStr === '') {
      if (unitPrice) {
        setAmount(unitPrice);
      }
      if (unitCost) {
        setCost(unitCost);
      }
    }
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const q = parseInt(quantity) || 1;
    if (val && !isNaN(parseFloat(val))) {
      setUnitPrice((parseFloat(val) / q).toString());
    } else {
      setUnitPrice('');
    }
  };

  const handleCostChange = (val: string) => {
    setCost(val);
    const q = parseInt(quantity) || 1;
    if (val && !isNaN(parseFloat(val))) {
      setUnitCost((parseFloat(val) / q).toString());
    } else {
      setUnitCost('');
    }
  };

  const currentProfit = (parseFloat(amount) || 0) - (parseFloat(cost) || 0);

  const resetForm = () => {
    setSelectedServiceId('');
    setCustomServiceName('');
    setCategory('');
    setQuantity('');
    setUnitPrice('');
    setUnitCost('');
    setAmount('');
    setCost('');
    setPaymentMethod('Cash');
    setNote('');
    setCustomerName('');
    setCustomerPhone('');
    setDueAmount('');
  };

  // Submit sale
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const finalServiceName = selectedServiceId === 'other' 
      ? (customServiceName.trim() || 'Custom Service')
      : (services.find(s => s.id?.toString() === selectedServiceId)?.name || 'General Service');

    const calculatedPaidAmount = paymentMethod === 'Due'
      ? (parsedAmount - (dueAmount === '' ? parsedAmount : (parseFloat(dueAmount) || 0)))
      : parsedAmount;

    const calculatedDueAmount = paymentMethod === 'Due'
      ? (dueAmount === '' ? parsedAmount : (parseFloat(dueAmount) || 0))
      : 0;

    const { date, time, createdAt, updatedAt } = getRecordMetadata();

    // Auto-save customer if Due or Customer Name specified
    if ((paymentMethod === 'Due' || customerName.trim() !== '') && customerName.trim() !== '') {
      const existing = customers.find(c => c.name.toLowerCase().trim() === customerName.toLowerCase().trim());
      if (!existing) {
        await db.customers.add({
          name: customerName.trim(),
          phone: customerPhone.trim(),
          createdAt,
          updatedAt
        });
      }
    }

    const newSale: Sale = {
      date,
      time,
      createdAt,
      updatedAt,
      category: category || 'General',
      serviceName: finalServiceName,
      amount: parsedAmount,
      cost: parseFloat(cost) || 0,
      profit: currentProfit,
      paymentMethod,
      note: note.trim(),
      customerName: customerName.trim() || undefined,
      quantity: parseInt(quantity) || 1,
      unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
      unitCost: unitCost ? parseFloat(unitCost) : undefined
    };

    try {
      const saleId = await db.transaction('rw', db.sales, db.dues, db.accounts, db.balanceLogs, async () => {
        const id = await db.sales.add(newSale);

        // Record Due if applicable
        if (calculatedDueAmount > 0 && customerName.trim()) {
          await db.dues.add({
            customerName: customerName.trim(),
            phone: customerPhone.trim(),
            totalAmount: parsedAmount,
            paidAmount: calculatedPaidAmount,
            status: calculatedPaidAmount >= parsedAmount ? 'Paid' : 'Partial',
            createdAt,
            updatedAt
          });
        }

        // Adjust Account Balance
        if (calculatedPaidAmount > 0 && paymentMethod !== 'Due') {
          const accountId = mapPaymentMethodToAccountId(paymentMethod);
          await adjustAccountBalance(accountId, calculatedPaidAmount);
        } else if (calculatedPaidAmount > 0 && paymentMethod === 'Due') {
          // If partial cash payment on due sale
          await adjustAccountBalance('cash', calculatedPaidAmount);
        }

        return id;
      });

      const savedSaleWithId = { ...newSale, id: saleId as number };
      setReceiptSale(savedSaleWithId);
      setSuccessMsg(`Sale of Tk ${parsedAmount.toLocaleString()} saved successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);

      resetForm();
    } catch (err) {
      console.error('Failed to save sale', err);
    }
  };

  // Delete sale handler
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteTarget.id) return;
    try {
      const { id, paymentMethod: pMethod, amount: saleAmount } = deleteTarget;
      await db.transaction('rw', db.sales, db.accounts, db.balanceLogs, db.activityLogs, async () => {
        await db.sales.delete(id);
        if (pMethod !== 'Due') {
          const accountId = mapPaymentMethodToAccountId(pMethod);
          await adjustAccountBalance(accountId, -saleAmount);
        }
      });
      await logSaleDelete(deleteTarget);
      if (detailsSale && detailsSale.id === id) {
        setDetailsSale(null);
      }
      setSuccessMsg('Sale deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error('Failed to delete sale:', error);
    }
    setDeleteTarget(null);
  };

  // Filtered & Sorted Sales List (capped at last 10)
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchesSearch = 
        s.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.note && s.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.id?.toString().includes(searchQuery));

      const matchesPayment = paymentFilter === 'all' || s.paymentMethod === paymentFilter;

      return matchesSearch && matchesPayment;
    });
  }, [sales, searchQuery, paymentFilter]);

  const last10Sales = useMemo(() => {
    const sorted = [...filteredSales].sort((a, b) => {
      if (sortBy === 'amount-high') return (b.amount || 0) - (a.amount || 0);
      if (sortBy === 'profit-high') return (b.profit || 0) - (a.profit || 0);
      return (b.id || 0) - (a.id || 0);
    });
    return sorted.slice(0, 10);
  }, [filteredSales, sortBy]);

  const handleShareWhatsApp = (sale: Sale) => {
    const text = `*Al-Barakah Digital Studio*%0ASale #${sale.id}%0ADate: ${sale.date} ${sale.time || ''}%0AService: ${sale.serviceName}%0AQty: ${sale.quantity || 1}%0AAmount: Tk ${sale.amount.toLocaleString()}%0APayment: ${sale.paymentMethod}%0A${sale.customerName ? `Customer: ${sale.customerName}%0A` : ''}Thank you for your business!`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-[#084b3e] rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md">
          <ShoppingCart size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Sales</h1>
          <p className="text-sm text-gray-500 font-medium">Record sales & manage transactions</p>
        </div>
      </div>

      {/* 3 Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShoppingCart size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today's Sales</p>
            <p className="text-2xl font-black text-gray-900">Tk {todaySalesTotal.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#084b3e] flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today's Profit</p>
            <p className="text-2xl font-black text-[#084b3e]">Tk {todayProfitTotal.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today's Due Sales</p>
            <p className="text-2xl font-black text-orange-600">Tk {todayDueTotal.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between gap-2 shadow-sm border border-emerald-100 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
          {receiptSale && (
            <button
              onClick={() => handleShareWhatsApp(receiptSale)}
              className="text-xs bg-[#084b3e] text-white px-3 py-1.5 rounded-lg hover:bg-[#0c5e4e] transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Share2 size={12} /> WhatsApp Receipt
            </button>
          )}
        </div>
      )}

      {/* SALE ENTRY FORM CARD (ON TOP) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#084b3e] flex items-center justify-center font-bold">
              <ShoppingCart size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">New Sale Entry</h2>
            </div>
          </div>
          {(amount || customerName || selectedServiceId || note || quantity) && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-gray-400 hover:text-gray-700 font-bold underline px-2 py-1"
            >
              Reset Form
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Customer Details Row */}
          <div className="relative" ref={customerSuggestionRef}>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Customer Information {paymentMethod === 'Due' && <span className="text-red-500">*</span>}
              </label>
              {customerName.trim() && (
                <span className="text-xs font-bold text-emerald-600">
                  {customers.some(c => c.name.toLowerCase().trim() === customerName.toLowerCase().trim()) ? 'Existing Customer' : 'New Customer'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <input
                type="text"
                required={paymentMethod === 'Due'}
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); setShowCustomerSuggestions(true); }}
                onFocus={() => { if (customerName.trim()) setShowCustomerSuggestions(true); }}
                placeholder="Customer Name (optional for cash)"
                autoComplete="off"
                className="w-full px-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none text-base font-medium transition-all"
              />
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone Number (optional)"
                className="w-full px-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none text-base font-medium transition-all"
              />
            </div>

            {/* Customer Suggestions Dropdown */}
            {showCustomerSuggestions && customerName.trim() && customers.filter(c =>
              c.name.toLowerCase().includes(customerName.toLowerCase().trim()) ||
              (c.phone && c.phone.includes(customerName.trim()))
            ).length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                {customers.filter(c =>
                  c.name.toLowerCase().includes(customerName.toLowerCase().trim()) ||
                  (c.phone && c.phone.includes(customerName.trim()))
                ).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCustomerName(c.name);
                      if (c.phone) setCustomerPhone(c.phone);
                      setShowCustomerSuggestions(false);
                    }}
                    className="w-full p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="font-bold text-sm text-gray-900">{c.name}</div>
                    {c.phone && <div className="text-xs text-gray-500">{c.phone}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Row 1: Service Name & Quantity Side by Side */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Service Name <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedServiceId}
                  onChange={handleServiceChange}
                  className="w-full px-4 py-3 sm:py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none text-base font-semibold shadow-sm transition-all text-gray-900"
                >
                  <option value="" disabled>Select service...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id?.toString()}>{s.name}</option>
                  ))}
                  <option value="other" className="font-bold">+ Other / Custom Service</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => updateQuantity(e.target.value)}
                  placeholder="1"
                  className="w-full px-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl text-center font-black text-base text-gray-900 focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none transition-all"
                />
              </div>
            </div>

            {/* Custom Service Name if 'other' is selected */}
            {selectedServiceId === 'other' && (
              <div className="mt-3">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Custom Service Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  placeholder="Enter custom service name..."
                  className="w-full px-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none text-base font-medium"
                />
              </div>
            )}
          </div>

          {/* Row 2: Selling Price & Cost Side by Side */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Selling Price (Tk) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">Tk</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-11 pr-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl font-black text-lg text-gray-900 focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Cost (Tk)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">Tk</span>
                  <input
                    type="number"
                    step="any"
                    value={cost}
                    onChange={(e) => handleCostChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-11 pr-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl font-bold text-lg text-gray-700 focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Profit Preview */}
            {(amount || cost) ? (
              <div className="mt-2.5 text-xs font-bold bg-emerald-50 text-[#084b3e] px-4 py-2 rounded-xl border border-emerald-100 flex justify-between items-center">
                <span>Estimated Profit:</span>
                <span className="font-black text-base">Tk {currentProfit.toFixed(2)}</span>
              </div>
            ) : null}
          </div>

          {/* Row 3: Note */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any remarks, token number, or details..."
              className="w-full px-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none text-base font-medium transition-all"
            />
          </div>

          {/* Row 4: Payment Method */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              Payment Method
            </label>
            <div className="grid grid-cols-5 gap-2.5">
              {['Cash', 'bKash', 'Nagad', 'Rocket', 'Due'].map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3 px-2 text-sm font-bold rounded-xl border transition-all text-center ${
                    paymentMethod === method
                      ? (method === 'Due' ? 'bg-red-600 border-red-600 text-white shadow-sm' : 'bg-[#084b3e] border-[#084b3e] text-white shadow-sm')
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Due Amount input if Due is selected */}
            {paymentMethod === 'Due' && (
              <div className="mt-3 bg-red-50/60 p-4 rounded-xl border border-red-100 space-y-1.5 animate-in fade-in">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-red-800 uppercase tracking-wider">Due Amount</label>
                  <span className="text-xs font-bold text-red-500">Total: Tk {amount || '0'}</span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={dueAmount}
                  onChange={(e) => setDueAmount(e.target.value)}
                  placeholder={amount ? `${amount}` : '0.00'}
                  max={amount || undefined}
                  className="w-full px-4 py-3 border border-red-200 rounded-xl text-base font-black text-red-700 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none bg-white"
                />
              </div>
            )}
          </div>

          {/* Row 5: Save Button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={paymentMethod === 'Due' && dueAmount !== '' && parseFloat(dueAmount) > (parseFloat(amount) || 0)}
              className="w-full py-4 px-6 bg-[#084b3e] hover:bg-[#0c5e4e] active:scale-[0.99] text-white font-black rounded-xl text-lg tracking-wide transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={24} />
              Save Sale
            </button>
          </div>
        </form>
      </div>

      {/* RECORD TABLE (LAST 10 TRANSACTIONS ONLY) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-gray-900">Recent Sales Records</h2>
              <span className="text-xs font-bold bg-emerald-50 text-[#084b3e] px-2.5 py-0.5 rounded-full border border-emerald-100">
                Last 10 Transactions
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-all text-xs font-medium"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#084b3e] bg-gray-50"
            >
              <option value="all">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="bKash">bKash</option>
              <option value="Nagad">Nagad</option>
              <option value="Rocket">Rocket</option>
              <option value="Due">Due</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#084b3e] bg-gray-50"
            >
              <option value="newest">Newest First</option>
              <option value="amount-high">Amount (High to Low)</option>
              <option value="profit-high">Profit (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          {last10Sales.length > 0 ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 text-gray-500 font-bold text-xs uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Service & Quantity</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-right">Profit</th>
                  <th className="py-3.5 px-4 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {last10Sales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    onClick={() => setDetailsSale(sale)}
                    className="hover:bg-emerald-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 text-gray-600 font-medium">
                      <div className="font-bold text-gray-900 group-hover:text-[#084b3e] transition-colors">{formatDateStr(sale.date)}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock size={12} /> {sale.time || '—'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                        <span>{sale.serviceName}</span>
                        {sale.quantity && sale.quantity > 1 && (
                          <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            x{sale.quantity}
                          </span>
                        )}
                      </div>
                      {sale.note && (
                        <div className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{sale.note}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {sale.customerName ? (
                        <div className="flex items-center gap-1.5 font-bold text-gray-800 text-xs">
                          <User size={13} className="text-gray-400" />
                          <span>{sale.customerName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Walk-in</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        sale.paymentMethod === 'Cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        sale.paymentMethod === 'bKash' ? 'bg-pink-50 text-pink-700 border border-pink-100' :
                        sale.paymentMethod === 'Nagad' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                        sale.paymentMethod === 'Rocket' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                        'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="font-black text-gray-900 text-base">
                        Tk {sale.amount.toLocaleString()}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="font-bold text-[#084b3e] text-sm">
                        +Tk {(sale.profit || 0).toLocaleString()}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setDetailsSale(sale)}
                          title="View Details"
                          className="p-1.5 text-gray-500 hover:text-[#084b3e] hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                        >
                          <FileText size={16} />
                          <span className="hidden sm:inline">Details</span>
                          <ChevronRight size={14} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="font-bold text-gray-700">No sales transactions found</p>
              <p className="text-xs text-gray-400 mt-1">Fill out the form above to record your sale.</p>
            </div>
          )}
        </div>
      </div>

      {/* TRANSACTION DETAILS MODAL */}
      {detailsSale && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 my-8">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#084b3e] to-[#0c5e4e] text-white p-6 relative">
              <button
                onClick={() => setDetailsSale(null)}
                className="absolute top-5 right-5 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-2 text-emerald-200 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Transaction Details</span>
                <span>•</span>
                <span>#{detailsSale.id}</span>
              </div>
              <h3 className="text-2xl font-black">{detailsSale.serviceName}</h3>
              <div className="flex items-center gap-3 mt-2 text-xs font-medium text-white/90">
                <span className="flex items-center gap-1"><Calendar size={13} /> {formatDateStr(detailsSale.date)}</span>
                {detailsSale.time && <span className="flex items-center gap-1"><Clock size={13} /> {detailsSale.time}</span>}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Financial Highlight Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-center">
                  <span className="text-[11px] font-bold text-gray-400 block uppercase">Total Selling</span>
                  <span className="text-lg font-black text-gray-900 mt-0.5 block">
                    Tk {detailsSale.amount.toLocaleString()}
                  </span>
                </div>
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-center">
                  <span className="text-[11px] font-bold text-gray-400 block uppercase">Total Cost</span>
                  <span className="text-lg font-bold text-gray-700 mt-0.5 block">
                    Tk {(detailsSale.cost || 0).toLocaleString()}
                  </span>
                </div>
                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 block uppercase">Net Profit</span>
                  <span className="text-lg font-black text-[#084b3e] mt-0.5 block">
                    +Tk {(detailsSale.profit || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Detailed Breakdown List */}
              <div className="bg-gray-50/70 rounded-2xl p-4 border border-gray-100 space-y-3 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium flex items-center gap-1.5">
                    <Layers size={15} className="text-gray-400" /> Quantity
                  </span>
                  <span className="font-bold text-gray-900">{detailsSale.quantity || 1} unit(s)</span>
                </div>

                {detailsSale.unitPrice && (
                  <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                    <span className="text-gray-500 font-medium">Unit Price</span>
                    <span className="font-bold text-gray-900">Tk {detailsSale.unitPrice.toLocaleString()} / unit</span>
                  </div>
                )}

                {detailsSale.unitCost && (
                  <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                    <span className="text-gray-500 font-medium">Unit Cost</span>
                    <span className="font-bold text-gray-700">Tk {detailsSale.unitCost.toLocaleString()} / unit</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium flex items-center gap-1.5">
                    <DollarSign size={15} className="text-gray-400" /> Payment Method
                  </span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    detailsSale.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-800' :
                    detailsSale.paymentMethod === 'bKash' ? 'bg-pink-100 text-pink-800' :
                    detailsSale.paymentMethod === 'Nagad' ? 'bg-orange-100 text-orange-800' :
                    detailsSale.paymentMethod === 'Rocket' ? 'bg-purple-100 text-purple-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {detailsSale.paymentMethod}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium flex items-center gap-1.5">
                    <User size={15} className="text-gray-400" /> Customer Name
                  </span>
                  <span className="font-bold text-gray-900">{detailsSale.customerName || 'Walk-in Customer'}</span>
                </div>

                {detailsSale.category && (
                  <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                    <span className="text-gray-500 font-medium flex items-center gap-1.5">
                      <Tag size={15} className="text-gray-400" /> Category
                    </span>
                    <span className="font-medium text-gray-700">{detailsSale.category}</span>
                  </div>
                )}

                {detailsSale.note && (
                  <div className="py-1">
                    <span className="text-gray-500 font-medium block mb-1">Note:</span>
                    <p className="bg-white p-2.5 rounded-xl border border-gray-200 text-gray-800 font-medium text-xs">
                      {detailsSale.note}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons inside Details */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => handleShareWhatsApp(detailsSale)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Share2 size={15} /> WhatsApp
                </button>
                <button
                  onClick={() => {
                    setReceiptSale(detailsSale);
                  }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <FileText size={15} /> Receipt
                </button>
                <button
                  onClick={() => {
                    setDeleteTarget(detailsSale);
                  }}
                  className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-xl animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertCircle size={28} />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-2">Delete Sale?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Delete sale of <span className="font-black text-gray-900">Tk {deleteTarget.amount.toLocaleString()}</span> for {deleteTarget.serviceName}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors text-sm shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {receiptSale && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="font-black text-lg text-gray-900">Sale Receipt</h3>
                <p className="text-xs text-gray-400">#{receiptSale.id}</p>
              </div>
              <button
                onClick={() => setReceiptSale(null)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs border border-gray-100 mb-5 font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span className="font-bold">{receiptSale.date} {receiptSale.time || ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Service:</span>
                <span className="font-bold">{receiptSale.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quantity:</span>
                <span className="font-bold">{receiptSale.quantity || 1}</span>
              </div>
              {receiptSale.customerName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-bold">{receiptSale.customerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Payment:</span>
                <span className="font-bold">{receiptSale.paymentMethod}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                <span className="font-bold text-gray-700">Total:</span>
                <span className="font-black text-[#084b3e]">Tk {receiptSale.amount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleShareWhatsApp(receiptSale)}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Share2 size={14} /> WhatsApp
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <Printer size={14} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
