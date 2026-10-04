import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Customer, Sale, Due, Borrowing } from '../db/db';
import { adjustAccountBalance, mapPaymentMethodToAccountId } from '../services/accountService';
import { logDueEdit, logDueClear, recordActivityLog } from '../services/activityLogService';
import { 
  ArrowLeft, 
  Phone, 
  MapPin, 
  Calendar, 
  Edit2, 
  DollarSign, 
  PhoneCall, 
  MessageSquare, 
  Printer, 
  Download, 
  CheckCircle2, 
  Plus, 
  AlertCircle, 
  AlertTriangle,
  Clock, 
  Search, 
  X, 
  ShoppingBag,
  Check,
  Loader2,
  Receipt,
  HandCoins
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { generateCustomerStatementPdf, printCustomerStatement, CustomerTransactionItem } from '../utils/customerStatementPdf';
import { formatDateStr } from '../utils/dateFormatter';

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
  const allBorrowings = useLiveQuery(() => db.borrowings.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  // Local UI states
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'dues' | 'loans'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Collect Due modal states
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectDiscount, setCollectDiscount] = useState('');
  const [collectMethod, setCollectMethod] = useState<'Cash' | 'bKash' | 'Nagad' | 'Rocket'>('Cash');
  const [collectNote, setCollectNote] = useState('');
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);

  // Borrow / Loan modal states
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [borrowAmount, setBorrowAmount] = useState('');
  const [borrowDate, setBorrowDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [borrowDurationDays, setBorrowDurationDays] = useState('30');
  const [borrowDueDate, setBorrowDueDate] = useState(() => format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [borrowAccount, setBorrowAccount] = useState('cash');
  const [borrowNote, setBorrowNote] = useState('');
  const [isSubmittingBorrow, setIsSubmittingBorrow] = useState(false);

  const updateBorrowDurationDays = (daysStr: string, baseDateStr = borrowDate) => {
    setBorrowDurationDays(daysStr);
    const numDays = parseInt(daysStr, 10);
    if (!isNaN(numDays) && numDays > 0) {
      try {
        const base = baseDateStr ? new Date(baseDateStr) : new Date();
        setBorrowDueDate(format(addDays(base, numDays), 'yyyy-MM-dd'));
      } catch {
        setBorrowDueDate(format(addDays(new Date(), numDays), 'yyyy-MM-dd'));
      }
    }
  };

  const handleBorrowDateChange = (newBorrowDate: string) => {
    setBorrowDate(newBorrowDate);
    const numDays = parseInt(borrowDurationDays, 10) || 30;
    try {
      const base = newBorrowDate ? new Date(newBorrowDate) : new Date();
      setBorrowDueDate(format(addDays(base, numDays), 'yyyy-MM-dd'));
    } catch {}
  };

  const handleDirectDueDateChange = (newDueDate: string) => {
    setBorrowDueDate(newDueDate);
    if (newDueDate && borrowDate) {
      try {
        const diff = differenceInDays(new Date(newDueDate), new Date(borrowDate));
        if (diff > 0) {
          setBorrowDurationDays(String(diff));
        }
      } catch {}
    }
  };

  // Edit Customer modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Match raw sales for this customer
  const customerSales = useMemo(() => {
    if (!customer) return [];
    const custName = customer.name.trim().toLowerCase();
    const custPhone = customer.phone?.trim();

    return allSales.filter(s => {
      if (s.customerPhone && custPhone && s.customerPhone === custPhone) return true;
      if (!s.customerName) return false;
      const sName = s.customerName.trim().toLowerCase();
      return sName === custName;
    }).sort((a, b) => {
      const dateA = `${a.date} ${a.time || ''}`;
      const dateB = `${b.date} ${b.time || ''}`;
      return dateB.localeCompare(dateA);
    });
  }, [customer, allSales]);

  // Match raw dues for this customer
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

  // UNIFIED & STRICTLY DEDUPLICATED TRANSACTIONS
  // Solves duplicate display issue where a credit sale was listed twice (as both sale and due)
  const unifiedTransactions = useMemo<CustomerTransactionItem[]>(() => {
    if (!customer) return [];
    const items: CustomerTransactionItem[] = [];
    const matchedDueIds = new Set<number>();

    // 1. Process customer sales first
    customerSales.forEach(s => {
      const isCreditSale = s.paymentMethod === 'Due' || (s.dueAmount !== undefined && s.dueAmount > 0);
      
      // Look for a corresponding due record in customerDues
      let matchingDue: Due | undefined;
      if (isCreditSale) {
        matchingDue = customerDues.find(d => {
          if (!d.id || matchedDueIds.has(d.id)) return false;
          // Match by referenceId if available
          if (d.referenceId && d.referenceId === s.id) return true;
          // Match by date and amount
          const sameDate = (d.date || '').slice(0, 10) === (s.date || '').slice(0, 10);
          const sameAmt = Math.abs((d.totalAmount || 0) - s.amount) < 0.01;
          return sameDate && sameAmt;
        });

        if (matchingDue && matchingDue.id) {
          matchedDueIds.add(matchingDue.id);
        }
      }

      // Determine actual live paid and due amounts
      let livePaid = s.paidAmount !== undefined ? s.paidAmount : (isCreditSale ? 0 : s.amount);
      let liveDue = s.dueAmount !== undefined ? s.dueAmount : (isCreditSale ? s.amount : 0);
      let liveStatus = isCreditSale ? (liveDue <= 0 ? 'Paid' : (livePaid > 0 ? 'Partial' : 'Unpaid')) : 'Paid';

      if (matchingDue) {
        livePaid = matchingDue.paidAmount || 0;
        liveDue = Math.max(0, (matchingDue.totalAmount || 0) - (matchingDue.paidAmount || 0));
        liveStatus = matchingDue.status || (liveDue <= 0 ? 'Paid' : (livePaid > 0 ? 'Partial' : 'Unpaid'));
      }

      items.push({
        id: `sale-${s.id}`,
        date: s.date,
        time: s.time,
        type: 'sale',
        title: s.serviceName,
        category: s.category || 'Digital Studio',
        paymentMethod: s.paymentMethod || 'Cash',
        amount: s.amount || 0,
        paidAmount: livePaid,
        dueAmount: liveDue,
        profit: s.profit || 0,
        status: liveStatus,
      });
    });

    // 2. Process standalone dues (such as MFS credit dues or manual dues) not already covered
    customerDues.forEach(d => {
      if (!d.id || matchedDueIds.has(d.id)) return;
      
      // If marked as referenceType === 'sale', it belongs to a sale; do not duplicate
      if (d.referenceType === 'sale') return;

      // Check if already represented in items with same date and amount
      const alreadyHandledInSales = items.some(it => 
        it.type === 'sale' && 
        (it.date || '').slice(0, 10) === (d.date || '').slice(0, 10) && 
        Math.abs(it.amount - (d.totalAmount || 0)) < 0.01
      );
      if (alreadyHandledInSales) {
        matchedDueIds.add(d.id);
        return;
      }

      matchedDueIds.add(d.id);
      const rem = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
      const isMfs = d.referenceType === 'mfs' || (d.note && d.note.toLowerCase().includes('mfs'));

      items.push({
        id: `due-${d.id}`,
        date: d.date || '',
        time: d.time,
        type: 'due',
        title: d.note ? d.note : (isMfs ? 'MFS Service Credit' : 'Customer Credit / Due'),
        category: isMfs ? 'MFS Service' : 'Due Ledger',
        paymentMethod: isMfs ? 'MFS Due' : 'Due',
        amount: d.totalAmount || 0,
        paidAmount: d.paidAmount || 0,
        dueAmount: rem,
        status: d.status || (rem <= 0 ? 'Paid' : ((d.paidAmount || 0) > 0 ? 'Partial' : 'Unpaid')),
      });
    });

    // Deduplicate any exact duplicate items by id
    const uniqueMap = new Map<string, CustomerTransactionItem>();
    items.forEach(it => {
      uniqueMap.set(String(it.id), it);
    });

    // Sort descending by date & time
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const dateA = `${a.date || ''} ${a.time || ''}`;
      const dateB = `${b.date || ''} ${b.time || ''}`;
      return dateB.localeCompare(dateA);
    });
  }, [customer, customerSales, customerDues]);

  // Derived financial metrics from deduplicated list
  const metrics = useMemo(() => {
    let totalPurchases = 0;
    let totalPaid = 0;
    let currentDue = 0;

    unifiedTransactions.forEach(t => {
      totalPurchases += t.amount;
      totalPaid += t.paidAmount;
      currentDue += t.dueAmount;
    });

    return {
      totalPurchases,
      totalPaid,
      currentDue,
      salesCount: unifiedTransactions.filter(t => t.type === 'sale').length,
      duesCount: unifiedTransactions.filter(t => t.dueAmount > 0).length,
    };
  }, [unifiedTransactions]);

  // Customer Borrowings calculation
  const customerBorrowings = useMemo(() => {
    if (!customer) return [];
    const custName = customer.name.trim().toLowerCase();
    const custPhone = customer.phone?.trim();

    return allBorrowings.filter(b => {
      if (b.customerId && customer.id && b.customerId === customer.id) return true;
      if (custPhone && b.phone && b.phone.trim() === custPhone) return true;
      if (b.lenderName && b.lenderName.trim().toLowerCase() === custName) return true;
      return false;
    }).sort((a, b) => {
      const dateA = `${a.date || ''} ${a.time || ''}`;
      const dateB = `${b.date || ''} ${b.time || ''}`;
      return dateB.localeCompare(dateA);
    });
  }, [customer, allBorrowings]);

  const totalCustomerBorrowed = useMemo(() => {
    return customerBorrowings.reduce((sum, b) => sum + (b.amount || 0), 0);
  }, [customerBorrowings]);

  const totalCustomerRepaid = useMemo(() => {
    return customerBorrowings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
  }, [customerBorrowings]);

  const activeCustomerLoanBalance = Math.max(0, totalCustomerBorrowed - totalCustomerRepaid);

  // Filtered by active tab and search query
  const displayedTransactions = useMemo(() => {
    let list = unifiedTransactions;

    if (activeTab === 'sales') {
      list = list.filter(t => t.type === 'sale');
    } else if (activeTab === 'dues') {
      list = list.filter(t => t.dueAmount > 0 || t.type === 'due');
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
  const handleExportPdf = async () => {
    if (!customer) return;
    setIsExportingPdf(true);
    try {
      await generateCustomerStatementPdf({
        customer,
        transactions: unifiedTransactions,
        totalPurchases: metrics.totalPurchases,
        totalPaid: metrics.totalPaid,
        totalDueGiven: metrics.totalPurchases,
        currentBalanceDue: metrics.currentDue,
        periodLabel: 'All Records',
      });
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (err) {
      console.error('PDF export error:', err);
      setErrorMsg('Could not generate PDF statement');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle Direct Print
  const handlePrint = async () => {
    if (!customer) return;
    try {
      await printCustomerStatement({
        customer,
        transactions: unifiedTransactions,
        totalPurchases: metrics.totalPurchases,
        totalPaid: metrics.totalPaid,
        totalDueGiven: metrics.totalPurchases,
        currentBalanceDue: metrics.currentDue,
        periodLabel: 'All Records',
      });
    } catch (err) {
      console.error('Print error:', err);
      window.print();
    }
  };

  // Handle Collect Due Submission
  const handleConfirmCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const cashAmount = parseFloat(collectAmount) || 0;
    const discountAmount = parseFloat(collectDiscount) || 0;
    const totalSettled = cashAmount + discountAmount;

    if (totalSettled <= 0) {
      setErrorMsg('Please enter a valid amount or discount');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    setIsSubmittingCollection(true);
    try {
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

      let remainingToSettle = totalSettled;
      let remainingCash = cashAmount;
      let remainingDiscount = discountAmount;
      let totalProfitEarned = 0;
      const nowIso = new Date().toISOString();
      const todayDate = format(new Date(), 'yyyy-MM-dd');
      const todayTime = format(new Date(), 'hh:mm:ss a');

      if (unsettledDues.length > 0) {
        for (const d of unsettledDues) {
          if (remainingToSettle <= 0) break;
          const currentTotal = d.totalAmount || 0;
          const currentPaid = d.paidAmount || 0;
          const currentRemaining = Math.max(0, currentTotal - currentPaid);
          if (currentRemaining <= 0) continue;

          const settleFromThis = Math.min(remainingToSettle, currentRemaining);
          const cashForThis = Math.min(settleFromThis, remainingCash);
          const discountForThis = Math.min(settleFromThis - cashForThis, remainingDiscount);

          const newPaid = currentPaid + settleFromThis;
          const newStatus = newPaid >= currentTotal ? 'Paid' : 'Partial';
          const newDueDiscount = (d.discount || 0) + discountForThis;

          await db.dues.update(d.id!, {
            paidAmount: newPaid,
            discount: newDueDiscount,
            status: newStatus,
            updatedAt: nowIso,
          });

          const isMfsDue = d.referenceType === 'mfs';

          if (!isMfsDue) {
            const totalDueAmt = currentTotal || settleFromThis;
            const ratio = totalDueAmt > 0 ? (settleFromThis / totalDueAmt) : 1;
            const costPart = Math.round(((d.cost || 0) * ratio) * 100) / 100;
            // Net profit after discount
            const profitPart = Math.max(0, Math.round((cashForThis - costPart) * 100) / 100);

            totalProfitEarned += profitPart;

            if (cashForThis > 0 || discountForThis > 0) {
              // Record the collected sale & profit
              await db.sales.add({
                date: todayDate,
                time: todayTime,
                createdAt: nowIso,
                updatedAt: nowIso,
                category: d.category || 'Due Collection',
                serviceName: d.serviceName ? `Due Clear: ${d.serviceName}` : `Due Cleared (${customer.name})`,
                amount: cashForThis,
                cost: costPart,
                profit: profitPart,
                discount: discountForThis > 0 ? discountForThis : undefined,
                paymentMethod: collectMethod,
                note: `Due cleared (${newStatus}): Tk ${cashForThis.toLocaleString()} paid${discountForThis > 0 ? ` [Tk ${discountForThis.toLocaleString()} Discount]` : ''} of Tk ${currentTotal.toLocaleString()} for ${d.serviceName || 'Service'}${collectNote.trim() ? ` - ${collectNote.trim()}` : ''}`,
                customerName: customer.name,
                customerPhone: customer.phone,
                paidAmount: cashForThis,
                dueAmount: 0,
                quantity: 1
              });
            }
          } else {
            // MFS Due: account balance is increased, recognize proportional fee profit if any
            const totalDueAmt = currentTotal || settleFromThis;
            const ratio = totalDueAmt > 0 ? (settleFromThis / totalDueAmt) : 1;
            const mfsProfitPart = d.profit ? Math.round((d.profit * ratio) * 100) / 100 : 0;
            totalProfitEarned += Math.max(0, mfsProfitPart - discountForThis);
          }

          remainingToSettle -= settleFromThis;
          remainingCash -= cashForThis;
          remainingDiscount -= discountForThis;
        }
      }

      // If any excess payment beyond dues, record as credit sale
      if (remainingCash > 0) {
        totalProfitEarned += remainingCash;
        await db.sales.add({
          date: todayDate,
          time: todayTime,
          createdAt: nowIso,
          updatedAt: nowIso,
          category: 'Due Collection',
          serviceName: `Due Payment (${customer.name})`,
          amount: remainingCash,
          cost: 0,
          profit: remainingCash,
          paymentMethod: collectMethod,
          note: `Due credit collected: Tk ${remainingCash.toLocaleString()}${collectNote.trim() ? ` - ${collectNote.trim()}` : ''}`,
          customerName: customer.name,
          customerPhone: customer.phone,
          paidAmount: remainingCash,
          dueAmount: 0,
          quantity: 1
        });
      }

      const discountMsg = discountAmount > 0 ? ` (Tk ${discountAmount.toLocaleString()} discount)` : '';
      setSuccessMsg(`Cleared Tk ${totalSettled.toLocaleString()} due${discountMsg} (${collectMethod}) for ${customer.name}.`);
      
      // Update account balance only with actual cash received
      if (cashAmount > 0) {
        try {
          const targetAccountId = mapPaymentMethodToAccountId(collectMethod) || 'cash';
          await adjustAccountBalance(targetAccountId, cashAmount);
        } catch (err) {
          console.error('Failed to update account balance in CustomerProfile:', err);
        }
      }

      // Log activity
      try {
        await logDueClear(
          customer.name, 
          cashAmount, 
          collectMethod, 
          totalProfitEarned, 
          collectNote.trim() ? `Note: ${collectNote.trim()}` : undefined,
          discountAmount
        );
      } catch (logErr) {
        console.warn('Failed to log due collection activity:', logErr);
      }

      setIsCollectModalOpen(false);
      setCollectAmount('');
      setCollectDiscount('');
      setCollectNote('');
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      console.error('Error recording payment:', err);
      setErrorMsg('Failed to record collection');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  // Handle Direct Borrow / Loan Submission
  const handleConfirmBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const parsedAmount = parseFloat(borrowAmount) || 0;
    if (parsedAmount <= 0) {
      setErrorMsg('Please enter a valid loan amount');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    setIsSubmittingBorrow(true);
    try {
      const now = new Date();
      const entryDate = borrowDate || format(now, 'yyyy-MM-dd');
      const newId = await db.borrowings.add({
        date: entryDate,
        time: format(now, 'hh:mm:ss a'),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        customerId: customer.id,
        lenderName: customer.name.trim(),
        phone: customer.phone ? customer.phone.trim() : undefined,
        amount: parsedAmount,
        paidAmount: 0,
        dueDate: borrowDueDate,
        status: 'Unpaid',
        note: borrowNote.trim() || undefined,
        receiveAccount: borrowAccount !== 'none' ? borrowAccount : undefined
      });

      if (borrowAccount !== 'none' && parsedAmount > 0) {
        await adjustAccountBalance(borrowAccount, parsedAmount);
      }

      await recordActivityLog({
        action: 'CREATE',
        module: 'Borrowings',
        title: `Borrowing Tk ${parsedAmount.toLocaleString()} from ${customer.name}`,
        details: `Recorded from Customer Profile. Received in ${borrowAccount} (Due: ${borrowDueDate || 'N/A'}, Date: ${entryDate})`,
        meta: { borrowingId: newId, customerId: customer.id, lenderName: customer.name, amount: parsedAmount, receiveAccount: borrowAccount }
      });

      setIsBorrowModalOpen(false);
      setBorrowAmount('');
      const today = format(new Date(), 'yyyy-MM-dd');
      setBorrowDate(today);
      setBorrowDurationDays('30');
      setBorrowDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
      setBorrowNote('');
      setSuccessMsg(`Recorded borrowing of Tk ${parsedAmount.toLocaleString()} from ${customer.name} successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error creating borrowing:', err);
      setErrorMsg('Failed to record borrowing');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsSubmittingBorrow(false);
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
      setErrorMsg('Could not update profile');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Clean phone for WhatsApp
  const cleanPhone = customer?.phone ? customer.phone.replace(/[^0-9]/g, '') : '';
  const hasDue = metrics.currentDue > 0;

  if (!customer && customerId) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center py-20">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Customer Not Found</h2>
        <p className="text-xs text-gray-500 mb-4">The customer record could not be found.</p>
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 bg-[#084b3e] text-white px-4 py-2 rounded-xl font-bold text-xs"
        >
          <ArrowLeft size={14} />
          <span>Back to Customers</span>
        </Link>
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto mb-16 md:mb-0 space-y-4 print:p-0 print:m-0 print:max-w-none">
      
      {/* Top Bar (Breadcrumb & Action Buttons) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <ArrowLeft size={15} />
            <span>Customers</span>
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-black text-gray-900 tracking-tight truncate">
            {customer.name}
          </h1>
          <span className="text-[11px] font-mono font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
            #CUS-{customer.id}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setBorrowAmount('');
              setBorrowDate(format(new Date(), 'yyyy-MM-dd'));
              setBorrowDueDate('');
              setBorrowNote('');
              setBorrowAccount('cash');
              setIsBorrowModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Record loan or borrowing from this customer"
          >
            <HandCoins size={14} strokeWidth={2.5} />
            <span>Borrow / Loan</span>
          </button>

          {hasDue && (
            <button
              type="button"
              onClick={() => {
                setCollectAmount(metrics.currentDue.toString());
                setIsCollectModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <DollarSign size={14} strokeWidth={2.5} />
              <span>Collect Due</span>
            </button>
          )}

          <Link
            to={`/sales?customer=${encodeURIComponent(customer.name)}&phone=${encodeURIComponent(customer.phone || '')}`}
            className="flex items-center gap-1.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Sale</span>
          </Link>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-700 transition-colors cursor-pointer shadow-xs disabled:opacity-75"
            title="Download PDF Statement"
          >
            <Download size={15} />
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-700 transition-colors cursor-pointer shadow-xs"
            title="Print Statement"
          >
            <Printer size={15} />
          </button>

          <button
            type="button"
            onClick={handleOpenEdit}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-700 transition-colors cursor-pointer shadow-xs"
            title="Edit Profile"
          >
            <Edit2 size={15} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center text-emerald-900 font-bold text-xs tracking-wide shadow-xs print:hidden">
          <CheckCircle2 className="mr-2 shrink-0 text-emerald-600" size={16} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center text-rose-900 font-bold text-xs tracking-wide shadow-xs print:hidden">
          <AlertTriangle className="mr-2 shrink-0 text-rose-600" size={16} />
          {errorMsg}
        </div>
      )}

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h1 className="text-xl font-black text-gray-900 uppercase">
          Al-Barakah Digital Studio & Online Service
        </h1>
        <p className="text-xs text-gray-600 font-medium">Customer Statement & Ledger</p>
        <div className="flex justify-between items-end mt-3 text-left text-xs">
          <div>
            <p className="font-bold text-gray-900">{customer.name}</p>
            <p className="text-gray-600">Phone: {customer.phone || 'N/A'}</p>
            {customer.address && <p className="text-gray-600">Address: {customer.address}</p>}
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-900">#CUS-{customer.id}</p>
            <p className="text-gray-500">{format(new Date(), 'dd/MM/yyyy, hh:mm a')}</p>
          </div>
        </div>
      </div>

      {/* MINIMALIST HERO & STATS CARD */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-gray-900">{customer.name}</h2>
              {hasDue ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  Tk {metrics.currentDue.toLocaleString()} Due
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Clear
                </span>
              )}
            </div>
            
            {/* Quick contact and info strip */}
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
              {customer.phone && (
                <span className="flex items-center gap-1 font-medium text-gray-700">
                  <Phone size={13} className="text-gray-400" />
                  {customer.phone}
                </span>
              )}
              {customer.address && (
                <span className="flex items-center gap-1 text-gray-600">
                  <MapPin size={13} className="text-gray-400" />
                  {customer.address}
                </span>
              )}
              {customer.createdAt && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Calendar size={12} />
                  Since {format(new Date(customer.createdAt), 'dd/MM/yy')}
                </span>
              )}
            </div>
          </div>

          {/* Contact Triggers */}
          {customer.phone && (
            <div className="flex items-center gap-2 print:hidden">
              <a
                href={`tel:${customer.phone}`}
                className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1 text-xs font-semibold"
                title="Call"
              >
                <PhoneCall size={13} />
                <span>Call</span>
              </a>
              {cleanPhone && (
                <a
                  href={`https://wa.me/88${cleanPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors flex items-center gap-1 text-xs font-semibold"
                  title="WhatsApp"
                >
                  <MessageSquare size={13} />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Minimal Metric Clean Grid */}
        <div className={`grid grid-cols-1 ${customerBorrowings.length > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
          {/* Total Purchases */}
          <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
              Total Purchases
            </span>
            <div className="text-lg font-black text-gray-900 mt-0.5">
              Tk {metrics.totalPurchases.toLocaleString()}
            </div>
            <span className="text-[11px] text-gray-400">
              {metrics.salesCount} {metrics.salesCount === 1 ? 'order' : 'orders'}
            </span>
          </div>

          {/* Total Paid */}
          <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
              Total Paid
            </span>
            <div className="text-lg font-black text-emerald-800 mt-0.5">
              Tk {metrics.totalPaid.toLocaleString()}
            </div>
            <span className="text-[11px] text-emerald-600/70">
              Cash & digital cleared
            </span>
          </div>

          {/* Current Due Balance */}
          <div className={`p-3.5 rounded-xl border ${
            hasDue 
              ? 'bg-rose-50/70 border-rose-200 text-rose-900' 
              : 'bg-gray-50/70 border-gray-100 text-gray-900'
          }`}>
            <span className={`text-[11px] font-semibold uppercase tracking-wider block ${hasDue ? 'text-rose-600' : 'text-gray-500'}`}>
              Due Balance
            </span>
            <div className={`text-lg font-black mt-0.5 ${hasDue ? 'text-rose-600' : 'text-gray-900'}`}>
              Tk {metrics.currentDue.toLocaleString()}
            </div>
            <span className="text-[11px] text-gray-400">
              {hasDue ? 'Unsettled balance' : 'Zero balance'}
            </span>
          </div>

          {/* Loan from Customer */}
          {customerBorrowings.length > 0 && (
            <div className={`p-3.5 rounded-xl border ${
              activeCustomerLoanBalance > 0 
                ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
                : 'bg-gray-50/70 border-gray-100 text-gray-900'
            }`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider block ${activeCustomerLoanBalance > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                Active Loan
              </span>
              <div className={`text-lg font-black mt-0.5 ${activeCustomerLoanBalance > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
                Tk {activeCustomerLoanBalance.toLocaleString()}
              </div>
              <span className="text-[11px] text-gray-400">
                {customerBorrowings.length} {customerBorrowings.length === 1 ? 'loan' : 'loans'} recorded
              </span>
            </div>
          )}
        </div>

        {/* Customer Notes if available */}
        {customer.notes && (
          <div className="p-2.5 bg-gray-50 rounded-xl text-xs text-gray-600 border border-gray-100">
            <span className="font-bold text-gray-700 mr-1.5">Note:</span>
            {customer.notes}
          </div>
        )}
      </div>

      {/* TRANSACTIONS SECTION */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs print:border-none print:shadow-none">
        
        {/* Controls Bar: Tabs & Search */}
        <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({unifiedTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'sales'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sales ({metrics.salesCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dues')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'dues'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dues ({metrics.duesCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('loans')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'loans'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Loans ({customerBorrowings.length})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search items, date..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-[#084b3e] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {activeTab === 'loans' ? (
          customerBorrowings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Lender</th>
                    <th className="py-3 px-4 text-right">Loan Amount</th>
                    <th className="py-3 px-4 text-right">Paid Back</th>
                    <th className="py-3 px-4 text-right">Due Balance</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Note</th>
                    <th className="py-3 px-4 text-center print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customerBorrowings.map(b => {
                    const dueAmt = Math.max(0, (b.amount || 0) - (b.paidAmount || 0));
                    return (
                      <tr key={b.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4 text-gray-600 font-bold">
                          {formatDateStr(b.date)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-900">{b.lenderName}</div>
                          {b.phone && <div className="text-[10px] text-gray-400 font-mono">{b.phone}</div>}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-gray-900">
                          Tk {(b.amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          Tk {(b.paidAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          {dueAmt > 0 ? (
                            <span className="text-rose-600 font-black">
                              Tk {dueAmt.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold">Tk 0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {b.dueDate ? formatDateStr(b.dueDate) : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'Partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500 max-w-xs truncate text-[11px]">
                          {b.note || '—'}
                        </td>
                        <td className="py-3 px-4 text-center print:hidden">
                          <Link
                            to="/borrowings"
                            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition-colors inline-block"
                          >
                            Manage
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/80 font-bold text-gray-900 border-t border-gray-200">
                    <td colSpan={2} className="py-3 px-4 uppercase text-[11px] text-gray-500">
                      Total ({customerBorrowings.length} records)
                    </td>
                    <td className="py-3 px-4 text-right font-black">
                      Tk {totalCustomerBorrowed.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700">
                      Tk {totalCustomerRepaid.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-600">
                      Tk {activeCustomerLoanBalance.toLocaleString()}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-600">
                <HandCoins size={24} />
              </div>
              <h4 className="font-bold text-gray-900 text-sm mb-1">No Loans Recorded</h4>
              <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
                No borrowing or loan records from {customer.name} have been created yet.
              </p>
              <button
                type="button"
                onClick={() => {
                  setBorrowAmount('');
                  setBorrowDate(format(new Date(), 'yyyy-MM-dd'));
                  setBorrowDueDate('');
                  setBorrowNote('');
                  setBorrowAccount('cash');
                  setIsBorrowModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <Plus size={14} />
                <span>Record Loan from {customer.name}</span>
              </button>
            </div>
          )
        ) : displayedTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedTransactions.map(t => {
                  const hasRowDue = t.dueAmount > 0;
                  return (
                    <tr 
                      key={t.id} 
                      className={`hover:bg-gray-50/60 transition-colors ${hasRowDue ? 'bg-amber-50/20' : ''}`}
                    >
                      {/* Date */}
                      <td className="py-3 px-4 text-gray-600">
                        <span className="font-bold text-gray-900">{formatDateStr(t.date)}</span>
                        {t.time && <span className="text-[10px] text-gray-400 ml-1.5 font-mono">{t.time}</span>}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{t.title}</div>
                        {t.category && (
                          <span className="text-[10px] text-gray-400">{t.category}</span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                          {t.paymentMethod || 'Cash'}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-black text-gray-900">
                        Tk {t.amount.toLocaleString()}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        Tk {t.paidAmount.toLocaleString()}
                      </td>

                      {/* Due Amount */}
                      <td className="py-3 px-4 text-right font-bold">
                        {t.dueAmount > 0 ? (
                          <span className="text-rose-600 font-black">
                            Tk {t.dueAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'Partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}>
                          {t.status}
                        </span>
                      </td>

                      {/* Quick Pay Action */}
                      <td className="py-3 px-4 text-center print:hidden">
                        {t.dueAmount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCollectAmount(t.dueAmount.toString());
                              setIsCollectModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold border border-rose-200 transition-colors cursor-pointer"
                          >
                            Pay
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Unique Totals Footer */}
              <tfoot>
                <tr className="bg-gray-50/80 font-bold text-gray-900 border-t border-gray-200">
                  <td colSpan={3} className="py-3 px-4 uppercase text-[11px] text-gray-500">
                    Total ({displayedTransactions.length} records)
                  </td>
                  <td className="py-3 px-4 text-right font-black">
                    Tk {displayedTransactions.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-emerald-700">
                    Tk {displayedTransactions.reduce((acc, curr) => acc + curr.paidAmount, 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-rose-600">
                    Tk {displayedTransactions.reduce((acc, curr) => acc + curr.dueAmount, 0).toLocaleString()}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400 text-xs">
            No transactions found.
          </div>
        )}
      </div>

      {/* COLLECT DUE MODAL (MINIMAL & FAST) */}
      {isCollectModalOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => setIsCollectModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <h3 className="font-bold text-xl text-[#182236] mb-1 text-center">Collect Due Payment</h3>
            <p className="text-xs text-gray-500 font-semibold mb-5 text-center">
              Customer: <span className="text-gray-900 font-bold">{customer.name}</span>
            </p>

            <form onSubmit={handleConfirmCollect} className="space-y-4">
              {/* Outstanding Due Highlight */}
              <div className="flex items-center justify-between p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                <div>
                  <span className="text-[10px] font-bold text-rose-600 uppercase">Outstanding Due</span>
                  <div className="text-lg font-black text-rose-700">
                    Tk {metrics.currentDue.toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setCollectAmount(metrics.currentDue.toString());
                      setCollectDiscount('');
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                  >
                    Pay Full
                  </button>
                  {parseFloat(collectAmount) > 0 && parseFloat(collectAmount) < metrics.currentDue && (
                    <button
                      type="button"
                      onClick={() => {
                        const diff = Math.max(0, metrics.currentDue - (parseFloat(collectAmount) || 0));
                        setCollectDiscount(diff > 0 ? diff.toString() : '');
                      }}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-amber-100 border border-amber-300 text-amber-900 hover:bg-amber-200 cursor-pointer"
                    >
                      Rem. as Discount
                    </button>
                  )}
                </div>
              </div>

              {/* Amount and Discount Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                    Received Amount (Tk) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required={!(parseFloat(collectDiscount) > 0)}
                    value={collectAmount}
                    onChange={e => setCollectAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-base font-black text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-mono"
                    autoFocus
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Cash drawer entry</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Discount (Tk)</span>
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded">Optional</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={collectDiscount}
                    onChange={e => setCollectDiscount(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-base font-black text-amber-950 outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/10 transition-all font-mono"
                  />
                  <p className="text-[10px] text-amber-700 mt-1">Waived from due</p>
                </div>
              </div>

              {/* Live Settlement Breakdown */}
              {(() => {
                const cAmt = parseFloat(collectAmount) || 0;
                const dAmt = parseFloat(collectDiscount) || 0;
                const tot = cAmt + dAmt;
                const rem = Math.max(0, metrics.currentDue - tot);
                return (
                  <div className="p-3.5 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between items-center text-gray-600 font-semibold">
                      <span>Cash Received:</span>
                      <span className="font-bold text-gray-900">Tk {cAmt.toLocaleString()}</span>
                    </div>
                    {dAmt > 0 && (
                      <div className="flex justify-between items-center text-amber-800 font-semibold">
                        <span>Discount:</span>
                        <span className="font-bold text-amber-900">- Tk {dAmt.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="border-t border-[#dce1e7] pt-1 flex justify-between items-center font-bold">
                      <span className="text-gray-800">Total Cleared from Due:</span>
                      <span className="text-emerald-700 font-black">Tk {tot.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-gray-500 pt-0.5">
                      <span>Remaining Due:</span>
                      <span className={`font-bold ${rem > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {rem > 0 ? `Tk ${rem.toLocaleString()}` : 'Tk 0 (Full Clear)'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Method */}
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['Cash', 'bKash', 'Nagad', 'Rocket'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCollectMethod(m)}
                      className={`h-[40px] text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        collectMethod === m
                          ? 'bg-[#075b4d] text-white border-[#075b4d]'
                          : 'bg-[#f8f9fa] text-gray-700 border-[#dce1e7] hover:bg-gray-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Remarks / Note
                </label>
                <input
                  type="text"
                  value={collectNote}
                  onChange={e => setCollectNote(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-gray-800 outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingCollection || ((parseFloat(collectAmount) || 0) + (parseFloat(collectDiscount) || 0) <= 0)}
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer active:translate-y-px disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingCollection ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  <span>Confirm (Tk {(parseFloat(collectAmount) || 0).toLocaleString()} Paid)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {isEditModalOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-xl text-[#182236] mb-6 text-center">Edit Customer Profile</h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-mono"
                  placeholder="01XXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={e => setEditAddress(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Notes
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] outline-none focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
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

      {/* Record Borrowing / Loan Modal */}
      {isBorrowModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setIsBorrowModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-[#182236] mb-6 text-center">
              Add New Borrowing
            </h3>

            <form onSubmit={handleConfirmBorrow} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                  Lender Name
                </label>
                <input
                  type="text"
                  disabled
                  value={customer.name}
                  className="w-full h-[47px] px-4 bg-gray-100 border border-[#dce1e7] rounded-xl font-bold text-gray-700 outline-none text-sm"
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
                  step="any"
                  autoFocus
                  value={borrowAmount}
                  onChange={(e) => setBorrowAmount(e.target.value)}
                  placeholder="0"
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl font-bold outline-none text-sm text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all font-mono"
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
                    value={borrowDurationDays}
                    onChange={(e) => updateBorrowDurationDays(e.target.value)}
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
                  value={borrowAccount}
                  onChange={(e) => setBorrowAccount(e.target.value)}
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
                  value={borrowNote}
                  onChange={(e) => setBorrowNote(e.target.value)}
                  placeholder="Reason or notes..."
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium outline-none text-[#1d2939] focus:border-[#075b4d] focus:bg-white focus:ring-2 focus:ring-[#075b4d]/10 transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingBorrow || !(parseFloat(borrowAmount) > 0)}
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer active:translate-y-px disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingBorrow ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <span>Save Borrowing</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
