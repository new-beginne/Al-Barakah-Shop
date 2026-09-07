import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Customer, Sale, Due } from '../db/db';
import { 
  ArrowLeft, 
  Phone, 
  MapPin, 
  FileText, 
  Calendar, 
  Edit2, 
  DollarSign, 
  PhoneCall, 
  MessageSquare, 
  Printer, 
  Download, 
  CheckCircle2, 
  ArrowUpRight, 
  UserCheck, 
  AlertCircle, 
  Clock, 
  Search, 
  Filter, 
  Save, 
  X, 
  Layers, 
  TrendingUp, 
  ShoppingBag,
  Check,
  Loader2,
  Share2
} from 'lucide-react';
import { format } from 'date-fns';
import { generateCustomerStatementPdf, CustomerTransactionItem } from '../utils/customerStatementPdf';

export function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = id ? parseInt(id, 10) : undefined;

  // Live queries
  const customer = useLiveQuery(
    () => (customerId ? db.customers.get(customerId) : undefined),
    [customerId]
  );
  const allSales = useLiveQuery(() => db.sales.toArray()) || [];
  const allDues = useLiveQuery(() => db.dues.toArray()) || [];

  // Local UI states
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'dues'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Collect Due modal states
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState<'Cash' | 'bKash' | 'Nagad' | 'Rocket'>('Cash');
  const [collectNote, setCollectNote] = useState('');
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);

  // Edit Customer modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Match transactions for this customer (by Phone or exact Name)
  const customerSales = useMemo(() => {
    if (!customer) return [];
    const custName = customer.name.trim().toLowerCase();
    const custPhone = customer.phone?.trim();

    return allSales.filter(s => {
      if (!s.customerName) return false;
      const sName = s.customerName.trim().toLowerCase();
      return sName === custName;
    }).sort((a, b) => {
      const dateA = `${a.date} ${a.time || ''}`;
      const dateB = `${b.date} ${b.time || ''}`;
      return dateB.localeCompare(dateA);
    });
  }, [customer, allSales]);

  const customerDues = useMemo(() => {
    if (!customer) return [];
    const custName = customer.name.trim().toLowerCase();
    const custPhone = customer.phone?.trim();

    return allDues.filter(d => {
      const dPhone = d.phone?.trim();
      const dName = d.customerName?.trim().toLowerCase();
      if (custPhone && dPhone && custPhone === dPhone) return true;
      if (dName && dName === custName) return true;
      return false;
    }).sort((a, b) => {
      const dateA = `${a.date || ''} ${a.time || ''}`;
      const dateB = `${b.date || ''} ${b.time || ''}`;
      return dateB.localeCompare(dateA);
    });
  }, [customer, allDues]);

  // Financial Metrics Calculation
  const totalSalesAmount = useMemo(() => {
    return customerSales.reduce((sum, s) => sum + (s.amount || 0), 0);
  }, [customerSales]);

  const totalSalesProfit = useMemo(() => {
    return customerSales.reduce((sum, s) => sum + (s.profit || 0), 0);
  }, [customerSales]);

  const duesMetrics = useMemo(() => {
    let totalDueGiven = 0;
    let totalPaid = 0;
    let pendingDue = 0;

    customerDues.forEach(d => {
      const tot = d.totalAmount || 0;
      const paid = d.paidAmount || 0;
      totalDueGiven += tot;
      totalPaid += paid;
      pendingDue += Math.max(0, tot - paid);
    });

    return { totalDueGiven, totalPaid, pendingDue };
  }, [customerDues]);

  // Unified Chronological Transaction Ledger
  const unifiedTransactions = useMemo<CustomerTransactionItem[]>(() => {
    if (!customer) return [];
    const items: CustomerTransactionItem[] = [];

    // Add Sales
    customerSales.forEach(s => {
      items.push({
        id: `sale-${s.id}`,
        date: s.date,
        time: s.time,
        type: 'sale',
        title: s.serviceName,
        category: s.category,
        paymentMethod: s.paymentMethod,
        amount: s.amount || 0,
        paidAmount: s.paidAmount !== undefined ? s.paidAmount : (s.paymentMethod === 'Due' ? 0 : s.amount),
        dueAmount: s.dueAmount || 0,
        profit: s.profit,
        status: s.paymentMethod === 'Due' && s.dueAmount ? 'Due' : 'Paid',
      });
    });

    // Add Dues
    customerDues.forEach(d => {
      const rem = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
      // Avoid exact duplicate if sale was already added
      const existsInSales = items.some(i => i.date === d.date && Math.abs(i.amount - d.totalAmount) < 0.01);
      if (!existsInSales) {
        items.push({
          id: `due-${d.id}`,
          date: d.date || '—',
          time: d.time,
          type: 'due',
          title: 'Due Account Record',
          amount: d.totalAmount || 0,
          paidAmount: d.paidAmount || 0,
          dueAmount: rem,
          status: d.status,
        });
      }
    });

    // Sort descending by date & time
    items.sort((a, b) => {
      const timeA = `${a.date} ${a.time || ''}`;
      const timeB = `${b.date} ${b.time || ''}`;
      return timeB.localeCompare(timeA);
    });

    return items;
  }, [customer, customerSales, customerDues]);

  // Filtered by active tab and search query
  const displayedTransactions = useMemo(() => {
    let list = unifiedTransactions;

    if (activeTab === 'sales') {
      list = list.filter(t => t.type === 'sale');
    } else if (activeTab === 'dues') {
      list = list.filter(t => t.type === 'due' || t.dueAmount > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) ||
        t.date.includes(q) ||
        (t.paymentMethod && t.paymentMethod.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }

    return list;
  }, [unifiedTransactions, activeTab, searchQuery]);

  // Handle PDF Export
  const handleExportPdf = () => {
    if (!customer) return;
    setIsExportingPdf(true);
    try {
      generateCustomerStatementPdf({
        customer,
        transactions: unifiedTransactions,
        totalPurchases: totalSalesAmount,
        totalPaid: duesMetrics.totalPaid,
        totalDueGiven: duesMetrics.totalDueGiven,
        currentBalanceDue: duesMetrics.pendingDue,
        periodLabel: 'All Records',
      });
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Could not generate PDF statement');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle Direct Print
  const handlePrint = () => {
    window.print();
  };

  // Handle Collect Due Submission
  const handleConfirmCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const amt = parseFloat(collectAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid collection amount');
      return;
    }

    setIsSubmittingCollection(true);
    try {
      // Find unsettled dues for this customer
      const custName = customer.name.trim().toLowerCase();
      const custPhone = customer.phone?.trim();

      const unsettledDues = allDues.filter(d => {
        const dPhone = d.phone?.trim();
        const dName = d.customerName?.trim().toLowerCase();
        const isMatch = (custPhone && dPhone && custPhone === dPhone) || (dName && dName === custName);
        return isMatch && (d.totalAmount || 0) > (d.paidAmount || 0);
      });

      unsettledDues.sort((a, b) => {
        if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.id || 0) - (b.id || 0);
      });

      let remainingToAllocate = amt;
      const nowIso = new Date().toISOString();

      if (unsettledDues.length > 0) {
        for (const d of unsettledDues) {
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
            updatedAt: nowIso,
          });

          remainingToAllocate -= payment;
        }
      }

      setSuccessMsg(`Successfully collected Tk ${amt.toLocaleString()} (${collectMethod}) from ${customer.name}.`);
      setIsCollectModalOpen(false);
      setCollectAmount('');
      setCollectNote('');
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      console.error('Error recording payment:', err);
      alert('Failed to record collection');
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = () => {
    if (!customer) return;
    setEditName(customer.name);
    setEditPhone(customer.phone || '');
    setEditAddress(customer.address || '');
    setEditNotes(customer.notes || '');
    setIsEditModalOpen(true);
  };

  // Save Customer Edits
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.id || !editName.trim()) return;

    try {
      await db.customers.update(customer.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
        updatedAt: new Date().toISOString(),
      });
      setIsEditModalOpen(false);
      setSuccessMsg('Customer profile updated.');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Error updating customer:', err);
      alert('Could not update profile');
    }
  };

  // Clean phone for WhatsApp
  const cleanPhone = customer?.phone ? customer.phone.replace(/[^0-9]/g, '') : '';

  if (!customer && customerId) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-20">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">Customer Not Found</h2>
        <p className="text-sm text-gray-500 mb-6">The requested customer record does not exist or has been deleted.</p>
        <Link
          to="/customers"
          className="inline-flex items-center gap-2 bg-[#084b3e] text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#126b55] transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Customers</span>
        </Link>
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  const hasDue = duesMetrics.pendingDue > 0;

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto mb-16 md:mb-0 space-y-5 print:p-0 print:m-0 print:max-w-none">
      
      {/* Top Breadcrumb & Action Bar (Hidden on Print) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="p-2 bg-white border border-gray-100 hover:bg-gray-50 rounded-xl text-gray-700 transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 text-xs font-bold"
            title="Back to Customers List"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Customers</span>
          </button>
          <span className="text-gray-300 font-normal">/</span>
          <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight truncate max-w-[200px] sm:max-w-md">
            {customer.name}
          </h1>
          <span className="text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md border border-gray-100">
            #CUS-{customer.id}
          </span>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
          {/* Print Statement */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#084b3e] hover:bg-[#126b55] text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
            title="Print Official Statement"
          >
            <Printer size={14} />
            <span>Print Statement</span>
          </button>

          {/* Export PDF */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
            title="Download PDF Ledger"
          >
            {isExportingPdf ? <Loader2 size={14} className="animate-spin" /> : pdfSuccess ? <Check size={14} /> : <Download size={14} />}
            <span>{isExportingPdf ? 'Exporting...' : pdfSuccess ? 'Downloaded' : 'Export PDF'}</span>
          </button>

          {/* New Sale Button */}
          <Link
            to={`/sales?customer=${encodeURIComponent(customer.name)}&phone=${encodeURIComponent(customer.phone || '')}`}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
            title="Create New Sale for this Customer"
          >
            <span>New Sale</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center text-emerald-900 font-bold text-xs sm:text-sm tracking-wider uppercase shadow-xs print:hidden">
          <CheckCircle2 className="mr-2 shrink-0 text-emerald-700" size={18} />
          {successMsg}
        </div>
      )}

      {/* PRINT-ONLY OFFICIAL HEADER */}
      <div className="hidden print:block text-center border-b-2 border-[#084b3e] pb-4 mb-5">
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
          Al-Barakah Digital Studio & Online Service
        </h1>
        <p className="text-xs text-gray-700 font-bold uppercase tracking-wider mt-0.5">
          Official Customer Account Statement & Ledger
        </p>
        <div className="flex justify-between items-end mt-4 pt-2 border-t border-gray-300 text-left text-xs">
          <div>
            <p className="font-black text-sm text-gray-900">{customer.name}</p>
            <p className="text-gray-700">Phone: {customer.phone || 'N/A'}</p>
            {customer.address && <p className="text-gray-700">Address: {customer.address}</p>}
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-900">Customer ID: #CUS-{customer.id}</p>
            <p className="text-gray-600">Date: {format(new Date(), 'dd/MM/yyyy, hh:mm a')}</p>
          </div>
        </div>
      </div>

      {/* CUSTOMER PROFILE CARD (HERO) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-xs relative overflow-hidden print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Avatar and Identity */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl uppercase shrink-0 shadow-xs ${
              hasDue ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-[#084b3e] text-white'
            }`}>
              {customer.name.slice(0, 2)}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight truncate">
                  {customer.name}
                </h2>
                {hasDue ? (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                    Tk {duesMetrics.pendingDue.toLocaleString()} Due
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <UserCheck size={11} /> Clear Account
                  </span>
                )}
              </div>

              {/* Contact and Meta details */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 mt-1.5">
                {customer.phone && (
                  <span className="font-semibold text-gray-800 flex items-center gap-1">
                    <Phone size={12} className="text-gray-400" />
                    <span>{customer.phone}</span>
                  </span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1 truncate text-gray-600">
                    <MapPin size={12} className="text-gray-400 shrink-0" />
                    <span className="truncate">{customer.address}</span>
                  </span>
                )}
                {customer.createdAt && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Calendar size={11} />
                    <span>Since {format(new Date(customer.createdAt), 'dd MMM yyyy')}</span>
                  </span>
                )}
              </div>

              {customer.notes && (
                <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-xl border border-dashed border-gray-100 max-w-xl">
                  <span className="font-bold text-gray-600">Notes:</span> {customer.notes}
                </p>
              )}
            </div>
          </div>

          {/* Quick Communication & Edit Actions (Hidden on Print) */}
          <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100 print:hidden flex-wrap">
            {customer.phone && (
              <>
                <a
                  href={`tel:${customer.phone}`}
                  className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors flex items-center gap-1.5 text-xs font-bold"
                  title="Call Customer"
                >
                  <PhoneCall size={14} />
                  <span>Call</span>
                </a>
                {cleanPhone && (
                  <a
                    href={`https://wa.me/88${cleanPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors flex items-center gap-1.5 text-xs font-bold"
                    title="Send WhatsApp Message"
                  >
                    <MessageSquare size={14} />
                    <span>WhatsApp</span>
                  </a>
                )}
              </>
            )}

            {/* Collect Due Quick Trigger */}
            {hasDue && (
              <button
                type="button"
                onClick={() => {
                  setCollectAmount(duesMetrics.pendingDue.toString());
                  setIsCollectModalOpen(true);
                }}
                className="p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs"
                title="Collect Outstanding Balance"
              >
                <DollarSign size={14} strokeWidth={2.5} />
                <span>Collect Due</span>
              </button>
            )}

            {/* Edit Customer Profile */}
            <button
              type="button"
              onClick={handleOpenEdit}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Edit Profile"
            >
              <Edit2 size={14} />
              <span>Edit</span>
            </button>
          </div>
        </div>
      </div>

      {/* FINANCIAL SUMMARY METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
        {/* Total Purchases */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs print:border-[#084b3e]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Purchases</span>
            <div className="p-1.5 bg-gray-100 rounded-xl text-gray-600 print:hidden">
              <ShoppingBag size={14} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            Tk {totalSalesAmount.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">
            {customerSales.length} {customerSales.length === 1 ? 'sale record' : 'sale records'}
          </p>
        </div>

        {/* Total Dues Incurred */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs print:border-[#084b3e]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Dues Given</span>
            <div className="p-1.5 bg-gray-100 rounded-xl text-gray-600 print:hidden">
              <Layers size={14} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            Tk {duesMetrics.totalDueGiven.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">
            Historical due charges
          </p>
        </div>

        {/* Total Paid / Cleared */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs print:border-[#084b3e]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Total Paid</span>
            <div className="p-1.5 bg-emerald-50 rounded-xl text-emerald-700 print:hidden">
              <Check size={14} strokeWidth={2.5} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
            Tk {duesMetrics.totalPaid.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">
            Collections & payments
          </p>
        </div>

        {/* Outstanding Due Balance */}
        <div className={`p-4 rounded-xl border shadow-xs ${
          hasDue 
            ? 'bg-red-50/60 border-red-200 text-red-900 print:border-[#084b3e] print:bg-white' 
            : 'bg-white border-gray-100 text-gray-900 print:border-[#084b3e]'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${hasDue ? 'text-red-600' : 'text-gray-400'}`}>
              Current Due Balance
            </span>
            <div className={`p-1.5 rounded-xl ${hasDue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'} print:hidden`}>
              <DollarSign size={14} strokeWidth={2.5} />
            </div>
          </div>
          <p className={`text-xl sm:text-2xl font-black mt-1 ${hasDue ? 'text-red-600' : 'text-emerald-600'}`}>
            Tk {duesMetrics.pendingDue.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">
            {hasDue ? 'Requires settlement' : 'Account in good standing'}
          </p>
        </div>
      </div>

      {/* TRANSACTIONS SECTION */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs print:border-[#084b3e] print:rounded-none">
        {/* Tabs & Search Bar (Hidden on Print) */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
          {/* Tab Selector */}
          <div className="flex space-x-1.5 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-[#084b3e] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Records ({unifiedTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'sales'
                  ? 'bg-[#084b3e] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sales ({customerSales.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dues')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'dues'
                  ? 'bg-[#084b3e] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dues Ledger ({customerDues.length})
            </button>
          </div>

          {/* Search box inside customer transactions */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search items, date..."
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:border-[#084b3e] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Print-only Table Title */}
        <div className="hidden print:block px-4 py-2 bg-gray-100 border-b border-[#084b3e] font-black text-xs uppercase tracking-wider">
          Transaction Ledger & Itemized History
        </div>

        {/* Transactions Table */}
        {displayedTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-wider border-b border-gray-100 print:bg-[#084b3e] print:text-white">
                  <th className="py-3 px-3 sm:px-4 w-[24%] md:w-[18%]">Date & Time</th>
                  <th className="py-3 px-3 sm:px-4 w-[38%] md:w-[32%]">Description / Service</th>
                  <th className="py-3 px-3 sm:px-4 w-[18%] md:w-[15%]">Type</th>
                  <th className="py-3 px-3 sm:px-4 text-right w-[20%] md:w-[15%]">Amount</th>
                  <th className="hidden md:table-cell py-3 px-3 sm:px-4 text-right md:w-[10%]">Paid</th>
                  <th className="hidden md:table-cell py-3 px-3 sm:px-4 text-right md:w-[10%]">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {displayedTransactions.map(t => {
                  const isDue = t.dueAmount > 0;
                  return (
                    <tr 
                      key={t.id} 
                      className={`hover:bg-gray-50/80 transition-colors ${isDue ? 'bg-red-50/10' : ''}`}
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900">{t.date}</div>
                        {t.time && <div className="text-[10px] text-gray-400 font-mono">{t.time}</div>}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-3 sm:px-4">
                        <div className="font-bold text-gray-900 text-xs sm:text-sm">
                          {t.title}
                        </div>
                        {t.category && (
                          <span className="text-[10px] text-gray-400">
                            {t.category}
                          </span>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3 sm:px-4">
                        {t.type === 'due' ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                            Due Record
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-800 border border-gray-100">
                            Sale ({t.paymentMethod || 'Cash'})
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 sm:px-4 text-right font-black text-gray-900">
                        Tk {t.amount.toLocaleString()}
                        {/* Mobile view sub-breakdown */}
                        <div className="md:hidden text-[10px] font-normal text-gray-400">
                          Paid: Tk {t.paidAmount.toLocaleString()}
                          {t.dueAmount > 0 && <span className="text-red-600 font-bold ml-1">Due: {t.dueAmount}</span>}
                        </div>
                      </td>

                      {/* Paid (Desktop) */}
                      <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right font-bold text-emerald-700">
                        Tk {t.paidAmount.toLocaleString()}
                      </td>

                      {/* Balance / Due (Desktop) */}
                      <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right">
                        {t.dueAmount > 0 ? (
                          <span className="font-black text-red-600">
                            Tk {t.dueAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Table Footer with Summary */}
              <tfoot>
                <tr className="bg-gray-100 text-gray-900 font-black text-xs border-t-2 border-gray-300 print:border-[#084b3e] print:bg-white">
                  <td colSpan={3} className="py-3 px-3 sm:px-4 uppercase">
                    Total ({displayedTransactions.length} records)
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-right font-black text-gray-900">
                    Tk {displayedTransactions.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                  </td>
                  <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-emerald-700 font-black">
                    Tk {displayedTransactions.reduce((acc, curr) => acc + curr.paidAmount, 0).toLocaleString()}
                  </td>
                  <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-red-600 font-black">
                    Tk {displayedTransactions.reduce((acc, curr) => acc + curr.dueAmount, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-xs text-gray-400">No transactions match your criteria.</p>
          </div>
        )}
      </div>

      {/* PRINT-ONLY SIGNATURE SECTION */}
      <div className="hidden print:flex justify-between items-end pt-14 mt-8 border-t border-gray-300 text-xs font-bold text-gray-800">
        <div>
          <div className="w-48 border-b border-gray-500 mb-1.5"></div>
          <p className="font-black text-gray-900">Customer Signature</p>
          <p className="text-[10px] text-gray-500 font-normal">{customer.name}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-400 font-normal">System Generated Ledger</p>
          <p className="text-[10px] text-gray-500">{format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
        </div>
        <div className="text-right">
          <div className="w-48 border-b border-gray-500 mb-1.5 ml-auto"></div>
          <p className="font-black text-gray-900">Authorized Signature & Seal</p>
          <p className="text-[10px] text-gray-500 font-normal">Al-Barakah Digital Studio</p>
        </div>
      </div>

      {/* COLLECT DUE MODAL */}
      {isCollectModalOpen && (
        <div 
          className="fixed inset-0 bg-[#084b3e]/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4"
          onClick={() => setIsCollectModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <div>
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-gray-900">
                  Collect Due Payment
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  {customer.name} (Balance: Tk {duesMetrics.pendingDue.toLocaleString()})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCollectModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmCollect} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Collection Amount (Tk) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={collectAmount}
                  onChange={e => setCollectAmount(e.target.value)}
                  placeholder="Enter amount in Taka"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-sm font-bold bg-white"
                  autoFocus
                />
                <div className="flex gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setCollectAmount(duesMetrics.pendingDue.toString())}
                    className="text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded border border-gray-100"
                  >
                    Full Balance (Tk {duesMetrics.pendingDue})
                  </button>
                  {duesMetrics.pendingDue > 100 && (
                    <button
                      type="button"
                      onClick={() => setCollectAmount(Math.round(duesMetrics.pendingDue / 2).toString())}
                      className="text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded border border-gray-100"
                    >
                      50% (Tk {Math.round(duesMetrics.pendingDue / 2)})
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Cash', 'bKash', 'Nagad', 'Rocket'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCollectMethod(m)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                        collectMethod === m
                          ? 'bg-[#084b3e] text-white border-[#084b3e]'
                          : 'bg-white text-gray-700 border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={collectNote}
                  onChange={e => setCollectNote(e.target.value)}
                  placeholder="e.g. Paid in cash at counter"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs font-medium"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs uppercase tracking-wider hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCollection}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <DollarSign size={15} strokeWidth={2.5} />
                  <span>{isSubmittingCollection ? 'Saving...' : 'Confirm Payment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {isEditModalOpen && (
        <div 
          className="fixed inset-0 bg-[#084b3e]/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-gray-900">
                Edit Customer Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 sm:p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Address / Location
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={e => setEditAddress(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs uppercase tracking-wider hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#084b3e] hover:bg-[#126b55] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save size={15} />
                  <span>Update Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
