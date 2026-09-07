import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Sale, Expense, MfsTransaction } from '../db/db';

interface StatementPdfOptions {
  sales: Sale[];
  expenses: Expense[];
  mfs: MfsTransaction[];
  periodLabel: string;
  activeTab: 'all' | 'sales' | 'expenses' | 'mfs';
  mode: 'active' | 'full';
  totalSales: number;
  salesProfit: number;
  totalExpense: number;
  mfsProfit: number;
  netProfit: number;
}

export function generateStatementPdf(options: StatementPdfOptions) {
  const {
    sales,
    expenses,
    mfs,
    periodLabel,
    activeTab,
    mode,
    totalSales,
    salesProfit,
    totalExpense,
    mfsProfit,
    netProfit,
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const nowStr = format(new Date(), 'dd MMM yyyy, hh:mm a');

  // --- Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('AL-BARAKAH DIGITAL STUDIO & ONLINE SERVICE', pageWidth / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Professional Digital Photo Studio, Govt / Online Services & MFS', pageWidth / 2, 19, { align: 'center' });

  const titleText = mode === 'full' 
    ? 'FULL FINANCIAL STATEMENT & AUDIT LEDGER'
    : `${activeTab.toUpperCase()} STATEMENT & TRANSACTION REPORT`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(titleText, pageWidth / 2, 25, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${periodLabel}   |   Generated: ${nowStr}`, pageWidth / 2, 29.5, { align: 'center' });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 32, pageWidth - 14, 32);

  // --- Summary Metric Cards ---
  const cardY = 35;
  const cardHeight = 15;
  const gap = 3.5;
  const numCards = 3;
  const cardWidth = (pageWidth - 28 - (gap * (numCards - 1))) / numCards;

  // Total Sales Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL SALES', 17, cardY + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Tk ${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 17, cardY + 10);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 101, 52);
  doc.text(`Profit: Tk ${salesProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 17, cardY + 13.5);

  // Total Expenses Card
  const expX = 14 + cardWidth + gap;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(expX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL EXPENSES', expX + 3, cardY + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(185, 28, 28);
  doc.text(`Tk ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, expX + 3, cardY + 10);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Costs & bills recorded', expX + 3, cardY + 13.5);

  // Net Profit Card
  const profitX = expX + cardWidth + gap;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(profitX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(203, 213, 225);
  doc.text('NET PROFIT', profitX + 3, cardY + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`Tk ${netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, profitX + 3, cardY + 10);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`MFS Profit: Tk ${mfsProfit.toLocaleString('en-US')}`, profitX + 3, cardY + 13.5);

  let currentY = cardY + cardHeight + 6;

  // --- Table Generation Function Helpers ---
  const addSalesTable = (startY: number) => {
    if (mode === 'full') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('1. Sales Transactions', 14, startY - 1.5);
    }

    const salesRows = sales.map((s, index) => [
      (index + 1).toString(),
      `${s.date}${s.time ? ` ${s.time}` : ''}`,
      s.serviceName + (s.quantity && s.quantity != 1 && s.quantity !== '1' ? ` (${s.quantity})` : ''),
      s.customerName || '—',
      s.paymentMethod || 'Cash',
      `Tk ${s.amount.toLocaleString()}`,
      `Tk ${(s.cost || 0).toLocaleString()}`,
      `+Tk ${s.profit.toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['#', 'Date & Time', 'Service / Product', 'Customer', 'Payment', 'Amount', 'Cost', 'Profit']],
      body: salesRows.length > 0 ? salesRows : [['—', '—', 'No sales transactions in this period', '—', '—', '—', '—', '—']],
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 28 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 26 },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 20, halign: 'right', textColor: [22, 101, 52] },
      },
      margin: { left: 14, right: 14 },
    });

    return (doc as any).lastAutoTable.finalY;
  };

  const addExpensesTable = (startY: number) => {
    if (mode === 'full') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('2. Expenses & Operating Costs', 14, startY - 1.5);
    }

    const expenseRows = expenses.map((e, index) => [
      (index + 1).toString(),
      `${e.date}${e.time ? ` ${e.time}` : ''}`,
      e.title,
      e.category || 'General',
      e.note || '—',
      `Tk ${e.amount.toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['#', 'Date & Time', 'Title / Description', 'Category', 'Note', 'Amount']],
      body: expenseRows.length > 0 ? expenseRows : [['—', '—', 'No expense records in this period', '—', '—', '—']],
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 28 },
        4: { cellWidth: 35 },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] },
      },
      margin: { left: 14, right: 14 },
    });

    return (doc as any).lastAutoTable.finalY;
  };

  const addMfsTable = (startY: number) => {
    if (mode === 'full') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('3. MFS Banking Ledger', 14, startY - 1.5);
    }

    const mfsRows = mfs.map((m, index) => [
      (index + 1).toString(),
      `${m.date}${m.time ? ` ${m.time}` : ''}`,
      m.operator,
      m.type,
      `Tk ${m.amount.toLocaleString()}`,
      `+Tk ${m.profit.toLocaleString()}`,
      `Tk ${(m.balanceAfter || 0).toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['#', 'Date & Time', 'Operator', 'Type', 'Amount', 'Profit', 'Balance After']],
      body: mfsRows.length > 0 ? mfsRows : [['—', '—', 'No MFS records in this period', '—', '—', '—', '—']],
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 32 },
        2: { cellWidth: 24, fontStyle: 'bold' },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 25, halign: 'right', textColor: [22, 101, 52] },
        6: { cellWidth: 32, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    return (doc as any).lastAutoTable.finalY;
  };

  // --- Unified Audit Table (All in One Single Section with Indicator Column) ---
  const addUnifiedAuditTable = (startY: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('Unified Audit Ledger & Transaction Records', 14, startY - 1.5);

    interface UnifiedItem {
      date: string;
      time?: string;
      type: 'Sell' | 'Cost' | 'MFS';
      description: string;
      amount: number;
      cost: number;
      profit: number;
    }

    const unifiedList: UnifiedItem[] = [];

    // 1. Sales -> Sell
    sales.forEach(s => {
      let desc = s.serviceName;
      if (s.quantity && s.quantity != 1 && s.quantity !== '1') desc += ` (${s.quantity})`;
      if (s.customerName) desc += ` - ${s.customerName}`;
      desc += ` [${s.paymentMethod || 'Cash'}]`;
      if (s.note) desc += ` (${s.note})`;

      unifiedList.push({
        date: s.date,
        time: s.time,
        type: 'Sell',
        description: desc,
        amount: s.amount,
        cost: s.cost || 0,
        profit: s.profit,
      });
    });

    // 2. Expenses -> Cost
    expenses.forEach(e => {
      let desc = e.title;
      if (e.category) desc += ` [${e.category}]`;
      if (e.note) desc += ` (${e.note})`;

      unifiedList.push({
        date: e.date,
        time: e.time,
        type: 'Cost',
        description: desc,
        amount: e.amount,
        cost: e.amount,
        profit: -e.amount,
      });
    });

    // 3. MFS -> MFS
    mfs.forEach(m => {
      let desc = `${m.operator} ${m.type} [Bal: Tk ${(m.balanceAfter || 0).toLocaleString()}]`;
      if (m.charge) desc += ` (Fee: Tk ${m.charge})`;

      unifiedList.push({
        date: m.date,
        time: m.time,
        type: 'MFS',
        description: desc,
        amount: m.amount,
        cost: 0,
        profit: m.profit,
      });
    });

    // Sort chronologically descending
    unifiedList.sort((a, b) => {
      const dtA = `${a.date} ${a.time || ''}`;
      const dtB = `${b.date} ${b.time || ''}`;
      return dtB.localeCompare(dtA);
    });

    let totalAmountSum = 0;
    let totalCostSum = 0;

    const auditRows = unifiedList.map((item, index) => {
      totalAmountSum += item.amount;
      totalCostSum += item.cost;
      const profitStr = item.profit >= 0 ? `+Tk ${item.profit.toLocaleString()}` : `-Tk ${Math.abs(item.profit).toLocaleString()}`;
      return [
        (index + 1).toString(),
        `${item.date}${item.time ? ` ${item.time}` : ''}`,
        item.type, // Indicator column: Sell / Cost / MFS
        item.description,
        `Tk ${item.amount.toLocaleString()}`,
        `Tk ${item.cost.toLocaleString()}`,
        profitStr,
      ];
    });

    const netProfitFormatted = netProfit >= 0 
      ? `+Tk ${netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
      : `-Tk ${Math.abs(netProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    autoTable(doc, {
      startY: startY,
      head: [['#', 'Date & Time', 'Type', 'Particulars / Description', 'Amount', 'Cost / Out', 'Profit (+/-)']],
      body: auditRows.length > 0 ? auditRows : [['—', '—', '—', 'No audit transactions recorded in this period', '—', '—', '—']],
      foot: auditRows.length > 0 ? [[
        '',
        'TOTAL',
        `${unifiedList.length} items`,
        'Consolidated Net Audit Ledger',
        `Tk ${totalAmountSum.toLocaleString()}`,
        `Tk ${totalCostSum.toLocaleString()}`,
        netProfitFormatted,
      ]] : undefined,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 28 },
        2: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 23, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 21, halign: 'right' },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        // Color type indicators
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === 'Sell') {
            data.cell.styles.textColor = [22, 101, 52]; // Green
          } else if (data.cell.raw === 'Cost') {
            data.cell.styles.textColor = [185, 28, 28]; // Red
          } else if (data.cell.raw === 'MFS') {
            data.cell.styles.textColor = [2, 132, 199]; // Blue/Sky
          }
        }
        // Color profit column
        if (data.section === 'body' && data.column.index === 6) {
          const text = String(data.cell.raw || '');
          if (text.startsWith('-')) {
            data.cell.styles.textColor = [185, 28, 28];
          } else if (text.startsWith('+')) {
            data.cell.styles.textColor = [22, 101, 52];
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    return (doc as any).lastAutoTable.finalY;
  };

  // Render according to mode
  if (mode === 'full' || activeTab === 'all') {
    // Single consolidated table for full audit report with Type (Sell/Cost/MFS) column
    currentY = addUnifiedAuditTable(currentY + 3);
  } else {
    // Individual active tab statements
    if (activeTab === 'sales') {
      currentY = addSalesTable(currentY);
    } else if (activeTab === 'expenses') {
      currentY = addExpensesTable(currentY);
    } else if (activeTab === 'mfs') {
      currentY = addMfsTable(currentY);
    }
  }

  // --- Signatures & Footers ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Bottom Footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Al-Barakah Digital Studio & Online Service — Official Accounts Statement', 14, pageHeight - 7.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7.5, { align: 'right' });

    // On last page, add formal verification / signature lines if there is space
    if (i === totalPages) {
      const remainingSpace = pageHeight - currentY;
      const sigY = remainingSpace > 35 ? pageHeight - 24 : pageHeight - 20;

      if (remainingSpace > 28) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);

        // Prepared By Line
        doc.line(14, sigY, 65, sigY);
        doc.text('Prepared By (Manager)', 14, sigY + 4);

        // Authorized Signature
        doc.line(pageWidth - 65, sigY, pageWidth - 14, sigY);
        doc.text('Authorized Signature & Seal', pageWidth - 65, sigY + 4);
      }
    }
  }

  const filename = mode === 'full'
    ? `AlBarakah_Full_Statement_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`
    : `AlBarakah_${activeTab}_Statement_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;

  doc.save(filename);
}
