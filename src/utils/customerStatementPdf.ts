import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Customer, Sale, Due } from '../db/db';

export interface CustomerTransactionItem {
  id: string | number;
  date: string;
  time?: string;
  type: 'sale' | 'due' | 'payment';
  title: string;
  category?: string;
  paymentMethod?: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  profit?: number;
  status?: string;
}

interface CustomerStatementPdfOptions {
  customer: Customer;
  transactions: CustomerTransactionItem[];
  totalPurchases: number;
  totalPaid: number;
  totalDueGiven: number;
  currentBalanceDue: number;
  periodLabel?: string;
}

export function generateCustomerStatementPdf(options: CustomerStatementPdfOptions) {
  const {
    customer,
    transactions,
    totalPurchases,
    totalPaid,
    totalDueGiven,
    currentBalanceDue,
    periodLabel = 'All Time'
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const nowStr = format(new Date(), 'dd MMM yyyy, hh:mm a');

  // --- Shop Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('AL-BARAKAH DIGITAL STUDIO & ONLINE SERVICE', pageWidth / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Professional Digital Photo Studio, Govt / Online Services & MFS', pageWidth / 2, 19, { align: 'center' });

  // Statement Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('CUSTOMER ACCOUNT STATEMENT & TRANSACTION LEDGER', pageWidth / 2, 25.5, { align: 'center' });

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 28.5, pageWidth - 14, 28.5);

  // --- Customer Profile Info Box ---
  const boxY = 31;
  const boxHeight = 22;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, boxY, pageWidth - 28, boxHeight, 1.5, 1.5, 'FD');

  // Left side: Customer details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(customer.name, 18, boxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${customer.phone || 'N/A'}`, 18, boxY + 11.5);
  doc.text(`Address: ${customer.address || 'N/A'}`, 18, boxY + 16.5);

  // Right side: Metadata
  const rightX = pageWidth - 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Customer ID: #CUS-${customer.id || 'N/A'}`, rightX, boxY + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${periodLabel}`, rightX, boxY + 11.5, { align: 'right' });
  doc.text(`Date Issued: ${nowStr}`, rightX, boxY + 16.5, { align: 'right' });

  // --- Financial Overview Cards ---
  const cardY = boxY + boxHeight + 4;
  const cardHeight = 15;
  const gap = 3.5;
  const numCards = 3;
  const cardWidth = (pageWidth - 28 - (gap * (numCards - 1))) / numCards;

  // 1. Total Purchases Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL PURCHASES', 17, cardY + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Tk ${totalPurchases.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 17, cardY + 10);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total recorded sales`, 17, cardY + 13.5);

  // 2. Total Paid Card
  const paidX = 14 + cardWidth + gap;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(paidX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL PAID / CLEARED', paidX + 3, cardY + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52); // green-700
  doc.text(`Tk ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, paidX + 3, cardY + 10);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Payments received', paidX + 3, cardY + 13.5);

  // 3. Current Outstanding Due Balance Card
  const balanceX = paidX + cardWidth + gap;
  const hasDue = currentBalanceDue > 0;
  if (hasDue) {
    doc.setFillColor(254, 242, 242); // red-50
    doc.setDrawColor(254, 202, 202); // red-200
  } else {
    doc.setFillColor(240, 253, 244); // green-50
    doc.setDrawColor(187, 247, 208); // green-200
  }
  doc.roundedRect(balanceX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(hasDue ? 185 : 22, hasDue ? 28 : 101, hasDue ? 28 : 52);
  doc.text('CURRENT OUTSTANDING DUE', balanceX + 3, cardY + 4.5);
  doc.setFontSize(10);
  doc.text(`Tk ${currentBalanceDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, balanceX + 3, cardY + 10);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(hasDue ? 'Unsettled balance' : 'Account fully cleared', balanceX + 3, cardY + 13.5);

  // --- Transactions Ledger Table ---
  const tableStartY = cardY + cardHeight + 6;

  const tableRows = transactions.map((t, index) => {
    const dateStr = `${t.date}${t.time ? ` ${t.time}` : ''}`;
    const desc = t.title;
    const typeLabel = t.type === 'due' ? 'Due Record' : t.type === 'payment' ? 'Payment' : `Sale (${t.paymentMethod || 'Cash'})`;
    const amtStr = `Tk ${t.amount.toLocaleString()}`;
    const paidStr = `Tk ${t.paidAmount.toLocaleString()}`;
    const dueStr = t.dueAmount > 0 ? `Tk ${t.dueAmount.toLocaleString()}` : '—';
    const statusStr = t.status || (t.dueAmount > 0 ? 'Due' : 'Paid');

    return [
      (index + 1).toString(),
      dateStr,
      desc,
      typeLabel,
      amtStr,
      paidStr,
      dueStr,
      statusStr,
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Date & Time', 'Particulars / Description', 'Type', 'Total', 'Paid', 'Due', 'Status']],
    body: tableRows.length > 0 ? tableRows : [['—', '—', 'No recorded transactions for this customer', '—', '—', '—', '—', '—']],
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
      4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 20, halign: 'right', textColor: [22, 101, 52] },
      6: { cellWidth: 20, halign: 'right', textColor: [185, 28, 28] },
      7: { cellWidth: 18, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 20;

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
    doc.text('Al-Barakah Digital Studio & Online Service — Customer Account Statement', 14, pageHeight - 7.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7.5, { align: 'right' });

    // On last page, add signature boxes
    if (i === totalPages) {
      const remainingSpace = pageHeight - finalY;
      const sigY = remainingSpace > 35 ? pageHeight - 24 : pageHeight - 20;

      if (remainingSpace > 28) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);

        // Customer Signature Line
        doc.line(14, sigY, 65, sigY);
        doc.text('Customer Signature', 14, sigY + 4);

        // Authorized Signature Line
        doc.line(pageWidth - 65, sigY, pageWidth - 14, sigY);
        doc.text('Authorized Signature & Seal', pageWidth - 65, sigY + 4);
      }
    }
  }

  const cleanName = customer.name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `AlBarakah_${cleanName}_Statement_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}
