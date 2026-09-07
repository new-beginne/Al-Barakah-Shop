import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, Sale, getRecordMetadata } from '../db/db';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Users, UserPlus, Check, FileText, Package, DollarSign, Coins, PenLine, CreditCard, Save, ArrowRight, User, Phone } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

export function SalesEntry() {
  const [searchParams] = useSearchParams();
  const categories = useLiveQuery(() => db.salesCategories.toArray()) || [];
  const services = useLiveQuery(() => db.services.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [category, setCategory] = useState('');
  
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [amount, setAmount] = useState('');
  const [cost, setCost] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  
  const [note, setNote] = useState('');

  // Due states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dueAmount, setDueAmount] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const customerSuggestionRef = useRef<HTMLDivElement>(null);

  const [success, setSuccess] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);

  // Close suggestions if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerSuggestionRef.current && !customerSuggestionRef.current.contains(event.target as Node)) {
        setShowCustomerSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If redirected with customer query params
  useEffect(() => {
    const cust = searchParams.get('customer');
    const ph = searchParams.get('phone');
    if (cust) {
      setCustomerName(cust);
      if (ph) setCustomerPhone(ph);
    }
  }, [searchParams]);

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
      const foundService = services.find(s => s.id?.toString() === val);
      if (foundService) {
        const uPrice = foundService.defaultPrice ? foundService.defaultPrice.toString() : '';
        const uCost = foundService.defaultCost ? foundService.defaultCost.toString() : '';
        setUnitPrice(uPrice);
        setUnitCost(uCost);
        setCategory(foundService.category || 'General');

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
    }
  };

  const handleUnitPriceChange = (val: string) => {
    setUnitPrice(val);
    const q = Math.max(1, parseInt(quantity) || 1);
    if (val !== '' && !isNaN(parseFloat(val))) {
      setAmount((parseFloat(val) * q).toString());
    } else {
      setAmount('');
    }
  };

  const handleUnitCostChange = (val: string) => {
    setUnitCost(val);
    const q = Math.max(1, parseInt(quantity) || 1);
    if (val !== '' && !isNaN(parseFloat(val))) {
      setCost((parseFloat(val) * q).toString());
    } else {
      setCost('');
    }
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const q = Math.max(1, parseInt(quantity) || 1);
    if (val !== '' && !isNaN(parseFloat(val))) {
      const perUnit = (parseFloat(val) / q);
      setUnitPrice(Number.isInteger(perUnit) ? perUnit.toString() : perUnit.toFixed(2));
    } else {
      setUnitPrice('');
    }
  };

  const handleCostChange = (val: string) => {
    setCost(val);
    const q = Math.max(1, parseInt(quantity) || 1);
    if (val !== '' && !isNaN(parseFloat(val))) {
      const perUnit = (parseFloat(val) / q);
      setUnitCost(Number.isInteger(perUnit) ? perUnit.toString() : perUnit.toFixed(2));
    } else {
      setUnitCost('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedServiceId) {
      alert("Please select a service!");
      return;
    }

    if (paymentMethod === 'Due' && !customerName) {
      alert("Customer Name is required for Due transactions.");
      return;
    }

    let finalServiceName = '';
    let finalCategory = category;

    if (selectedServiceId === 'other') {
      if (!customServiceName) {
        alert("Please enter custom service name!");
        return;
      }
      finalServiceName = customServiceName;
    } else {
      const foundService = services.find(s => s.id?.toString() === selectedServiceId);
      if (foundService) {
        finalServiceName = foundService.name;
        finalCategory = foundService.category;
      } else {
        return;
      }
    }

    const q = Math.max(1, parseInt(quantity) || 1);
    const amt = parseFloat(amount) || 0;
    const cst = parseFloat(cost) || 0;
    const profit = amt - cst;

    const uPrice = parseFloat(unitPrice) || (q > 0 ? amt / q : amt);
    const uCost = parseFloat(unitCost) || (q > 0 ? cst / q : cst);

    let dAmt = 0;
    let paidAmt = amt;

    if (paymentMethod === 'Due') {
      dAmt = dueAmount === '' ? amt : parseFloat(dueAmount);
      
      if (isNaN(dAmt) || dAmt <= 0) {
        alert("Please enter a valid due amount.");
        return;
      }

      if (dAmt > amt) {
        alert(`Due amount (Tk ${dAmt}) cannot exceed total amount (Tk ${amt}).`);
        return;
      }

      if (!customerName.trim()) {
        alert("Customer name is required for due sales.");
        return;
      }

      paidAmt = amt - dAmt;
    }
    
    const meta = getRecordMetadata();

    const newSale: Sale = {
      date: meta.date,
      time: meta.time,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      category: finalCategory,
      serviceName: finalServiceName,
      quantity: quantity || '1',
      unitPrice: uPrice,
      unitCost: uCost,
      amount: amt,
      cost: cst,
      profit,
      paymentMethod,
      note,
      ...(paymentMethod === 'Due' ? {
        dueAmount: dAmt,
        paidAmount: paidAmt,
        customerName: customerName.trim()
      } : {
        paidAmount: amt,
        ...(customerName.trim() ? { customerName: customerName.trim() } : {})
      })
    };

    const id = await db.sales.add(newSale);
    setLastSaleId(id as number);
    
    if (paymentMethod === 'Due') {
      const trimmedName = customerName.trim();
      const trimmedPhone = customerPhone.trim();

      await db.dues.add({
        date: meta.date,
        time: meta.time,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        customerName: trimmedName,
        phone: trimmedPhone,
        totalAmount: amt,
        paidAmount: paidAmt,
        status: dAmt === amt ? 'Unpaid' : 'Partial'
      });

      // Automatically add customer to db.customers if they do not exist
      if (trimmedName) {
        const existingCustomer = customers.find(c => {
          if (trimmedPhone && c.phone && c.phone.trim() === trimmedPhone) {
            return true;
          }
          return c.name.trim().toLowerCase() === trimmedName.toLowerCase();
        });

        if (!existingCustomer) {
          await db.customers.add({
            name: trimmedName,
            phone: trimmedPhone,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt,
            notes: 'Auto-saved from sales'
          });
        } else if (trimmedPhone && !existingCustomer.phone) {
          await db.customers.update(existingCustomer.id!, {
            phone: trimmedPhone,
            updatedAt: meta.updatedAt
          });
        }
      }
    }

    setSuccess(true);
    setSelectedServiceId('');
    setCustomServiceName('');
    setQuantity('1');
    setUnitPrice('');
    setUnitCost('');
    setAmount('');
    setCost('');
    setCustomerName('');
    setCustomerPhone('');
    setDueAmount('');
    setShowCustomerSuggestions(false);
    setNote('');
    
    setTimeout(() => {
      setSuccess(false);
      setLastSaleId(null);
    }, 5000);
  };

  const handleShareWhatsApp = () => {
    let sName = '';
    if (selectedServiceId === 'other') sName = customServiceName;
    else {
      const f = services.find(s => s.id?.toString() === selectedServiceId);
      if (f) sName = f.name;
    }
    const qNum = parseInt(quantity) || 1;
    const text = `Al-Barakah Digital Studio\nService: ${category} - ${sName || 'N/A'}${qNum > 1 ? ` (Qty: ${qNum})` : ''}\nPrice: Tk${amount}\nPayment: ${paymentMethod}\nThank you!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const currentProfit = (parseFloat(amount) || 0) - (parseFloat(cost) || 0);

  return (
    <div className="p-4 md:p-6 mx-auto mb-4 md:mb-0 w-full max-w-4xl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#084b3e] rounded-full flex items-center justify-center text-white shrink-0 shadow-md">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">New Sales Entry</h1>
              <p className="text-sm text-gray-500 font-medium">Record your new sale quickly and easily</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-xs font-bold text-emerald-800 tracking-wide">Fast • Simple • Reliable</span>
          </div>
        </div>

        {success && (
          <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={24} className="text-emerald-600" />
              <div>
                <div className="font-bold text-emerald-800">Entry Saved Successfully!</div>
                {lastSaleId && <div className="text-xs font-medium text-emerald-700/80 mt-0.5">Sale ID: #{lastSaleId}</div>}
              </div>
            </div>
            {lastSaleId && (
              <button 
                onClick={handleShareWhatsApp}
                type="button"
                className="bg-[#084b3e] hover:bg-[#126b55] text-white px-3 py-1.5 rounded-xl text-sm font-bold transition-colors uppercase tracking-wider"
              >
                Send WhatsApp Receipt
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Customer Details for Due or Linked Customer */}
          {(paymentMethod === 'Due' || Boolean(customerName)) && (
            <div className="space-y-3 pb-4 border-b border-gray-100">
              {paymentMethod !== 'Due' && customerName && (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Linked Customer:</span>
                    <span className="font-black text-gray-900">{customerName} {customerPhone ? `(${customerPhone})` : ''}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerName('');
                      setCustomerPhone('');
                    }}
                    className="text-gray-400 hover:text-gray-900 text-xs font-bold"
                  >
                    Remove
                  </button>
                </div>
              )}
              {paymentMethod === 'Due' && customers.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1.5">
                    <Users size={14} className="text-gray-900" />
                    <span>Quick Select Customer</span>
                  </label>
                  <select 
                    value=""
                    onChange={(e) => {
                      const sel = customers.find(c => c.id?.toString() === e.target.value);
                      if (sel) {
                        setCustomerName(sel.name);
                        setCustomerPhone(sel.phone || '');
                      }
                    }}
                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:border-[#084b3e] outline-none font-medium shadow-sm"
                  >
                    <option value="">-- Select registered customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id?.toString()}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} {c.address ? `- ${c.address}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative" ref={customerSuggestionRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-500 flex items-center gap-1.5">
                      <User size={14} /> Customer Name *
                    </label>
                    {customerName.trim() && (
                      customers.some(c => c.name.toLowerCase().trim() === customerName.toLowerCase().trim()) ? (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <Check size={11} /> Registered
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#084b3e] flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <UserPlus size={11} /> Auto-save
                        </span>
                      )
                    )}
                  </div>
                  <input 
                    type="text" 
                    required
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setShowCustomerSuggestions(true);
                    }}
                    onFocus={() => {
                      if (customerName.trim()) setShowCustomerSuggestions(true);
                    }}
                    placeholder="Search or enter name..."
                    autoComplete="off"
                    className="w-full p-3 border border-gray-100 rounded-xl focus:border-[#084b3e] outline-none font-medium bg-white shadow-sm"
                  />

                  {/* Autocomplete Keyword Suggestions dropdown */}
                  {showCustomerSuggestions && customerName.trim() && customers.filter(c =>
                    c.name.toLowerCase().includes(customerName.toLowerCase().trim()) ||
                    (c.phone && c.phone.includes(customerName.trim()))
                  ).length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-gray-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-3 bg-emerald-50/50 text-[10px] font-bold text-[#084b3e] uppercase tracking-wider flex items-center justify-between sticky top-0 backdrop-blur-md">
                        <span>Customer Suggestions</span>
                        <span className="text-[9px] text-[#084b3e]/60 font-medium">Click to select</span>
                      </div>
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
                          className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5 group-hover:text-[#084b3e] transition-colors">
                              <span>{c.name}</span>
                              {c.address && <span className="text-[11px] font-normal text-gray-400 group-hover:text-[#084b3e]/60">({c.address})</span>}
                            </div>
                            {c.phone && (
                              <div className="text-xs text-gray-500 font-mono mt-0.5 flex items-center gap-1">
                                <Phone size={10} className="text-gray-400 group-hover:text-[#084b3e]/60" /> {c.phone}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] bg-[#084b3e] text-white font-bold px-2 py-1 rounded-md opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all whitespace-nowrap shadow-sm">
                            Select
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1.5">
                    <Phone size={14} /> Mobile Number
                  </label>
                  <input 
                    type="text" 
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="017..."
                    className="w-full p-3 border border-gray-100 rounded-xl focus:border-[#084b3e] outline-none font-medium bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Row 1: Service Name Dropdown */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1.5">
              <User size={14} /> Service Name
            </label>
            <select 
              required
              value={selectedServiceId}
              onChange={handleServiceChange}
              className="w-full p-3 border border-gray-100 rounded-xl focus:border-[#084b3e] outline-none font-medium bg-white shadow-sm"
            >
              <option value="" disabled>Select a service...</option>
              {services.map(s => (
                <option key={s.id} value={s.id?.toString()}>
                  {s.name}
                </option>
              ))}
              <option value="other" className="font-bold">Other Service</option>
            </select>
          </div>

          {/* Show input if 'Other' is selected */}
          {selectedServiceId === 'other' && (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1.5">
                <FileText size={14} /> Custom Service Name
              </label>
              <input 
                type="text" 
                required
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                placeholder="Enter Service Name..."
                className="w-full p-3 border border-gray-100 rounded-xl focus:border-[#084b3e] outline-none font-medium shadow-sm"
              />
            </div>
          )}

          {/* Row 2: Quantity & Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quantity Input */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1.5">
                <Package size={14} /> Quantity (QTY)
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => updateQuantity(e.target.value)}
                placeholder="Total units, copies, or qty"
                className="w-full p-3 border border-gray-100 rounded-xl focus:border-[#084b3e] focus:ring-1 focus:ring-[#084b3e] outline-none font-medium transition-colors shadow-sm text-sm"
              />
            </div>

            {/* Selling Price */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-500 flex items-center gap-1.5">
                  <DollarSign size={14} /> Selling Price (TK)
                </label>
                {parseInt(quantity) > 1 && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    Rate: Tk {unitPrice || (parseFloat(amount) ? (parseFloat(amount) / (parseInt(quantity) || 1)).toFixed(1) : '0')}/unit
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500 font-bold border-r border-gray-100 pr-2 my-2">
                  ৳
                </div>
                <input 
                  type="number" 
                  required
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 p-3 border border-gray-100 rounded-xl focus:border-[#084b3e] outline-none font-medium text-sm bg-white shadow-sm"
                />
              </div>
            </div>

            {/* Cost */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-500 flex items-center gap-1.5">
                  <Coins size={14} /> Cost (Tk)
                </label>
                {parseInt(quantity) > 1 && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    Rate: Tk {unitCost || (parseFloat(cost) ? (parseFloat(cost) / (parseInt(quantity) || 1)).toFixed(1) : '0')}/unit
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500 font-bold border-r border-gray-100 pr-2 my-2">
                  ৳
                </div>
                <input 
                  type="number" 
                  value={cost}
                  onChange={(e) => handleCostChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 p-3 border border-gray-100 rounded-xl focus:border-[#084b3e] outline-none font-medium text-sm bg-white shadow-sm"
                />
              </div>
            </div>
          </div>

          {(amount || cost) ? (
            <div className="text-xs font-bold text-gray-600 tracking-wider bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <span>Expected Profit:</span>
                {parseInt(quantity) > 1 && (
                  <span className="text-[10px] text-gray-500 font-normal">
                    (Tk {((currentProfit) / Math.max(1, parseInt(quantity) || 1)).toFixed(2)}/unit)
                  </span>
                )}
              </span>
              <span className="text-[#084b3e] font-black text-sm">
                Tk {currentProfit.toFixed(2)}
              </span>
            </div>
          ) : null}

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-1">
              <FileText size={14} /> Note (Optional)
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Enter any note or information..."
                className="w-full p-3 border border-gray-100 rounded-xl focus:border-[#084b3e] outline-none font-medium text-sm shadow-sm"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                <PenLine size={16} />
              </div>
            </div>
          </div>

          {/* Due Amount field */}
          {paymentMethod === 'Due' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Due Amount (Tk)
                </label>
                <span className="text-[11px] font-bold text-gray-400">
                  Max: Tk {amount || '0'}
                </span>
              </div>
              <input 
                type="number" 
                value={dueAmount}
                onChange={(e) => setDueAmount(e.target.value)}
                placeholder={amount ? `${amount}` : '0.00'}
                max={amount || undefined}
                className={`w-full p-3 border rounded-md outline-none font-bold text-lg transition-colors ${
                  dueAmount !== '' && parseFloat(dueAmount) > (parseFloat(amount) || 0)
                    ? 'border-red-500 bg-red-50/40 text-red-600 focus:border-red-600'
                    : 'border-gray-300 focus:border-[#084b3e]'
                }`}
              />

              {dueAmount !== '' && parseFloat(dueAmount) > (parseFloat(amount) || 0) ? (
                <p className="text-xs font-bold text-red-600 mt-1.5 flex items-center gap-1">
                  Due amount (Tk {dueAmount}) cannot exceed total amount (Tk {amount || 0})!
                </p>
              ) : (
                parseFloat(amount) > 0 && (
                  <div className="mt-2 text-xs font-bold bg-gray-50 p-2.5 rounded-md border border-gray-100 flex justify-between">
                    <span className="text-gray-600">
                      Paid: <span className="text-green-700 font-black">Tk {(parseFloat(amount) - (dueAmount === '' ? parseFloat(amount) : (parseFloat(dueAmount) || 0))).toFixed(2)}</span>
                    </span>
                    <span className="text-gray-600">
                      Due: <span className="text-red-600 font-black">Tk {(dueAmount === '' ? parseFloat(amount) : (parseFloat(dueAmount) || 0)).toFixed(2)}</span>
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          {/* Row 3: Payment Methods */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-3 flex items-center gap-1.5">
              <CreditCard size={14} /> Payment Method
            </label>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {['Cash', 'bKash', 'Nagad', 'Rocket', 'Due'].map(method => {
                const isSelected = paymentMethod === method;
                
                // Determine icon colors based on method to match image closely
                let iconColor = 'text-gray-400';
                if (method === 'bKash') iconColor = 'text-pink-600';
                if (method === 'Nagad') iconColor = 'text-orange-500';
                if (method === 'Rocket') iconColor = 'text-purple-600';
                if (method === 'Due') iconColor = 'text-red-500';

                return (
                  <label 
                    key={method} 
                    className={`flex items-center space-x-2 cursor-pointer px-4 py-3 border rounded-xl transition-all font-medium text-sm shadow-sm ${
                      isSelected 
                        ? (method === 'Due' ? 'border-red-600 bg-red-600 text-white shadow-md' : 'border-[#084b3e] bg-[#084b3e] text-white shadow-md')
                        : 'border-gray-100 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {isSelected 
                      ? (method === 'Cash' ? <CreditCard size={18} /> : <CheckCircle2 size={18} />)
                      : (
                        method === 'Cash' ? <CreditCard size={18} className={iconColor} /> :
                        method === 'Due' ? <Circle size={18} className={iconColor} /> :
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center font-black text-[10px] bg-gray-100 ${iconColor}`}>
                           {method[0]}
                        </div>
                      )
                    }
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value={method}
                      checked={isSelected}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="hidden"
                    />
                    <span className="font-bold">{method}</span>
                    {isSelected && method === 'Cash' && <Check size={16} className="ml-1 opacity-70" />}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit"
              disabled={paymentMethod === 'Due' && dueAmount !== '' && parseFloat(dueAmount) > (parseFloat(amount) || 0)}
              className={`w-full flex items-center justify-center font-bold py-4 px-6 rounded-xl transition-all shadow-md text-lg group ${
                paymentMethod === 'Due' && dueAmount !== '' && parseFloat(dueAmount) > (parseFloat(amount) || 0)
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                  : 'bg-[#084b3e] hover:bg-[#126b55] text-white'
              }`}
            >
              <div className="flex items-center justify-center gap-2 relative">
                <Save size={20} className="opacity-80 absolute -left-8 group-hover:scale-110 transition-transform" />
                <span>Save Entry</span>
                <ArrowRight size={20} className="absolute -right-8 opacity-0 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
              </div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
