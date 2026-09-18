import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Customer } from '../db/db';

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
  const nowStr = format(new Date(), 'dd/MM/yyyy, hh:mm a');

  // --- Brand Header (Clean Left & Right Layout) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(8, 75, 62); // Brand Emerald #084b3e
  doc.text('AL-BARAKAH DIGITAL STUDIO & ONLINE SERVICE', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Digital Photo Studio • Printing • Online & Govt Services • MFS Banking', 14, 20);

  // Right: Document Title
  const rightX = pageWidth - 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('CUSTOMER STATEMENT', rightX, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${periodLabel}`, rightX, 20, { align: 'right' });
  doc.text(`Generated: ${nowStr}`, rightX, 24.5, { align: 'right' });

  // Clean horizontal divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 28, pageWidth - 14, 28);

  // --- Customer Info Card ---
  const boxY = 32;
  const boxHeight = 18;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, boxY, pageWidth - 28, boxHeight, 2, 2, 'FD');

  // Left: Customer details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(customer.name, 18, boxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${customer.phone || 'N/A'}${customer.address ? ` • Address: ${customer.address}` : ''}`, 18, boxY + 12);

  // Right: Account ID
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(8, 75, 62);
  doc.text(`Account ID: #CUS-${customer.id || 'N/A'}`, rightX - 4, boxY + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${transactions.length} Total Activity Records`, rightX - 4, boxY + 12, { align: 'right' });

  // --- Clean 3-Metric Summary Bar ---
  const barY = boxY + boxHeight + 4;
  const barHeight = 14;
  const barWidth = pageWidth - 28;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, barY, barWidth, barHeight, 2, 2, 'FD');

  const colWidth = barWidth / 3;

  // Metric 1: Total Purchases
  const m1X = 14 + 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL PURCHASES', m1X, barY + 4.5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Tk ${totalPurchases.toLocaleString('en-US')}`, m1X, barY + 9.8);

  // Vertical divider 1
  doc.setDrawColor(226, 232, 240);
  doc.line(14 + colWidth, barY + 2.5, 14 + colWidth, barY + barHeight - 2.5);

  // Metric 2: Total Paid
  const m2X = 14 + colWidth + 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL PAID / CLEARED', m2X, barY + 4.5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(`Tk ${totalPaid.toLocaleString('en-US')}`, m2X, barY + 9.8);

  // Vertical divider 2
  doc.line(14 + (colWidth * 2), barY + 2.5, 14 + (colWidth * 2), barY + barHeight - 2.5);

  // Metric 3: Current Due
  const m3X = 14 + (colWidth * 2) + 6;
  const hasDue = currentBalanceDue > 0;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('OUTSTANDING DUE', m3X, barY + 4.5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(hasDue ? 220 : 22, hasDue ? 38 : 101, hasDue ? 38 : 52);
  doc.text(`Tk ${currentBalanceDue.toLocaleString('en-US')}`, m3X, barY + 9.8);

  // --- Transactions Ledger Table (Simple & Clean) ---
  const tableStartY = barY + barHeight + 5;

  const tableRows = transactions.map((t, index) => {
    const dateStr = `${t.date}${t.time ? ` ${t.time}` : ''}`;
    const desc = t.title;
    const typeLabel = t.type === 'due' ? 'Due' : t.type === 'payment' ? 'Payment' : 'Sale';
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
    head: [['#', 'Date & Time', 'Particulars / Service', 'Type', 'Total', 'Paid', 'Due', 'Status']],
    body: tableRows.length > 0 ? tableRows : [['—', '—', 'No recorded transactions for this customer', '—', '—', '—', '—', '—']],
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
      textColor: [30, 41, 59],
      lineColor: [241, 245, 249],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [8, 75, 62], // Brand Emerald #084b3e
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
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 20, halign: 'right', textColor: [22, 101, 52] },
      6: { cellWidth: 20, halign: 'right', textColor: [220, 38, 38], fontStyle: 'bold' },
      7: { cellWidth: 18, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 20;

  // --- Signatures & Footers across all pages ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Bottom Footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Al-Barakah Digital Studio & Online Service — Customer Statement', 14, pageHeight - 7.5);
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
        doc.setDrawColor(203, 213, 225);
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
