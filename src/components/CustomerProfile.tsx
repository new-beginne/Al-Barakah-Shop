import React, { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Customer, Sale, Due, Borrowing } from "../db/db";
import {
  adjustAccountBalance,
  mapPaymentMethodToAccountId,
} from "../services/accountService";
import {
  logDueEdit,
  logDueClear,
  recordActivityLog,
} from "../services/activityLogService";
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
  HandCoins,
  ChevronDown,
  ChevronUp,
  History,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";
import { generateCustomerStatementPdf, printCustomerStatement, CustomerTransactionItem } from "../utils/customerStatementPdf";
import { formatDateStr } from "../utils/dateFormatter";
import { Modal } from "./common/Modal";

export function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = id ? parseInt(id, 10) : undefined;

  // Live queries
  const customer = useLiveQuery(
    () => (customerId ? db.customers.get(customerId) : undefined),
    [customerId],
  );
  const allSales = useLiveQuery(() => db.sales.toArray()) || [];
  const allDues = useLiveQuery(() => db.dues.toArray()) || [];
  const allBorrowings = useLiveQuery(() => db.borrowings.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const allActivityLogs = useLiveQuery(() => db.activityLogs.toArray()) || [];

  // Local UI states
  const [activeTab, setActiveTab] = useState<
    "all" | "sales" | "dues" | "payments" | "loans"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Collect Due modal states
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [selectedDueForPayment, setSelectedDueForPayment] =
    useState<Due | null>(null);
  const [expandedDueHistoryId, setExpandedDueHistoryId] = useState<
    number | null
  >(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectDiscount, setCollectDiscount] = useState("");
  const [collectMethod, setCollectMethod] = useState<
    "Cash" | "bKash" | "Nagad" | "Rocket"
  >("Cash");
  const [collectNote, setCollectNote] = useState("");
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);

  // Borrow / Loan modal states
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [borrowAmount, setBorrowAmount] = useState("");
  const [borrowDate, setBorrowDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [borrowDurationDays, setBorrowDurationDays] = useState("30");
  const [borrowDueDate, setBorrowDueDate] = useState(() =>
    format(addDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [borrowAccount, setBorrowAccount] = useState("cash");
  const [borrowNote, setBorrowNote] = useState("");
  const [isSubmittingBorrow, setIsSubmittingBorrow] = useState(false);

  const updateBorrowDurationDays = (
    daysStr: string,
    baseDateStr = borrowDate,
  ) => {
    setBorrowDurationDays(daysStr);
    const numDays = parseInt(daysStr, 10);
    if (!isNaN(numDays) && numDays > 0) {
      try {
        const base = baseDateStr ? new Date(baseDateStr) : new Date();
        setBorrowDueDate(format(addDays(base, numDays), "yyyy-MM-dd"));
      } catch {
        setBorrowDueDate(format(addDays(new Date(), numDays), "yyyy-MM-dd"));
      }
    }
  };

  const handleBorrowDateChange = (newBorrowDate: string) => {
    setBorrowDate(newBorrowDate);
    const numDays = parseInt(borrowDurationDays, 10) || 30;
    try {
      const base = newBorrowDate ? new Date(newBorrowDate) : new Date();
      setBorrowDueDate(format(addDays(base, numDays), "yyyy-MM-dd"));
    } catch {}
  };

  const handleDirectDueDateChange = (newDueDate: string) => {
    setBorrowDueDate(newDueDate);
    if (newDueDate && borrowDate) {
      try {
        const diff = differenceInDays(
          new Date(newDueDate),
          new Date(borrowDate),
        );
        if (diff > 0) {
          setBorrowDurationDays(String(diff));
        }
      } catch {}
    }
  };

  const openCollectForSpecificDue = (d: Due) => {
    setSelectedDueForPayment(d);
    const rem = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
    setCollectDiscount("");
    setCollectAmount(rem > 0 ? rem.toString() : "");
    setCollectMethod("Cash");
    setCollectNote("");
    setIsCollectModalOpen(true);
  };

  const openCollectForAllDues = () => {
    setSelectedDueForPayment(null);
    setCollectDiscount("");
    setCollectAmount(
      dueMetrics.pendingDue > 0 ? dueMetrics.pendingDue.toString() : "",
    );
    setCollectMethod("Cash");
    setCollectNote("");
    setIsCollectModalOpen(true);
  };

  // Edit Customer modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Match raw sales for this customer
  const customerSales = useMemo(() => {
    if (!customer) return [];
    const custName = customer.name.trim().toLowerCase();
    const custPhone = customer.phone?.trim();

    return allSales
      .filter((s) => {
        if (s.customerPhone && custPhone && s.customerPhone === custPhone)
          return true;
        if (!s.customerName) return false;
        const sName = s.customerName.trim().toLowerCase();
        return sName === custName;
      })
      .sort((a, b) => {
        const dateA = `${a.date} ${a.time || ""}`;
        const dateB = `${b.date} ${b.time || ""}`;
        return dateB.localeCompare(dateA);
      });
  }, [customer, allSales]);

  // Match raw dues for this customer
  const customerDues = useMemo(() => {
    if (!customer) return [];
    const custName = customer.name.trim().toLowerCase();
    const custPhone = customer.phone?.trim();

    return allDues
      .filter((d) => {
        const dPhone = d.phone?.trim();
        const dName = d.customerName?.trim().toLowerCase();
        if (custPhone && dPhone && custPhone === dPhone) return true;
        if (dName && dName === custName) return true;
        return false;
      })
      .sort((a, b) => {
        const dateA = `${a.date || ""} ${a.time || ""}`;
        const dateB = `${b.date || ""} ${b.time || ""}`;
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
    customerSales.forEach((s) => {
      const isCreditSale =
        s.paymentMethod === "Due" ||
        (s.dueAmount !== undefined && s.dueAmount > 0);

      // Look for a corresponding due record in customerDues
      let matchingDue: Due | undefined;
      if (isCreditSale) {
        matchingDue = customerDues.find((d) => {
          if (!d.id || matchedDueIds.has(d.id)) return false;
          // Match by referenceId if available
          if (d.referenceId && d.referenceId === s.id) return true;
          // Match by date and amount
          const sameDate =
            (d.date || "").slice(0, 10) === (s.date || "").slice(0, 10);
          const sameAmt = Math.abs((d.totalAmount || 0) - s.amount) < 0.01;
          return sameDate && sameAmt;
        });

        if (matchingDue && matchingDue.id) {
          matchedDueIds.add(matchingDue.id);
        }
      }

      // Determine actual live paid and due amounts
      let livePaid =
        s.paidAmount !== undefined ? s.paidAmount : isCreditSale ? 0 : s.amount;
      let liveDue =
        s.dueAmount !== undefined ? s.dueAmount : isCreditSale ? s.amount : 0;
      let liveStatus = isCreditSale
        ? liveDue <= 0
          ? "Paid"
          : livePaid > 0
            ? "Partial"
            : "Unpaid"
        : "Paid";

      if (matchingDue) {
        livePaid = matchingDue.paidAmount || 0;
        liveDue = Math.max(
          0,
          (matchingDue.totalAmount || 0) - (matchingDue.paidAmount || 0),
        );
        liveStatus =
          matchingDue.status ||
          (liveDue <= 0 ? "Paid" : livePaid > 0 ? "Partial" : "Unpaid");
      }

      items.push({
        id: `sale-${s.id}`,
        date: s.date,
        time: s.time,
        type: "sale",
        title: s.serviceName,
        category: s.category || "Digital Studio",
        paymentMethod: s.paymentMethod || "Cash",
        amount: s.amount || 0,
        paidAmount: livePaid,
        dueAmount: liveDue,
        profit: s.profit || 0,
        status: liveStatus,
      });
    });

    // 2. Process standalone dues (such as MFS credit dues or manual dues) not already covered
    customerDues.forEach((d) => {
      if (!d.id || matchedDueIds.has(d.id)) return;

      // If marked as referenceType === 'sale', it belongs to a sale; do not duplicate
      if (d.referenceType === "sale") return;

      // Check if already represented in items with same date and amount
      const alreadyHandledInSales = items.some(
        (it) =>
          it.type === "sale" &&
          (it.date || "").slice(0, 10) === (d.date || "").slice(0, 10) &&
          Math.abs(it.amount - (d.totalAmount || 0)) < 0.01,
      );
      if (alreadyHandledInSales) {
        matchedDueIds.add(d.id);
        return;
      }

      matchedDueIds.add(d.id);
      const rem = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
      const isMfs =
        d.referenceType === "mfs" ||
        (d.note && d.note.toLowerCase().includes("mfs"));

      items.push({
        id: `due-${d.id}`,
        date: d.date || "",
        time: d.time,
        type: "due",
        title: d.note
          ? d.note
          : isMfs
            ? "MFS Service Credit"
            : "Customer Credit / Due",
        category: isMfs ? "MFS Service" : "Due Ledger",
        paymentMethod: isMfs ? "MFS Due" : "Due",
        amount: d.totalAmount || 0,
        paidAmount: d.paidAmount || 0,
        dueAmount: rem,
        status:
          d.status ||
          (rem <= 0 ? "Paid" : (d.paidAmount || 0) > 0 ? "Partial" : "Unpaid"),
      });
    });

    // Deduplicate any exact duplicate items by id
    const uniqueMap = new Map<string, CustomerTransactionItem>();
    items.forEach((it) => {
      uniqueMap.set(String(it.id), it);
    });

    // Sort descending by date & time
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const dateA = `${a.date || ""} ${a.time || ""}`;
      const dateB = `${b.date || ""} ${b.time || ""}`;
      return dateB.localeCompare(dateA);
    });
  }, [customer, customerSales, customerDues]);

  // Direct, accurate calculation from db.dues matching customer phone or name
  const dueMetrics = useMemo(() => {
    if (!customer)
      return {
        totalDue: 0,
        totalPaid: 0,
        pendingDue: 0,
        totalDiscount: 0,
        unpaidCount: 0,
        list: [] as Due[],
      };
    const custName = customer.name.trim().toLowerCase();
    const custPhone = customer.phone?.trim();

    const list = allDues
      .filter((d) => {
        const dPhone = d.phone?.trim();
        const dName = d.customerName?.trim().toLowerCase();
        if (custPhone && dPhone && custPhone === dPhone) return true;
        if (dName && dName === custName) return true;
        return false;
      })
      .sort((a, b) => {
        const dateA = `${a.date || ""} ${a.time || ""}`;
        const dateB = `${b.date || ""} ${b.time || ""}`;
        return dateB.localeCompare(dateA);
      });

    let totalDue = 0;
    let totalPaid = 0;
    let pendingDue = 0;
    let totalDiscount = 0;
    let unpaidCount = 0;

    list.forEach((d) => {
      totalDue += d.totalAmount || 0;
      totalPaid += d.paidAmount || 0;
      totalDiscount += d.discount || 0;
      const rem = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
      pendingDue += rem;
      if (rem > 0) unpaidCount += 1;
    });

    return {
      totalDue,
      totalPaid,
      pendingDue,
      totalDiscount,
      unpaidCount,
      list,
    };
  }, [customer, allDues]);

  // Chronological history of all partial and full payments made towards dues
  const duePaymentsList = useMemo(() => {
    if (!customer) return [];
    const custName = customer.name.trim().toLowerCase();
    const custPhone = customer.phone?.trim();

    // 1. Get from sales where category is Due Collection or serviceName contains Due Clear
    const paymentSales = allSales.filter((s) => {
      const matchCust =
        (s.customerPhone && custPhone && s.customerPhone === custPhone) ||
        (s.customerName && s.customerName.trim().toLowerCase() === custName);
      if (!matchCust) return false;
      const cat = (s.category || "").toLowerCase();
      const sName = (s.serviceName || "").toLowerCase();
      const note = (s.note || "").toLowerCase();
      return (
        cat === "due collection" ||
        sName.includes("due clear") ||
        sName.includes("due payment") ||
        note.includes("due cleared")
      );
    });

    // 2. Also inspect activityLogs for Due Clear entries
    const dueLogs = allActivityLogs.filter((l) => {
      if (l.module !== "Dues") return false;
      const metaCust = l.meta?.customerName
        ? String(l.meta.customerName).trim().toLowerCase()
        : "";
      const title = (l.title || "").toLowerCase();
      return (metaCust && metaCust === custName) || title.includes(custName);
    });

    interface PaymentHistoryItem {
      id: string;
      date: string;
      time?: string;
      paidAmount: number;
      discount: number;
      totalSettled: number;
      paymentMethod: string;
      serviceName: string;
      remainingDueAfter?: number;
      note?: string;
      dueId?: number;
    }

    const items: PaymentHistoryItem[] = [];
    const seenSignatures = new Set<string>();

    // 1. Direct structured paymentHistory stored on customer dues
    customerDues.forEach((d) => {
      if (d.paymentHistory && Array.isArray(d.paymentHistory)) {
        d.paymentHistory.forEach((p, idx) => {
          const sig = `${p.date}_${p.amount}_${p.discount || 0}_${p.paymentMethod}`;
          seenSignatures.add(sig);
          items.push({
            id: p.id || `due-pay-${d.id}-${idx}`,
            date: p.date,
            time: p.time,
            paidAmount: p.amount,
            discount: p.discount || 0,
            totalSettled: p.totalSettled || p.amount + (p.discount || 0),
            paymentMethod: p.paymentMethod || "Cash",
            serviceName: d.serviceName
              ? `Due: ${d.serviceName}`
              : "Customer Due",
            remainingDueAfter: p.remainingDueAfter,
            note: p.note,
            dueId: d.id,
          });
        });
      }
    });

    // 2. Fallback: historical sales where category is Due Collection or serviceName contains Due Clear
    paymentSales.forEach((s) => {
      const disc = s.discount || 0;
      const paid = s.amount || s.paidAmount || 0;
      const sig = `${s.date}_${paid}_${disc}_${s.paymentMethod}`;
      if (!seenSignatures.has(sig) && (paid > 0 || disc > 0)) {
        seenSignatures.add(sig);
        items.push({
          id: `sale-pay-${s.id}`,
          date: s.date,
          time: s.time,
          paidAmount: paid,
          discount: disc,
          totalSettled: paid + disc,
          paymentMethod: s.paymentMethod || "Cash",
          serviceName: s.serviceName || "Due Collection",
          note: s.note,
        });
      }
    });

    // 3. Activity logs for Due Clear entries
    dueLogs.forEach((l) => {
      const paid = l.meta?.amount || 0;
      const disc = l.meta?.discount || 0;
      const method = l.meta?.paymentMethod || "Cash";
      const logDate =
        l.date ||
        (l.timestamp ? format(new Date(l.timestamp), "yyyy-MM-dd") : "");
      const logTime =
        l.time ||
        (l.timestamp ? format(new Date(l.timestamp), "hh:mm:ss a") : "");
      const sig = `${logDate}_${paid}_${disc}_${method}`;

      if (!seenSignatures.has(sig) && (paid > 0 || disc > 0)) {
        seenSignatures.add(sig);
        items.push({
          id: `log-pay-${l.id}`,
          date: logDate,
          time: logTime,
          paidAmount: paid,
          discount: disc,
          totalSettled: paid + disc,
          paymentMethod: method,
          serviceName: l.title || "Due Cleared",
          note: l.details,
        });
      }
    });

    return items.sort((a, b) => {
      const dateA = `${a.date || ""} ${a.time || ""}`;
      const dateB = `${b.date || ""} ${b.time || ""}`;
      return dateB.localeCompare(dateA);
    });
  }, [customer, allSales, allActivityLogs]);

  // Derived financial metrics from deduplicated list
  const metrics = useMemo(() => {
    let totalPurchases = 0;
    let totalPaid = 0;

    unifiedTransactions.forEach((t) => {
      totalPurchases += t.amount;
      totalPaid += t.paidAmount;
    });

    // Current due strictly mirrors dueMetrics.pendingDue
    const currentDue = dueMetrics.pendingDue;

    return {
      totalPurchases,
      totalPaid,
      currentDue,
      salesCount: unifiedTransactions.filter((t) => t.type === "sale").length,
      duesCount: dueMetrics.unpaidCount,
    };
  }, [unifiedTransactions, dueMetrics]);

  // Customer Borrowings calculation
  const customerBorrowings = useMemo(() => {
    if (!customer) return [];
    const custName = customer.name.trim().toLowerCase();
    const custPhone = customer.phone?.trim();

    return allBorrowings
      .filter((b) => {
        if (b.customerId && customer.id && b.customerId === customer.id)
          return true;
        if (custPhone && b.phone && b.phone.trim() === custPhone) return true;
        if (b.lenderName && b.lenderName.trim().toLowerCase() === custName)
          return true;
        return false;
      })
      .sort((a, b) => {
        const dateA = `${a.date || ""} ${a.time || ""}`;
        const dateB = `${b.date || ""} ${b.time || ""}`;
        return dateB.localeCompare(dateA);
      });
  }, [customer, allBorrowings]);

  const totalCustomerBorrowed = useMemo(() => {
    return customerBorrowings.reduce((sum, b) => sum + (b.amount || 0), 0);
  }, [customerBorrowings]);

  const totalCustomerRepaid = useMemo(() => {
    return customerBorrowings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
  }, [customerBorrowings]);

  const activeCustomerLoanBalance = Math.max(
    0,
    totalCustomerBorrowed - totalCustomerRepaid,
  );

  // Filtered lists by active tab and search query
  const displayedTransactions = useMemo(() => {
    let list = unifiedTransactions;

    if (activeTab === "sales") {
      list = list.filter((t) => t.type === "sale");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.date.includes(q) ||
          (t.paymentMethod && t.paymentMethod.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [unifiedTransactions, activeTab, searchQuery]);

  const filteredDuesList = useMemo(() => {
    let list = dueMetrics.list;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          (d.serviceName && d.serviceName.toLowerCase().includes(q)) ||
          (d.category && d.category.toLowerCase().includes(q)) ||
          (d.date && d.date.includes(q)) ||
          (d.note && d.note.toLowerCase().includes(q)) ||
          (d.phone && d.phone.includes(q)),
      );
    }
    return list;
  }, [dueMetrics.list, searchQuery]);

  const filteredDuePayments = useMemo(() => {
    let list = duePaymentsList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.serviceName.toLowerCase().includes(q) ||
          p.date.includes(q) ||
          p.paymentMethod.toLowerCase().includes(q) ||
          (p.note && p.note.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [duePaymentsList, searchQuery]);

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
        periodLabel: "All Records",
      });
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (err) {
      console.error("PDF export error:", err);
      setErrorMsg("Could not generate PDF statement");
      setTimeout(() => setErrorMsg(""), 4000);
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
        periodLabel: "All Records",
      });
    } catch (err) {
      console.error("Print error:", err);
      window.print();
    }
  };

  // Handle Collect Due Submission
  const handleConfirmCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    setIsSubmittingCollection(true);
    try {
      const custName = customer.name.trim().toLowerCase();
      const custPhone = customer.phone?.trim();

      const unsettledDues = allDues.filter((d) => {
        const dPhone = d.phone?.trim();
        const dName = d.customerName?.trim().toLowerCase();
        const isMatch =
          (custPhone && dPhone && custPhone === dPhone) ||
          (dName && dName === custName);
        return isMatch && (d.totalAmount || 0) > (d.paidAmount || 0);
      });

      const totalPendingDue = unsettledDues.reduce(
        (sum, d) =>
          sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)),
        0,
      );

      let duesToProcess = unsettledDues;
      let effectivePendingDue = totalPendingDue;

      if (selectedDueForPayment && selectedDueForPayment.id) {
        const found = allDues.find((d) => d.id === selectedDueForPayment.id);
        if (found) {
          duesToProcess = [found];
          effectivePendingDue = Math.max(
            0,
            (found.totalAmount || 0) - (found.paidAmount || 0),
          );
        }
      }

      const rawCash = Math.max(0, parseFloat(collectAmount) || 0);
      const rawDiscount = Math.max(0, parseFloat(collectDiscount) || 0);

      // Logical Safeguards:
      // 1. Discount cannot exceed total outstanding due
      const discountAmount = Math.min(effectivePendingDue, rawDiscount);
      // 2. Cash received cannot exceed remaining due after discount
      const cashAmount = Math.min(
        Math.max(0, effectivePendingDue - discountAmount),
        rawCash,
      );
      // 3. Total settled is exactly cashAmount + discountAmount, capped at effectivePendingDue
      const totalSettled = Math.min(
        effectivePendingDue,
        cashAmount + discountAmount,
      );

      if (totalSettled <= 0) {
        setIsSubmittingCollection(false);
        setErrorMsg("Please enter a valid amount or discount");
        setTimeout(() => setErrorMsg(""), 4000);
        return;
      }

      duesToProcess.sort((a, b) => {
        if (a.date && b.date && a.date !== b.date)
          return a.date.localeCompare(b.date);
        return (a.id || 0) - (b.id || 0);
      });

      let remainingToSettle = totalSettled;
      let remainingCash = cashAmount;
      let remainingDiscount = discountAmount;
      let totalProfitEarned = 0;
      const nowIso = new Date().toISOString();
      const todayDate = format(new Date(), "yyyy-MM-dd");
      const todayTime = format(new Date(), "hh:mm:ss a");

      if (duesToProcess.length > 0) {
        for (const d of duesToProcess) {
          if (remainingToSettle <= 0) break;
          const currentTotal = d.totalAmount || 0;
          const currentPaid = d.paidAmount || 0;
          const currentRemaining = Math.max(0, currentTotal - currentPaid);
          if (currentRemaining <= 0) continue;

          const settleFromThis = Math.min(remainingToSettle, currentRemaining);
          const cashForThis = Math.min(settleFromThis, remainingCash);
          const discountForThis = Math.min(
            settleFromThis - cashForThis,
            remainingDiscount,
          );

          const newPaid = currentPaid + settleFromThis;
          const newStatus = newPaid >= currentTotal ? "Paid" : "Partial";
          const newDueDiscount = (d.discount || 0) + discountForThis;

          const paymentHistoryEntry = {
            id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            date: todayDate,
            time: todayTime,
            amount: cashForThis,
            discount: discountForThis,
            totalSettled: settleFromThis,
            paymentMethod: collectMethod,
            remainingDueAfter: Math.max(0, currentTotal - newPaid),
            note: collectNote.trim() || undefined,
            createdAt: nowIso,
          };

          const updatedHistory = Array.isArray(d.paymentHistory)
            ? [...d.paymentHistory, paymentHistoryEntry]
            : [paymentHistoryEntry];

          await db.dues.update(d.id!, {
            paidAmount: newPaid,
            discount: newDueDiscount,
            status: newStatus,
            paymentHistory: updatedHistory,
            updatedAt: nowIso,
          });

          const isMfsDue = d.referenceType === "mfs";

          if (!isMfsDue) {
            const totalDueAmt = currentTotal || settleFromThis;
            const ratio = totalDueAmt > 0 ? settleFromThis / totalDueAmt : 1;
            const costPart = Math.round((d.cost || 0) * ratio * 100) / 100;
            // Net profit after discount
            const profitPart = Math.max(
              0,
              Math.round((cashForThis - costPart) * 100) / 100,
            );

            totalProfitEarned += profitPart;

            if (cashForThis > 0 || discountForThis > 0) {
              // Record the collected sale & profit
              await db.sales.add({
                date: todayDate,
                time: todayTime,
                createdAt: nowIso,
                updatedAt: nowIso,
                category: d.category || "Due Collection",
                serviceName: d.serviceName
                  ? `Due Clear: ${d.serviceName}`
                  : `Due Cleared (${customer.name})`,
                amount: cashForThis,
                cost: costPart,
                profit: profitPart,
                discount: discountForThis > 0 ? discountForThis : undefined,
                paymentMethod: collectMethod,
                note: `Due cleared (${newStatus}): Tk ${cashForThis.toLocaleString()} paid${discountForThis > 0 ? ` [Tk ${discountForThis.toLocaleString()} Discount]` : ""} of Tk ${currentTotal.toLocaleString()} for ${d.serviceName || "Service"}${collectNote.trim() ? ` - ${collectNote.trim()}` : ""}`,
                customerName: customer.name,
                customerPhone: customer.phone,
                paidAmount: cashForThis,
                dueAmount: 0,
                quantity: 1,
              });
            }
          } else {
            // MFS Due: account balance is increased, recognize proportional fee profit if any
            const totalDueAmt = currentTotal || settleFromThis;
            const ratio = totalDueAmt > 0 ? settleFromThis / totalDueAmt : 1;
            const mfsProfitPart = d.profit
              ? Math.round(d.profit * ratio * 100) / 100
              : 0;
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
          category: "Due Collection",
          serviceName: `Due Payment (${customer.name})`,
          amount: remainingCash,
          cost: 0,
          profit: remainingCash,
          paymentMethod: collectMethod,
          note: `Due credit collected: Tk ${remainingCash.toLocaleString()}${collectNote.trim() ? ` - ${collectNote.trim()}` : ""}`,
          customerName: customer.name,
          customerPhone: customer.phone,
          paidAmount: remainingCash,
          dueAmount: 0,
          quantity: 1,
        });
      }

      const discountMsg =
        discountAmount > 0
          ? ` (Tk ${discountAmount.toLocaleString()} discount)`
          : "";
      setSuccessMsg(
        `Cleared Tk ${totalSettled.toLocaleString()} due${discountMsg} (${collectMethod}) for ${customer.name}.`,
      );

      // Update account balance only with actual cash received
      if (cashAmount > 0) {
        try {
          const targetAccountId =
            mapPaymentMethodToAccountId(collectMethod) || "cash";
          await adjustAccountBalance(targetAccountId, cashAmount);
        } catch (err) {
          console.error(
            "Failed to update account balance in CustomerProfile:",
            err,
          );
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
          discountAmount,
        );
      } catch (logErr) {
        console.warn("Failed to log due collection activity:", logErr);
      }

      setIsCollectModalOpen(false);
      setSelectedDueForPayment(null);
      setCollectAmount("");
      setCollectDiscount("");
      setCollectNote("");
      setTimeout(() => setSuccessMsg(""), 4500);
    } catch (err) {
      console.error("Error recording payment:", err);
      setErrorMsg("Failed to record collection");
      setTimeout(() => setErrorMsg(""), 4000);
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
      setErrorMsg("Please enter a valid loan amount");
      setTimeout(() => setErrorMsg(""), 4000);
      return;
    }

    setIsSubmittingBorrow(true);
    try {
      const now = new Date();
      const entryDate = borrowDate || format(now, "yyyy-MM-dd");
      const newId = await db.borrowings.add({
        date: entryDate,
        time: format(now, "hh:mm:ss a"),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        customerId: customer.id,
        lenderName: customer.name.trim(),
        phone: customer.phone ? customer.phone.trim() : undefined,
        amount: parsedAmount,
        paidAmount: 0,
        dueDate: borrowDueDate,
        status: "Unpaid",
        note: borrowNote.trim() || undefined,
        receiveAccount: borrowAccount !== "none" ? borrowAccount : undefined,
      });

      if (borrowAccount !== "none" && parsedAmount > 0) {
        await adjustAccountBalance(borrowAccount, parsedAmount);
      }

      await recordActivityLog({
        action: "CREATE",
        module: "Borrowings",
        title: `Borrowing Tk ${parsedAmount.toLocaleString()} from ${customer.name}`,
        details: `Recorded from Customer Profile. Received in ${borrowAccount} (Due: ${borrowDueDate || "N/A"}, Date: ${entryDate})`,
        meta: {
          borrowingId: newId,
          customerId: customer.id,
          lenderName: customer.name,
          amount: parsedAmount,
          receiveAccount: borrowAccount,
        },
      });

      setIsBorrowModalOpen(false);
      setBorrowAmount("");
      const today = format(new Date(), "yyyy-MM-dd");
      setBorrowDate(today);
      setBorrowDurationDays("30");
      setBorrowDueDate(format(addDays(new Date(), 30), "yyyy-MM-dd"));
      setBorrowNote("");
      setSuccessMsg(
        `Recorded borrowing of Tk ${parsedAmount.toLocaleString()} from ${customer.name} successfully.`,
      );
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error creating borrowing:", err);
      setErrorMsg("Failed to record borrowing");
      setTimeout(() => setErrorMsg(""), 4000);
    } finally {
      setIsSubmittingBorrow(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = () => {
    if (!customer) return;
    setEditName(customer.name);
    setEditPhone(customer.phone || "");
    setEditAddress(customer.address || "");
    setEditNotes(customer.notes || "");
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
      setSuccessMsg("Customer profile updated.");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      console.error("Error updating customer:", err);
      setErrorMsg("Could not update profile");
      setTimeout(() => setErrorMsg(""), 4000);
    }
  };

  // Clean phone for WhatsApp
  const cleanPhone = customer?.phone
    ? customer.phone.replace(/[^0-9]/g, "")
    : "";
  const hasDue = metrics.currentDue > 0;

  if (!customer && customerId) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center py-20">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Customer Not Found
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          The customer record could not be found.
        </p>
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
            onClick={() => navigate("/customers")}
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
              setBorrowAmount("");
              setBorrowDate(format(new Date(), "yyyy-MM-dd"));
              setBorrowDueDate("");
              setBorrowNote("");
              setBorrowAccount("cash");
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
              onClick={openCollectForAllDues}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <DollarSign size={14} strokeWidth={2.5} />
              <span>Collect Due</span>
            </button>
          )}

          <Link
            to={`/sales?customer=${encodeURIComponent(customer.name)}&phone=${encodeURIComponent(customer.phone || "")}`}
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
        <p className="text-xs text-gray-600 font-medium">
          Customer Statement & Ledger
        </p>
        <div className="flex justify-between items-end mt-3 text-left text-xs">
          <div>
            <p className="font-bold text-gray-900">{customer.name}</p>
            <p className="text-gray-600">Phone: {customer.phone || "N/A"}</p>
            {customer.address && (
              <p className="text-gray-600">Address: {customer.address}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-900">#CUS-{customer.id}</p>
            <p className="text-gray-500">
              {format(new Date(), "dd/MM/yyyy, hh:mm a")}
            </p>
          </div>
        </div>
      </div>

      {/* MINIMAL CUSTOMER PROFILE CARD */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4 print:border-none print:shadow-none print:p-0">
        {/* Customer Header & Contacts */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                {customer.name}
              </h2>
              {hasDue ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                  Tk {metrics.currentDue.toLocaleString()} Due
                </span>
              ) : (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  No Due
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5 flex-wrap">
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
                <span className="text-gray-400 text-[11px]">
                  Member since {format(new Date(customer.createdAt), "dd MMM yyyy")}
                </span>
              )}
            </div>
          </div>

          {/* Quick Communication */}
          {customer.phone && (
            <div className="flex items-center gap-2 print:hidden">
              <a
                href={`tel:${customer.phone}`}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5 text-xs font-bold"
              >
                <PhoneCall size={13} />
                <span>Call</span>
              </a>
              {cleanPhone && (
                <a
                  href={`https://wa.me/88${cleanPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#075e4f] border border-emerald-200 transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                  <MessageSquare size={13} />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Single Unified Clean Metrics Grid */}
        <div
          className={`grid grid-cols-2 ${customerBorrowings.length > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-3`}
        >
          <div
            className={`p-3.5 rounded-xl border ${hasDue ? "bg-rose-50/60 border-rose-200" : "bg-[#f7f8fa] border-[#d8e0e8]"}`}
          >
            <span
              className={`text-[11px] font-[750] uppercase tracking-wider block ${hasDue ? "text-rose-700" : "text-[#4b5870]"}`}
            >
              Current Due
            </span>
            <div
              className={`text-xl font-black mt-1 font-mono ${hasDue ? "text-rose-600" : "text-[#202b3d]"}`}
            >
              Tk {metrics.currentDue.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 bg-[#f7f8fa] rounded-xl border border-[#d8e0e8]">
            <span className="text-[11px] font-[750] text-[#4b5870] uppercase tracking-wider block">
              Total Purchases
            </span>
            <div className="text-xl font-black text-[#202b3d] mt-1 font-mono">
              Tk {metrics.totalPurchases.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 bg-[#f7f8fa] rounded-xl border border-[#d8e0e8]">
            <span className="text-[11px] font-[750] text-emerald-800 uppercase tracking-wider block">
              Total Paid
            </span>
            <div className="text-xl font-black text-emerald-700 mt-1 font-mono">
              Tk {metrics.totalPaid.toLocaleString()}
            </div>
          </div>

          {customerBorrowings.length > 0 && (
            <div
              className={`p-3.5 rounded-xl border ${activeCustomerLoanBalance > 0 ? "bg-amber-50/60 border-amber-200" : "bg-[#f7f8fa] border-[#d8e0e8]"}`}
            >
              <span
                className={`text-[11px] font-[750] uppercase tracking-wider block ${activeCustomerLoanBalance > 0 ? "text-amber-800" : "text-[#4b5870]"}`}
              >
                Active Loan
              </span>
              <div
                className={`text-xl font-black mt-1 font-mono ${activeCustomerLoanBalance > 0 ? "text-amber-700" : "text-[#202b3d]"}`}
              >
                Tk {activeCustomerLoanBalance.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Customer Note if present */}
        {customer.notes && (
          <div className="p-3 bg-[#f7f8fa] rounded-xl text-xs text-gray-700 border border-[#d8e0e8] flex items-start gap-2">
            <span className="font-bold text-gray-900 shrink-0">Note:</span>
            <span>{customer.notes}</span>
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
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All ({unifiedTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dues")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "dues"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Dues ({dueMetrics.list.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("payments")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "payments"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Payments ({duePaymentsList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sales")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "sales"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Sales ({metrics.salesCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("loans")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "loans"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Loans ({customerBorrowings.length})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-60">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={14}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items, date..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-[#084b3e] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {activeTab === "loans" ? (
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
                    <th className="py-3 px-4 text-center print:hidden">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customerBorrowings.map((b) => {
                    const dueAmt = Math.max(
                      0,
                      (b.amount || 0) - (b.paidAmount || 0),
                    );
                    return (
                      <tr
                        key={b.id}
                        className="hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-600 font-bold">
                          {formatDateStr(b.date)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-900">
                            {b.lenderName}
                          </div>
                          {b.phone && (
                            <div className="text-[10px] text-gray-400 font-mono">
                              {b.phone}
                            </div>
                          )}
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
                            <span className="text-emerald-600 font-bold">
                              Tk 0
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {b.dueDate ? formatDateStr(b.dueDate) : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.status === "Paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : b.status === "Partial"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500 max-w-xs truncate text-[11px]">
                          {b.note || "—"}
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
                    <td
                      colSpan={2}
                      className="py-3 px-4 uppercase text-[11px] text-gray-500"
                    >
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
              <h4 className="font-bold text-gray-900 text-sm mb-1">
                No Loans Recorded
              </h4>
              <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
                No borrowing or loan records from {customer.name} have been
                created yet.
              </p>
              <button
                type="button"
                onClick={() => {
                  setBorrowAmount("");
                  setBorrowDate(format(new Date(), "yyyy-MM-dd"));
                  setBorrowDueDate("");
                  setBorrowNote("");
                  setBorrowAccount("cash");
                  setIsBorrowModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <Plus size={14} />
                <span>Record Loan from {customer.name}</span>
              </button>
            </div>
          )
        ) : activeTab === "dues" ? (
          filteredDuesList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Service / Description</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Due</th>
                    <th className="py-3 px-4 text-center">Discount</th>
                    <th className="py-3 px-4 text-center">
                      Status
                    </th>
                    <th className="py-3 px-4 text-center print:hidden">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDuesList.map((d) => {
                    const total = d.totalAmount || 0;
                    const paid = d.paidAmount || 0;
                    const discount = d.discount || 0;
                    const remaining = Math.max(0, total - paid);
                    const isFullyPaid = remaining <= 0;
                    const isExpanded = expandedDueHistoryId === d.id;
                    const paymentsCount =
                      (d.paymentHistory && d.paymentHistory.length) || 0;

                    return (
                      <React.Fragment key={d.id}>
                        <tr
                          className={`hover:bg-gray-50/70 transition-colors ${remaining > 0 ? "bg-rose-50/20" : ""}`}
                        >
                          <td className="py-3 px-4 text-gray-600">
                            <span className="font-bold text-gray-900">
                              {d.date ? formatDateStr(d.date) : "—"}
                            </span>
                            {d.time && (
                              <span className="text-[10px] text-gray-400 ml-1.5 font-mono">
                                {d.time}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-900 flex items-center gap-1.5">
                              <span>{d.serviceName || "Customer Due"}</span>
                              {d.referenceType === "mfs" && (
                                <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded">
                                  MFS
                                </span>
                              )}
                            </div>
                            {d.category && (
                              <span className="text-[10px] text-gray-400 block">
                                {d.category}
                              </span>
                            )}
                            {d.note && (
                              <span className="text-[11px] text-gray-500 italic block mt-0.5">
                                {d.note}
                              </span>
                            )}
                            {/* Visual Progress Bar */}
                            <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden flex">
                              <div
                                className="bg-emerald-500 h-full"
                                style={{
                                  width: `${Math.min(100, (paid / (total || 1)) * 100)}%`,
                                }}
                              />
                              <div
                                className="bg-amber-400 h-full"
                                style={{
                                  width: `${Math.min(100, (discount / (total || 1)) * 100)}%`,
                                }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-gray-900">
                            Tk {total.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">
                            Tk {paid.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold">
                            {remaining > 0 ? (
                              <span className="text-rose-600 font-black">
                                Tk {remaining.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold">
                                Tk 0 (Paid)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {discount > 0 ? (
                              <span className="text-amber-700 font-bold font-mono">
                                Tk {discount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-300 font-normal">
                                —
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isFullyPaid
                                  ? "bg-emerald-100 text-emerald-800"
                                  : d.status === "Partial" || paid > 0
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {isFullyPaid
                                ? "Paid"
                                : d.status === "Partial" || paid > 0
                                  ? "Partial"
                                  : "Unpaid"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center print:hidden">
                            <div className="flex items-center justify-center gap-1.5">
                              {remaining > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openCollectForSpecificDue(d)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
                                >
                                  Pay
                                </button>
                              )}
                              {paymentsCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedDueHistoryId(
                                      isExpanded ? null : d.id || null,
                                    )
                                  }
                                  className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="View installment details"
                                >
                                  <span>Installments ({paymentsCount})</span>
                                  {isExpanded ? (
                                    <ChevronUp size={12} />
                                  ) : (
                                    <ChevronDown size={12} />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Installment Details */}
                        {isExpanded &&
                          d.paymentHistory &&
                          d.paymentHistory.length > 0 && (
                            <tr className="bg-emerald-50/20 border-b border-gray-100">
                              <td colSpan={8} className="p-3 pl-6 sm:pl-8">
                                <div className="bg-white rounded-xl border border-emerald-100 p-3 shadow-xs">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-2">
                                    <History size={14} />
                                    <span>
                                      Installment Breakdown ({d.serviceName || "Due Record"})
                                    </span>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[11px]">
                                      <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                                        <tr>
                                          <th className="py-1.5 px-3">
                                            #
                                          </th>
                                          <th className="py-1.5 px-3">
                                            Date & Time
                                          </th>
                                          <th className="py-1.5 px-3 text-right">
                                            Paid Amount
                                          </th>
                                          <th className="py-1.5 px-3 text-right">
                                            Discount
                                          </th>
                                          <th className="py-1.5 px-3 text-right">
                                            Total Settled
                                          </th>
                                          <th className="py-1.5 px-3">
                                            Method
                                          </th>
                                          <th className="py-1.5 px-3 text-right">
                                            Remaining Due
                                          </th>
                                          <th className="py-1.5 px-3">
                                            Note
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {d.paymentHistory.map((ph, pIdx) => (
                                          <tr
                                            key={ph.id || pIdx}
                                            className="hover:bg-gray-50/50"
                                          >
                                            <td className="py-1.5 px-3 font-bold text-gray-600">
                                              #{pIdx + 1}
                                            </td>
                                            <td className="py-1.5 px-3 text-gray-700">
                                              {formatDateStr(ph.date)}{" "}
                                              {ph.time && (
                                                <span className="text-gray-400 font-mono">
                                                  ({ph.time})
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-black text-emerald-700 font-mono">
                                              Tk {ph.amount.toLocaleString()}
                                            </td>
                                            <td className="py-1.5 px-3 text-right text-amber-700 font-mono">
                                              {ph.discount && ph.discount > 0
                                                ? `Tk ${ph.discount.toLocaleString()}`
                                                : "—"}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-bold text-gray-800 font-mono">
                                              Tk{" "}
                                              {(
                                                ph.totalSettled ||
                                                ph.amount + (ph.discount || 0)
                                              ).toLocaleString()}
                                            </td>
                                            <td className="py-1.5 px-3">
                                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                                                {ph.paymentMethod || "Cash"}
                                              </span>
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-mono font-bold">
                                              {ph.remainingDueAfter !==
                                              undefined ? (
                                                ph.remainingDueAfter > 0 ? (
                                                  <span className="text-rose-600">
                                                    Tk{" "}
                                                    {ph.remainingDueAfter.toLocaleString()}
                                                  </span>
                                                ) : (
                                                  <span className="text-emerald-600">
                                                    Tk 0 (Paid)
                                                  </span>
                                                )
                                              ) : (
                                                "—"
                                              )}
                                            </td>
                                            <td className="py-1.5 px-3 text-gray-500 italic max-w-xs truncate">
                                              {ph.note || "—"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/80 font-bold text-gray-900 border-t border-gray-200">
                    <td
                      colSpan={2}
                      className="py-3 px-4 uppercase text-[11px] text-gray-500"
                    >
                      Total ({filteredDuesList.length} Due Bills)
                    </td>
                    <td className="py-3 px-4 text-right font-black">
                      Tk{" "}
                      {filteredDuesList
                        .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700">
                      Tk{" "}
                      {filteredDuesList
                        .reduce((acc, curr) => acc + (curr.paidAmount || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-600">
                      Tk{" "}
                      {filteredDuesList
                        .reduce(
                          (acc, curr) =>
                            acc +
                            Math.max(
                              0,
                              (curr.totalAmount || 0) - (curr.paidAmount || 0),
                            ),
                          0,
                        )
                        .toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-amber-700">
                      Tk{" "}
                      {filteredDuesList
                        .reduce((acc, curr) => acc + (curr.discount || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-bold text-gray-900 text-sm mb-1">
                No Dues Found
              </h4>
              <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
                No unpaid dues or bill records found for this customer.
              </p>
            </div>
          )
        ) : activeTab === "payments" ? (
          filteredDuePayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Service / Source</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">
                      Paid Amount
                    </th>
                    <th className="py-3 px-4 text-right">Discount</th>
                    <th className="py-3 px-4 text-right">
                      Total Settled
                    </th>
                    <th className="py-3 px-4 text-right">Remaining Due</th>
                    <th className="py-3 px-4">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDuePayments.map((p, pIdx) => (
                    <tr
                      key={p.id || pIdx}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-600">
                        <span className="font-bold text-gray-900">
                          {formatDateStr(p.date)}
                        </span>
                        {p.time && (
                          <span className="text-[10px] text-gray-400 ml-1.5 font-mono">
                            {p.time}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">
                          {p.serviceName}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                          {p.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700 font-mono">
                        Tk {p.paidAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-700 font-mono">
                        {p.discount > 0
                          ? `Tk ${p.discount.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-800 font-mono">
                        Tk {p.totalSettled.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {p.remainingDueAfter !== undefined ? (
                          p.remainingDueAfter > 0 ? (
                            <span className="text-rose-600">
                              Tk {p.remainingDueAfter.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold">
                              Tk 0
                            </span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 max-w-xs truncate text-[11px]">
                        {p.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/80 font-bold text-gray-900 border-t border-gray-200">
                    <td
                      colSpan={3}
                      className="py-3 px-4 uppercase text-[11px] text-gray-500"
                    >
                      Total Paid ({filteredDuePayments.length} Installments)
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700">
                      Tk{" "}
                      {filteredDuePayments
                        .reduce((acc, curr) => acc + curr.paidAmount, 0)
                        .toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-amber-700">
                      Tk{" "}
                      {filteredDuePayments
                        .reduce((acc, curr) => acc + curr.discount, 0)
                        .toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-gray-900">
                      Tk{" "}
                      {filteredDuePayments
                        .reduce((acc, curr) => acc + curr.totalSettled, 0)
                        .toLocaleString()}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400">
                <History size={24} />
              </div>
              <h4 className="font-bold text-gray-900 text-sm mb-1">
                No Payment Records Found
              </h4>
              <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
                No installment or due payment history recorded for this customer yet.
              </p>
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
                {displayedTransactions.map((t) => {
                  const hasRowDue = t.dueAmount > 0;
                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-gray-50/60 transition-colors ${hasRowDue ? "bg-amber-50/20" : ""}`}
                    >
                      {/* Date */}
                      <td className="py-3 px-4 text-gray-600">
                        <span className="font-bold text-gray-900">
                          {formatDateStr(t.date)}
                        </span>
                        {t.time && (
                          <span className="text-[10px] text-gray-400 ml-1.5 font-mono">
                            {t.time}
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{t.title}</div>
                        {t.category && (
                          <span className="text-[10px] text-gray-400">
                            {t.category}
                          </span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                          {t.paymentMethod || "Cash"}
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
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === "Paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.status === "Partial"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                          }`}
                        >
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
                  <td
                    colSpan={3}
                    className="py-3 px-4 uppercase text-[11px] text-gray-500"
                  >
                    Total ({displayedTransactions.length} records)
                  </td>
                  <td className="py-3 px-4 text-right font-black">
                    Tk{" "}
                    {displayedTransactions
                      .reduce((acc, curr) => acc + curr.amount, 0)
                      .toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-emerald-700">
                    Tk{" "}
                    {displayedTransactions
                      .reduce((acc, curr) => acc + curr.paidAmount, 0)
                      .toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-rose-600">
                    Tk{" "}
                    {displayedTransactions
                      .reduce((acc, curr) => acc + curr.dueAmount, 0)
                      .toLocaleString()}
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
      {/* COLLECT DUE MODAL */}
      <Modal
        isOpen={isCollectModalOpen}
        onClose={() => {
          setIsCollectModalOpen(false);
          setSelectedDueForPayment(null);
        }}
        title="Collect Due"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmCollect} className="space-y-4">
          {/* If a specific due is selected or multiple dues exist */}
          {selectedDueForPayment ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-[12px] text-xs">
              <div>
                <span className="text-gray-800 font-bold block">
                  {selectedDueForPayment.serviceName || "Due Record"}
                </span>
                <span className="text-[11px] text-gray-500">
                  {selectedDueForPayment.date ? formatDateStr(selectedDueForPayment.date) : "—"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDueForPayment(null);
                  setCollectAmount(dueMetrics.pendingDue.toString());
                  setCollectDiscount("");
                }}
                className="text-[11px] text-blue-700 hover:underline font-bold px-2 py-1 rounded-[8px] bg-white border border-blue-200 cursor-pointer"
              >
                All Dues
              </button>
            </div>
          ) : (
            dueMetrics.list.filter(
              (d) => (d.totalAmount || 0) - (d.paidAmount || 0) > 0,
            ).length > 1 && (
              <div>
                <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
                  Specific Bill (Optional)
                </label>
                <select
                  value={selectedDueForPayment?.id || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setSelectedDueForPayment(null);
                      setCollectAmount(dueMetrics.pendingDue.toString());
                      setCollectDiscount("");
                    } else {
                      const target = dueMetrics.list.find(
                        (d) => d.id === parseInt(val, 10),
                      );
                      if (target) {
                        openCollectForSpecificDue(target);
                      }
                    }
                  }}
                  className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[14px] font-medium text-[#202b3d] outline-none cursor-pointer focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all"
                >
                  <option value="">Apply across all pending dues</option>
                  {dueMetrics.list
                    .filter(
                      (d) => (d.totalAmount || 0) - (d.paidAmount || 0) > 0,
                    )
                    .map((d) => {
                      const rem = Math.max(
                        0,
                        (d.totalAmount || 0) - (d.paidAmount || 0),
                      );
                      return (
                        <option key={d.id} value={d.id}>
                          {d.serviceName || "Due Record"} (Due: Tk {rem.toLocaleString()})
                        </option>
                      );
                    })}
                </select>
              </div>
            )
          )}

          {/* Outstanding Due Highlight */}
          {(() => {
            const targetPending = selectedDueForPayment
              ? Math.max(
                  0,
                  (selectedDueForPayment.totalAmount || 0) -
                    (selectedDueForPayment.paidAmount || 0),
                )
              : dueMetrics.pendingDue;

            const rawCash = parseFloat(collectAmount) || 0;
            const rawDiscount = parseFloat(collectDiscount) || 0;
            const validDiscount = Math.min(
              targetPending,
              Math.max(0, rawDiscount),
            );
            const maxCashAllowed = Math.max(
              0,
              targetPending - validDiscount,
            );
            const validCash = Math.min(
              maxCashAllowed,
              Math.max(0, rawCash),
            );
            const totalSettled = validCash + validDiscount;
            const remainingDue = Math.max(0, targetPending - totalSettled);

            const handleDiscountChange = (valStr: string) => {
              setCollectDiscount(valStr);
              const dVal = parseFloat(valStr) || 0;
              const clamped = Math.min(targetPending, Math.max(0, dVal));
              const autoCash = Math.max(0, targetPending - clamped);
              setCollectAmount(
                autoCash > 0
                  ? autoCash.toString()
                  : clamped >= targetPending
                    ? "0"
                    : "",
              );
            };

            const handleCashChange = (valStr: string) => {
              setCollectAmount(valStr);
            };

            return (
              <>
                {/* Minimal 3-card Summary */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-[#f7f8fa] rounded-[12px] text-center border border-[#d8e0e8]">
                  <div>
                    <span className="text-[11px] font-[750] text-[#4b5870] uppercase tracking-[0.03em] block">
                      Total Due
                    </span>
                    <span className="text-sm font-black text-[#202b3d] font-mono">
                      Tk {targetPending.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-[750] text-[#075e4f] uppercase tracking-[0.03em] block">
                      Collecting
                    </span>
                    <span className="text-sm font-black text-[#075e4f] font-mono">
                      Tk {validCash.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-[750] text-[#4b5870] uppercase tracking-[0.03em] block">
                      Remaining
                    </span>
                    <span
                      className={`text-sm font-black font-mono ${remainingDue > 0 ? "text-rose-600" : "text-emerald-600"}`}
                    >
                      Tk {remainingDue.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Discount Field */}
                  <div>
                    <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
                      Discount (Tk)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={targetPending}
                      step="any"
                      value={collectDiscount}
                      onChange={(e) => handleDiscountChange(e.target.value)}
                      placeholder="0"
                      className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[14px] font-bold text-amber-950 outline-none focus:border-amber-500 focus:bg-white focus:ring-[3px] focus:ring-amber-500/10 transition-all font-mono"
                    />
                  </div>

                  {/* Cash Received Field */}
                  <div>
                    <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
                      Collected (Tk) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={maxCashAllowed}
                      step="any"
                      value={collectAmount}
                      onChange={(e) => handleCashChange(e.target.value)}
                      placeholder="0"
                      className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[14px] font-bold text-[#202b3d] outline-none focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all font-mono"
                      autoFocus
                    />
                  </div>
                </div>
              </>
            );
          })()}

          {/* Method */}
          <div>
            <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["Cash", "bKash", "Nagad", "Rocket"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCollectMethod(m)}
                  className={`h-[40px] text-center rounded-[10px] text-xs font-[750] border transition-all cursor-pointer ${
                    collectMethod === m
                      ? "bg-[#075e4f] text-white border-[#075e4f] shadow-xs"
                      : "bg-[#f7f8fa] text-[#4b5870] border-[#d8e0e8] hover:bg-gray-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
              Note (Optional)
            </label>
            <input
              type="text"
              value={collectNote}
              onChange={(e) => setCollectNote(e.target.value)}
              placeholder="e.g. Partial payment"
              className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[13px] font-medium text-[#202b3d] placeholder:text-[#8b95a3] outline-none focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                isSubmittingCollection ||
                (parseFloat(collectAmount) || 0) +
                  (parseFloat(collectDiscount) || 0) <=
                  0
              }
              className="w-full h-[49px] min-h-[49px] bg-[#075e4f] hover:bg-[#064c40] text-white font-[750] text-[14px] rounded-[12px] shadow-[0_2px_3px_rgba(0,0,0,0.12)] transition-all cursor-pointer active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmittingCollection ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              <span>Confirm Payment</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT CUSTOMER MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer Profile"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
              Customer Name *
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[14px] font-medium text-[#202b3d] outline-none focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
              Phone Number
            </label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[14px] font-medium text-[#202b3d] outline-none focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all font-mono"
              placeholder="01XXXXXXXXX"
            />
          </div>

          <div>
            <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
              Address
            </label>
            <input
              type="text"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[14px] font-medium text-[#202b3d] outline-none focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all"
            />
          </div>

          <div>
            <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
              Notes
            </label>
            <input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[14px] font-medium text-[#202b3d] outline-none focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-[49px] min-h-[49px] bg-[#075e4f] hover:bg-[#064c40] text-white font-[750] text-[14px] rounded-[12px] shadow-[0_2px_3px_rgba(0,0,0,0.12)] transition-all cursor-pointer active:translate-y-px flex items-center justify-center gap-2"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Borrowing / Loan Modal */}
      <Modal
        isOpen={isBorrowModalOpen}
        onClose={() => setIsBorrowModalOpen(false)}
        title="Add New Borrowing"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmBorrow} className="space-y-4">
          <div>
            <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
              Lender Name
            </label>
            <input
              type="text"
              disabled
              value={customer.name}
              className="w-full h-[47px] min-h-[47px] px-[15px] bg-gray-100 border border-[#d8e0e8] rounded-[12px] font-bold text-gray-700 outline-none text-[14px]"
            />
          </div>

          <div>
            <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
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
              className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] font-bold outline-none text-[14px] text-[#202b3d] focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
                Borrow Date
              </label>
              <input
                type="date"
                required
                value={borrowDate}
                onChange={(e) => handleBorrowDateChange(e.target.value)}
                className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[14px] font-medium outline-none text-[#202b3d] focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
                Due In (Days)
              </label>
              <input
                type="number"
                required
                min="1"
                value={borrowDurationDays}
                onChange={(e) => updateBorrowDurationDays(e.target.value)}
                className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] font-bold outline-none text-[14px] text-[#202b3d] focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all font-mono"
                placeholder="30"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
              Receive In Account
            </label>
            <select
              value={borrowAccount}
              onChange={(e) => setBorrowAccount(e.target.value)}
              className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[14px] font-medium outline-none text-[#202b3d] focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all cursor-pointer"
            >
              <option value="cash">Cash Drawer</option>
              {accounts
                .filter((a) => a.id !== "cash")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type.toUpperCase()})
                  </option>
                ))}
              <option value="none">Do not adjust account balance</option>
            </select>
          </div>

          <div>
            <label className="block mb-1.5 text-[12px] font-[750] text-[#4b5870] tracking-[0.04em] uppercase">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={borrowNote}
              onChange={(e) => setBorrowNote(e.target.value)}
              placeholder="Reason or notes..."
              className="w-full h-[47px] min-h-[47px] px-[15px] bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] text-[14px] font-medium outline-none text-[#202b3d] focus:border-[#075e4f] focus:bg-white focus:ring-[3px] focus:ring-[#075e4f]/10 transition-all"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={
                isSubmittingBorrow || !(parseFloat(borrowAmount) > 0)
              }
              className="w-full h-[49px] min-h-[49px] bg-[#075e4f] hover:bg-[#064c40] text-white font-[750] text-[14px] rounded-[12px] shadow-[0_2px_3px_rgba(0,0,0,0.12)] transition-all cursor-pointer active:translate-y-px disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmittingBorrow ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <span>Save Borrowing</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
