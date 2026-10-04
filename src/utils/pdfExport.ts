import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { Sale, Expense, MfsTransaction } from '../db/db';
import { DEFAULT_SHOP_LOGO_BASE64 } from './logoBase64';

export interface StatementPdfOptions {
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

let cachedLogoBase64: string | null = null;

export async function getLogoBase64(): Promise<string> {
  if (cachedLogoBase64) return cachedLogoBase64;

  try {
    const customPhoto = localStorage.getItem('albarakah_shop_photo');
    if (customPhoto && (customPhoto.startsWith('data:') || customPhoto.startsWith('http'))) {
      cachedLogoBase64 = customPhoto;
      return customPhoto;
    }
    const savedProfile = localStorage.getItem('albarakah_user_profile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      if (parsed?.photoURL && (parsed.photoURL.startsWith('data:') || parsed.photoURL.startsWith('http'))) {
        cachedLogoBase64 = parsed.photoURL;
        return parsed.photoURL;
      }
    }
  } catch {
    // ignore
  }

  cachedLogoBase64 = DEFAULT_SHOP_LOGO_BASE64;
  return DEFAULT_SHOP_LOGO_BASE64;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildStatementHtml(options: StatementPdfOptions, logoUrl: string): string {
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
    netProfit
  } = options;

  let reportTitle = 'STATEMENT OF ACCOUNTS';
  if (mode === 'active') {
    if (activeTab === 'sales') reportTitle = 'SALES STATEMENT';
    else if (activeTab === 'expenses') reportTitle = 'EXPENSES STATEMENT';
    else if (activeTab === 'mfs') reportTitle = 'MFS STATEMENT';
  }

  interface UnifiedItem {
    date: string;
    time?: string;
    type: string;
    description: string;
    amount: number;
    cost: number;
    profit: number;
  }

  const unifiedList: UnifiedItem[] = [];

  if (mode === 'full' || activeTab === 'all' || activeTab === 'sales') {
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
  }

  if (mode === 'full' || activeTab === 'all' || activeTab === 'expenses') {
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
  }

  if (mode === 'full' || activeTab === 'all' || activeTab === 'mfs') {
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
  }

  unifiedList.sort((a, b) => {
    const dtA = `${a.date} ${a.time || ''}`;
    const dtB = `${b.date} ${b.time || ''}`;
    return dtB.localeCompare(dtA);
  });

  let totalAmountSum = 0;
  let totalCostSum = 0;

  const tableRowsHtml = unifiedList.map((item, index) => {
    totalAmountSum += item.amount;
    totalCostSum += item.cost;

    let profitColor = '#4a5568';
    let profitFormatted = `Tk ${item.profit.toLocaleString()}`;
    if (item.profit > 0) {
      profitColor = '#2e7d32';
      profitFormatted = `+Tk ${item.profit.toLocaleString()}`;
    } else if (item.profit < 0) {
      profitColor = '#c62828';
      profitFormatted = `-Tk ${Math.abs(item.profit).toLocaleString()}`;
    }

    const dateTime = `${item.date}${item.time ? ` ${item.time}` : ''}`;

    return `<tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(dateTime)}</td>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td class="text-right">Tk ${item.amount.toLocaleString()}</td>
      <td class="text-right">Tk ${item.cost.toLocaleString()}</td>
      <td class="text-right" style="color:${profitColor}; font-weight:600;">${profitFormatted}</td>
    </tr>`;
  }).join('\n');

  let netProfitFormatted = `+Tk ${netProfit.toLocaleString()}`;
  let netProfitColor = '#005a36';
  if (netProfit < 0) {
    netProfitFormatted = `-Tk ${Math.abs(netProfit).toLocaleString()}`;
    netProfitColor = '#c62828';
  } else if (netProfit === 0) {
    netProfitFormatted = `Tk 0`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Al-Barakah Report Template</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;500;600;700&display=swap');

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
            background-color: #ffffff;
            padding: 0;
            color: #2d3748;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        /* Printable A4 Page Container */
        .page-container {
            max-width: 850px;
            margin: 0 auto;
            background: #ffffff;
            min-height: 1050px;
            padding: 40px;
            position: relative;
            box-shadow: none;
            border-radius: 0;
            overflow: hidden;
        }

        /* Perfectly Centered Background Watermark */
        .watermark-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            z-index: 0;
        }

        .watermark-container img {
            width: 60%;
            max-width: 450px;
            opacity: 0.06;
            object-fit: contain;
            display: block;
        }

        .content-wrap {
            position: relative;
            z-index: 1;
        }

        /* Header Section */
        .header-top {
            text-align: center;
            margin-bottom: 15px;
        }

        .logo-container {
            display: inline-block;
            margin-bottom: 8px;
        }

        .header-top img.main-logo {
            height: 75px;
            width: 75px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #005a36;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            display: inline-block;
        }

        .header-top h1 {
            font-size: 22px;
            color: #005a36;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
            text-transform: uppercase;
        }

        .header-top .statement-title {
            font-size: 15px;
            font-weight: 700;
            color: #2d3748;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 3px;
        }

        .header-top .statement-period {
            font-size: 12px;
            color: #4a5568;
            font-weight: 500;
        }

        /* Divider Line */
        .divider-line {
            height: 3px;
            background: linear-gradient(90deg, #005a36, #38a169, #005a36);
            margin: 15px 0 25px 0;
            border-radius: 2px;
        }

        /* Summary Bar */
        .summary-bar {
            background: #e6f4ea;
            padding: 10px 16px;
            border-radius: 6px;
            margin-bottom: 25px;
            border: 1px solid #c6e6d1;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 600;
            color: #005a36;
        }

        /* Table Styling */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        tr {
            page-break-inside: avoid;
        }

        th {
            background: #005a36;
            color: white;
            padding: 10px 12px;
            font-size: 12px;
            font-weight: 600;
            text-align: left;
        }

        td {
            padding: 10px 12px;
            font-size: 13px;
            border-bottom: 1px solid #e2e8f0;
            color: #4a5568;
        }

        .text-right { text-align: right; }
        .text-center { text-align: center; }

        .total-row td {
            background-color: #e6f2ed;
            font-weight: 700;
            color: #005a36;
            border-top: 2px solid #005a36;
            border-bottom: none;
        }

        /* Footer Signatures */
        .footer-signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 60px;
            page-break-inside: avoid;
        }

        .sig-box {
            text-align: center;
            width: 200px;
        }

        .sig-line {
            border-top: 1px dashed #718096;
            margin-bottom: 6px;
        }

        .sig-box p {
            font-size: 12px;
            color: #4a5568;
            font-weight: 500;
        }

        .courtesy {
            text-align: center;
            margin-top: 40px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            font-size: 11px;
            color: #a0aec0;
            letter-spacing: 0.5px;
            page-break-inside: avoid;
        }

        @media print {
            body { background: none; padding: 0; }
            .page-container { box-shadow: none; border: none; border-radius: 0; width: 100%; padding: 15mm 12mm; }
            @page { size: A4; margin: 0; }
        }
    </style>
</head>
<body>

<div class="page-container">
    
    <!-- Perfect Centered Watermark Background -->
    <div class="watermark-container">
        <img src="${logoUrl}" alt="Watermark">
    </div>

    <div class="content-wrap">
        
        <!-- Header Section -->
        <div class="header-top">
            <div class="logo-container">
                <img src="${logoUrl}" alt="Al-Barakah Logo" class="main-logo">
            </div>
            <br>
            <h1>AL-BARAKAH DIGITAL STUDIO & ONLINE SERVICE</h1>
            <div class="statement-title" id="reportTitle">${reportTitle}</div>
            <div class="statement-period" id="reportPeriod">Period: ${escapeHtml(periodLabel)}</div>
        </div>
        
        <div class="divider-line"></div>

        <!-- Summary Bar -->
        <div class="summary-bar">
            <span>Total Sales: Tk ${totalSales.toLocaleString()}</span>
            <span>Sales Profit: Tk ${salesProfit.toLocaleString()}</span>
            <span>Total Expense: Tk ${totalExpense.toLocaleString()}</span>
            <span>Net Profit: Tk ${netProfit.toLocaleString()}</span>
        </div>

        <!-- Data Table -->
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th class="text-right">Amount</th>
                    <th class="text-right">Cost/Out</th>
                    <th class="text-right">Profit</th>
                </tr>
            </thead>
            <tbody>
                ${tableRowsHtml || '<tr><td colspan="7" class="text-center" style="padding: 20px; color:#a0aec0;">No transactions found for this period</td></tr>'}
                ${unifiedList.length > 0 ? `
                <tr class="total-row">
                    <td colspan="4">TOTAL (${unifiedList.length} items)</td>
                    <td class="text-right">Tk ${totalAmountSum.toLocaleString()}</td>
                    <td class="text-right">Tk ${totalCostSum.toLocaleString()}</td>
                    <td class="text-right" style="color:${netProfitColor}; font-weight:700;">${netProfitFormatted}</td>
                </tr>` : ''}
            </tbody>
        </table>

        <!-- Signature Section -->
        <div class="footer-signatures">
            <div class="sig-box">
                <div class="sig-line"></div>
                <p>Prepared By (Manager)</p>
            </div>
            <div class="sig-box">
                <div class="sig-line"></div>
                <p>Authorized Signature & Seal</p>
            </div>
        </div>

        <!-- Footer Courtesy -->
        <div class="courtesy">
            Al-Barakah Digital Studio & Online Service
        </div>

    </div>
</div>

</body>
</html>`;
}

export async function generateStatementPdf(options: StatementPdfOptions) {
  const logoDataUrl = await getLogoBase64();
  const htmlContent = buildStatementHtml(options, logoDataUrl);

  const filename = options.mode === 'full'
    ? `AlBarakah_Statement_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`
    : `AlBarakah_${options.activeTab}_Statement_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;

  // Use a completely isolated offscreen iframe so template CSS never touches the parent app
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '-10000px';
  iframe.style.width = '850px';
  iframe.style.height = '1400px';
  iframe.style.border = '0';
  iframe.style.opacity = '1';
  iframe.style.zIndex = '-99999';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  try {
    const frameDoc = iframe.contentWindow?.document;
    if (!frameDoc) throw new Error('Could not initialize document sandbox');

    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();

    if (iframe.contentWindow?.document.fonts) {
      await iframe.contentWindow.document.fonts.ready;
    }

    const ifrImages = Array.from(frameDoc.querySelectorAll('img'));
    await Promise.all(
      ifrImages.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      })
    );

    await new Promise((r) => setTimeout(r, 200));

    const element = frameDoc.querySelector('.page-container') as HTMLElement || frameDoc.body;

    const renderFunc = typeof html2canvas === 'function' ? html2canvas : (html2canvas as any).default;
    const canvas = await renderFunc(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 850
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}

export async function printStatement(options: StatementPdfOptions) {
  const logoDataUrl = await getLogoBase64();
  const htmlContent = buildStatementHtml(options, logoDataUrl);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc) return;

  frameDoc.open();
  frameDoc.write(htmlContent);
  frameDoc.close();

  const ifrImages = Array.from(frameDoc.querySelectorAll('img'));
  await Promise.all(
    ifrImages.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })
  );

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 2000);
  }, 250);
}
