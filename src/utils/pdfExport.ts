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
  const nowStr = format(new Date(), 'dd/MM/yyyy, hh:mm a');

  // --- Brand Header (Clean Left & Right Layout) ---
  // Left: Shop identity
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(8, 75, 62); // Brand Emerald #084b3e
  doc.text('AL-BARAKAH DIGITAL STUDIO & ONLINE SERVICE', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('Digital Photo Studio • Printing • Online & Govt Services • MFS Banking', 14, 20);

  // Right: Document Title & Metadata
  const rightX = pageWidth - 14;
  const reportTitle = mode === 'full' || activeTab === 'all'
    ? 'STATEMENT OF ACCOUNTS'
    : `${activeTab.toUpperCase()} STATEMENT`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(reportTitle, rightX, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${periodLabel}`, rightX, 20, { align: 'right' });
  doc.text(`Generated: ${nowStr}`, rightX, 24.5, { align: 'right' });

  // Clean, subtle horizontal divider line
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.4);
  doc.line(14, 28, pageWidth - 14, 28);

  // --- Clean Minimalist Summary Bar (No cluttered boxes) ---
  const barY = 32;
  const barHeight = 15;
  const barWidth = pageWidth - 28;

  // Background container
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, barY, barWidth, barHeight, 2, 2, 'FD');

  const colWidth = barWidth / 3;

  // Metric 1: Total Sales
  const m1X = 14 + 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL SALES', m1X, barY + 4.5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Tk ${totalSales.toLocaleString('en-US')}`, m1X, barY + 9.8);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 101, 52);
  doc.text(`Sales Profit: Tk ${salesProfit.toLocaleString('en-US')}`, m1X, barY + 13.3);

  // Vertical divider 1
  doc.setDrawColor(226, 232, 240);
  doc.line(14 + colWidth, barY + 2.5, 14 + colWidth, barY + barHeight - 2.5);

  // Metric 2: Total Expenses
  const m2X = 14 + colWidth + 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL EXPENSES', m2X, barY + 4.5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text(`Tk ${totalExpense.toLocaleString('en-US')}`, m2X, barY + 9.8);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${expenses.length} operating expense record${expenses.length === 1 ? '' : 's'}`, m2X, barY + 13.3);

  // Vertical divider 2
  doc.line(14 + (colWidth * 2), barY + 2.5, 14 + (colWidth * 2), barY + barHeight - 2.5);

  // Metric 3: Net Profit
  const m3X = 14 + (colWidth * 2) + 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('NET PROFIT', m3X, barY + 4.5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(netProfit >= 0 ? 8 : 220, netProfit >= 0 ? 75 : 38, netProfit >= 0 ? 62 : 38);
  doc.text(`${netProfit >= 0 ? 'Tk ' : '-Tk '}${Math.abs(netProfit).toLocaleString('en-US')}`, m3X, barY + 9.8);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`MFS Profit: Tk ${mfsProfit.toLocaleString('en-US')}`, m3X, barY + 13.3);

  let currentY = barY + barHeight + 6;

  // --- Table Generation Helpers (Clean, Simple, Uncluttered) ---

  // 1. Unified Audit Ledger Table (All in One)
  const addUnifiedAuditTable = (startY: number) => {
    interface UnifiedItem {
      date: string;
      time?: string;
      type: 'Sale' | 'Expense' | 'MFS';
      description: string;
      amount: number;
      cost: number;
      profit: number;
    }

    const unifiedList: UnifiedItem[] = [];

    // Sales
    sales.forEach(s => {
      let desc = s.serviceName;
      if (s.quantity && s.quantity != 1 && s.quantity !== '1') {
        desc += ` (${s.quantity} pcs)`;
      }
      if (s.customerName) {
        desc += ` • ${s.customerName}`;
      }
      unifiedList.push({
        date: s.date,
        time: s.time,
        type: 'Sale',
        description: desc,
        amount: s.amount,
        cost: s.cost || 0,
        profit: s.profit,
      });
    });

    // Expenses
    expenses.forEach(e => {
      let desc = e.title;
      if (e.category) desc += ` • ${e.category}`;
      unifiedList.push({
        date: e.date,
        time: e.time,
        type: 'Expense',
        description: desc,
        amount: e.amount,
        cost: e.amount,
        profit: -e.amount,
      });
    });

    // MFS
    mfs.forEach(m => {
      let desc = `${m.operator} ${m.type}`;
      if (m.recipientNumber) desc += ` • ${m.recipientNumber}`;
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

    const rows = unifiedList.map((item, index) => {
      totalAmountSum += item.amount;
      totalCostSum += item.cost;
      const profitFormatted = item.profit >= 0
        ? `+Tk ${item.profit.toLocaleString()}`
        : `-Tk ${Math.abs(item.profit).toLocaleString()}`;

      return [
        (index + 1).toString(),
        `${item.date}${item.time ? ` ${item.time}` : ''}`,
        item.type,
        item.description,
        `Tk ${item.amount.toLocaleString()}`,
        `Tk ${item.cost.toLocaleString()}`,
        profitFormatted,
      ];
    });

    const netProfitFormatted = netProfit >= 0
      ? `+Tk ${netProfit.toLocaleString('en-US')}`
      : `-Tk ${Math.abs(netProfit).toLocaleString('en-US')}`;

    autoTable(doc, {
      startY: startY,
      head: [['#', 'Date & Time', 'Type', 'Description / Particulars', 'Amount', 'Cost / Out', 'Profit']],
      body: rows.length > 0 ? rows : [['—', '—', '—', 'No transactions found for this period', '—', '—', '—']],
      foot: rows.length > 0 ? [[
        '',
        'TOTAL',
        `${unifiedList.length} items`,
        'Net Financial Totals',
        `Tk ${totalAmountSum.toLocaleString()}`,
        `Tk ${totalCostSum.toLocaleString()}`,
        netProfitFormatted,
      ]] : undefined,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
        textColor: [30, 41, 59],
        lineColor: [241, 245, 249],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [8, 75, 62], // Brand Emerald
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
      },
      alternateRowStyles: {
        fillColor: [250, 252, 252],
      },
      footStyles: {
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 8,
        lineColor: [203, 213, 225],
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 28 },
        2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        // Subtle colored indicator for type
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === 'Sale') {
            data.cell.styles.textColor = [22, 101, 52];
          } else if (data.cell.raw === 'Expense') {
            data.cell.styles.textColor = [220, 38, 38];
          } else if (data.cell.raw === 'MFS') {
            data.cell.styles.textColor = [8, 75, 62];
          }
        }
        // Profit column color
        if (data.section === 'body' && data.column.index === 6) {
          const val = String(data.cell.raw || '');
          if (val.startsWith('-')) {
            data.cell.styles.textColor = [220, 38, 38];
          } else if (val.startsWith('+')) {
            data.cell.styles.textColor = [22, 101, 52];
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    return (doc as any).lastAutoTable.finalY;
  };

  // 2. Sales Tab Table
  const addSalesTable = (startY: number) => {
    const rows = sales.map((s, index) => [
      (index + 1).toString(),
      `${s.date}${s.time ? ` ${s.time}` : ''}`,
      s.serviceName + (s.quantity && s.quantity != 1 && s.quantity !== '1' ? ` (${s.quantity} pcs)` : ''),
      s.customerName || '—',
      s.paymentMethod || 'Cash',
      `Tk ${s.amount.toLocaleString()}`,
      `Tk ${(s.cost || 0).toLocaleString()}`,
      `+Tk ${s.profit.toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['#', 'Date & Time', 'Service / Product', 'Customer', 'Payment', 'Amount', 'Cost', 'Profit']],
      body: rows.length > 0 ? rows : [['—', '—', 'No sales transactions in this period', '—', '—', '—', '—', '—']],
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
        textColor: [30, 41, 59],
        lineColor: [241, 245, 249],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [8, 75, 62],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
      },
      alternateRowStyles: {
        fillColor: [250, 252, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 26 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 26 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 20, halign: 'right' },
        7: { cellWidth: 22, halign: 'right', textColor: [22, 101, 52], fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    return (doc as any).lastAutoTable.finalY;
  };

  // 3. Expenses Tab Table
  const addExpensesTable = (startY: number) => {
    const rows = expenses.map((e, index) => [
      (index + 1).toString(),
      `${e.date}${e.time ? ` ${e.time}` : ''}`,
      e.title,
      e.category || 'General',
      e.note || '—',
      `Tk ${e.amount.toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['#', 'Date & Time', 'Expense Title / Description', 'Category', 'Note', 'Amount']],
      body: rows.length > 0 ? rows : [['—', '—', 'No expense records in this period', '—', '—', '—']],
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
        textColor: [30, 41, 59],
        lineColor: [241, 245, 249],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [8, 75, 62],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
      },
      alternateRowStyles: {
        fillColor: [250, 252, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 28 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 28 },
        4: { cellWidth: 35 },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
      },
      margin: { left: 14, right: 14 },
    });

    return (doc as any).lastAutoTable.finalY;
  };

  // 4. MFS Tab Table
  const addMfsTable = (startY: number) => {
    const rows = mfs.map((m, index) => [
      (index + 1).toString(),
      `${m.date}${m.time ? ` ${m.time}` : ''}`,
      m.operator,
      m.type,
      m.recipientNumber || '—',
      `Tk ${m.amount.toLocaleString()}`,
      `+Tk ${m.profit.toLocaleString()}`,
      `Tk ${(m.balanceAfter || 0).toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['#', 'Date & Time', 'Operator', 'Type', 'Recipient', 'Amount', 'Profit', 'Balance']],
      body: rows.length > 0 ? rows : [['—', '—', 'No MFS records in this period', '—', '—', '—', '—', '—']],
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
        textColor: [30, 41, 59],
        lineColor: [241, 245, 249],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [8, 75, 62],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
      },
      alternateRowStyles: {
        fillColor: [250, 252, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 26 },
        2: { cellWidth: 20, fontStyle: 'bold' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 20, halign: 'right', textColor: [22, 101, 52], fontStyle: 'bold' },
        7: { cellWidth: 25, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    return (doc as any).lastAutoTable.finalY;
  };

  // Render table based on active tab / mode
  if (mode === 'full' || activeTab === 'all') {
    currentY = addUnifiedAuditTable(currentY);
  } else if (activeTab === 'sales') {
    currentY = addSalesTable(currentY);
  } else if (activeTab === 'expenses') {
    currentY = addExpensesTable(currentY);
  } else if (activeTab === 'mfs') {
    currentY = addMfsTable(currentY);
  }

  // --- Signatures & Footers across all pages ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle bottom rule
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Al-Barakah Digital Studio & Online Service — Accounts Statement', 14, pageHeight - 7.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7.5, { align: 'right' });

    // On last page, add signature lines if enough room exists
    if (i === totalPages) {
      const remainingSpace = pageHeight - currentY;
      const sigY = remainingSpace > 35 ? pageHeight - 24 : pageHeight - 20;

      if (remainingSpace > 28) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);

        // Prepared By Line
        doc.setDrawColor(203, 213, 225);
        doc.line(14, sigY, 65, sigY);
        doc.text('Prepared By (Manager)', 14, sigY + 4);

        // Authorized Signature
        doc.line(pageWidth - 65, sigY, pageWidth - 14, sigY);
        doc.text('Authorized Signature & Seal', pageWidth - 65, sigY + 4);
      }
    }
  }

  const filename = mode === 'full'
    ? `AlBarakah_Statement_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`
    : `AlBarakah_${activeTab}_Statement_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;

  doc.save(filename);
}
