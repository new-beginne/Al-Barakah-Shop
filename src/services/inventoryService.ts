import { db, InventoryItem, InventoryCategory, InventoryUnit, getRecordMetadata } from '../db/db';
import { recordActivityLog } from './activityLogService';
import { adjustAccountBalance } from './accountService';
import { format, addDays } from 'date-fns';

export type PurchaseFundingSource = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'loan' | 'due' | 'none';

export interface PurchaseFundingDetails {
  source: PurchaseFundingSource;
  totalCost: number;
  lenderName?: string;
  lenderPhone?: string;
  dueDate?: string;
  note?: string;
}

const DEFAULT_INVENTORY_ITEMS: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '4R Glossy Photo Paper',
    category: 'Photo Paper',
    currentStock: 150,
    unit: 'sheets',
    minAlertStock: 30,
    unitCost: 3.5,
    sellingPrice: 10,
    supplier: 'Local Paper Wholesale',
    note: 'Standard 200gsm photo paper for passport and 4R prints'
  },
  {
    name: 'A4 Glossy Photo Paper (230gsm)',
    category: 'Photo Paper',
    currentStock: 80,
    unit: 'sheets',
    minAlertStock: 20,
    unitCost: 12,
    sellingPrice: 40,
    supplier: 'Paper Depot',
    note: 'High-gloss heavy paper for portrait & certificates'
  },
  {
    name: 'A4 Plain Paper (Double A 80gsm)',
    category: 'Plain Paper',
    currentStock: 500,
    unit: 'sheets',
    minAlertStock: 50,
    unitCost: 1.2,
    sellingPrice: 5,
    supplier: 'Stationery Market',
    note: 'Standard 80gsm paper for photocopy, print, and office documents'
  },
  {
    name: 'Epson 003 Black Ink (65ml)',
    category: 'Printer Ink',
    currentStock: 3,
    unit: 'bottles',
    minAlertStock: 1,
    unitCost: 550,
    supplier: 'Epson Official Dealer',
    note: 'Original dye ink for studio inkjet printer'
  },
  {
    name: 'Epson 003 Color Ink Set (CMY)',
    category: 'Printer Ink',
    currentStock: 2,
    unit: 'bottles',
    minAlertStock: 1,
    unitCost: 1650,
    supplier: 'Epson Official Dealer',
    note: 'Cyan, Magenta, and Yellow ink bottles'
  },
  {
    name: 'A4 Lamination Pouch (100 Micron)',
    category: 'Lamination',
    currentStock: 120,
    unit: 'sheets',
    minAlertStock: 25,
    unitCost: 8,
    sellingPrice: 20,
    supplier: 'Dhaka Lamination House',
    note: 'For document and certificate lamination'
  },
  {
    name: 'NID / ID Card Lamination Pouch',
    category: 'Lamination',
    currentStock: 200,
    unit: 'sheets',
    minAlertStock: 40,
    unitCost: 3,
    sellingPrice: 10,
    supplier: 'Dhaka Lamination House',
    note: 'Pre-cut badge size for National ID card'
  },
  {
    name: '4R Wooden Border Photo Frame',
    category: 'Photo Frames',
    currentStock: 24,
    unit: 'pieces',
    minAlertStock: 5,
    unitCost: 75,
    sellingPrice: 150,
    supplier: 'Frame Art Corner',
    note: 'Desk & wall hanging frame with glass'
  }
];

/**
 * Initialize default digital studio materials if inventory is empty
 */
export async function initDefaultInventory(): Promise<void> {
  try {
    const count = await db.inventory.count();
    if (count === 0) {
      const meta = getRecordMetadata();
      const itemsToInsert = DEFAULT_INVENTORY_ITEMS.map(item => ({
        ...item,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        lastRestockedDate: meta.date
      }));
      await db.inventory.bulkAdd(itemsToInsert);
    } else {
      // Auto-migrate legacy A4 paper measured in reams to sheets so sales deduct sheets accurately
      const allInv = await db.inventory.toArray();
      for (const item of allInv) {
        if (item.unit === 'reams' && item.name.toLowerCase().includes('a4') && item.currentStock <= 25) {
          const convertedStock = Math.max(50, item.currentStock * 500);
          await db.inventory.update(item.id!, {
            unit: 'sheets',
            currentStock: convertedStock,
            minAlertStock: Math.max(50, item.minAlertStock * 50),
            unitCost: item.unitCost ? Math.round((item.unitCost / 500) * 100) / 100 : 1.2,
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to initialize default inventory:', err);
  }
}

/**
 * Add a new item to inventory
 */
export async function addInventoryItem(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const meta = getRecordMetadata();
  const id = await db.inventory.add({
    ...item,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    lastRestockedDate: item.lastRestockedDate || meta.date
  });

  await recordActivityLog({
    action: 'CREATE',
    module: 'System',
    entityId: id,
    title: `Added inventory item: ${item.name}`,
    details: `Initial stock: ${item.currentStock} ${item.unit}`
  });

  return id;
}

/**
 * Update existing inventory item
 */
export async function updateInventoryItem(id: number, updates: Partial<InventoryItem>): Promise<void> {
  const meta = getRecordMetadata();
  await db.inventory.update(id, {
    ...updates,
    updatedAt: meta.updatedAt
  });
}

/**
 * Delete inventory item
 */
export async function deleteInventoryItem(id: number, name: string): Promise<void> {
  await db.inventory.delete(id);
  await recordActivityLog({
    action: 'DELETE',
    module: 'System',
    entityId: id,
    title: `Deleted inventory item: ${name}`
  });
}

/**
 * Restock an item (increase stock quantity)
 */
export async function restockInventoryItem(id: number, addQty: number, newUnitCost?: number, note?: string): Promise<void> {
  const item = await db.inventory.get(id);
  if (!item) return;

  const meta = getRecordMetadata();
  const updatedStock = Number(item.currentStock || 0) + Number(addQty);
  
  await db.inventory.update(id, {
    currentStock: updatedStock,
    unitCost: newUnitCost !== undefined && newUnitCost > 0 ? newUnitCost : item.unitCost,
    lastRestockedDate: meta.date,
    updatedAt: meta.updatedAt,
    note: note ? `${item.note ? item.note + ' | ' : ''}Restocked +${addQty} on ${meta.date}` : item.note
  });

  await recordActivityLog({
    action: 'EDIT',
    module: 'System',
    entityId: id,
    title: `Restocked ${item.name}`,
    details: `Added ${addQty} ${item.unit}. New stock: ${updatedStock} ${item.unit}`
  });
}

/**
 * Consume / reduce stock (e.g. used in job or damaged)
 */
export async function consumeInventoryItem(id: number, reduceQty: number, reason: string): Promise<boolean> {
  const item = await db.inventory.get(id);
  if (!item) return false;

  const current = Number(item.currentStock || 0);
  const updatedStock = Math.max(0, current - Number(reduceQty));
  const meta = getRecordMetadata();

  await db.inventory.update(id, {
    currentStock: updatedStock,
    updatedAt: meta.updatedAt
  });

  await recordActivityLog({
    action: 'EDIT',
    module: 'System',
    entityId: id,
    title: `Stock used: ${item.name}`,
    details: `Reduced ${reduceQty} ${item.unit} (${reason}). Remaining: ${updatedStock} ${item.unit}`
  });

  return true;
}

/**
 * Restock an item with funding/payment tracking
 */
export async function restockInventoryWithPayment(
  itemId: number,
  addQty: number,
  unitCost: number,
  funding: PurchaseFundingDetails,
  restockNote?: string
): Promise<void> {
  const item = await db.inventory.get(itemId);
  if (!item) return;

  const meta = getRecordMetadata();
  const updatedStock = Number(item.currentStock || 0) + Number(addQty);

  // 1. Update inventory
  await db.inventory.update(itemId, {
    currentStock: updatedStock,
    unitCost: unitCost > 0 ? unitCost : item.unitCost,
    lastRestockedDate: meta.date,
    updatedAt: meta.updatedAt,
    note: restockNote ? `${item.note ? item.note + ' | ' : ''}${restockNote}` : item.note
  });

  const totalCost = funding.totalCost > 0 ? funding.totalCost : Math.round(Number(addQty) * Number(unitCost));

  // 2. Process funding source
  if (totalCost > 0) {
    if (funding.source === 'cash' || funding.source === 'bkash' || funding.source === 'nagad' || funding.source === 'rocket') {
      // Deduct from wallet / cash
      await adjustAccountBalance(funding.source, -totalCost);

      const paymentMethodTitle = funding.source === 'cash' ? 'Cash' : funding.source === 'bkash' ? 'bKash' : funding.source === 'nagad' ? 'Nagad' : 'Rocket';
      await db.expenses.add({
        date: meta.date,
        time: meta.time,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        title: `Stock Purchase: ${item.name} (+${addQty} ${item.unit})`,
        category: 'Inventory / Materials',
        amount: totalCost,
        paymentMethod: paymentMethodTitle,
        note: `Restocked ${addQty} ${item.unit} @ Tk ${unitCost} (${paymentMethodTitle})`
      });

      await db.balanceLogs.add({
        date: meta.date,
        time: meta.time,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        accountId: funding.source,
        accountName: paymentMethodTitle,
        type: 'edit',
        amount: -totalCost,
        previousBalance: 0,
        newBalance: 0,
        note: `Purchased stock: ${item.name} (+${addQty} ${item.unit})`
      });
    } else if (funding.source === 'loan') {
      // Loan / Borrowing taken to purchase stock
      const lender = funding.lenderName?.trim() || 'Loan / Borrowing (Stock Purchase)';
      await db.borrowings.add({
        date: meta.date,
        time: meta.time,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        lenderName: lender,
        phone: funding.lenderPhone?.trim() || '',
        amount: totalCost,
        paidAmount: 0,
        dueDate: funding.dueDate || format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        status: 'Unpaid',
        note: `Loan for stock purchase: ${item.name} (+${addQty} ${item.unit})`
      });
    } else if (funding.source === 'due') {
      // Bought on Credit from Supplier
      const supplierName = funding.lenderName?.trim() || (item.supplier ? `${item.supplier} (Supplier Due)` : 'Supplier Credit (Due)');
      await db.borrowings.add({
        date: meta.date,
        time: meta.time,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        lenderName: supplierName,
        phone: funding.lenderPhone?.trim() || '',
        amount: totalCost,
        paidAmount: 0,
        dueDate: funding.dueDate || format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        status: 'Unpaid',
        note: `Supplier Due for stock: ${item.name} (+${addQty} ${item.unit})`
      });
    }
  }

  // 3. Activity log
  const fundingText = funding.source === 'cash' ? 'Cash' 
    : funding.source === 'loan' ? 'Loan / Borrowing'
    : funding.source === 'due' ? 'Supplier Credit (Due)'
    : funding.source === 'none' ? 'No balance change'
    : funding.source.toUpperCase();

  await recordActivityLog({
    action: 'EDIT',
    module: 'System',
    entityId: itemId,
    title: `Restocked ${item.name} (+${addQty} ${item.unit})`,
    details: `Cost: Tk ${totalCost.toLocaleString()} paid via ${fundingText}. New stock: ${updatedStock} ${item.unit}`
  });
}

export async function addInventoryItemWithPayment(
  item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>,
  funding: PurchaseFundingDetails
): Promise<number> {
  const meta = getRecordMetadata();
  const id = await db.inventory.add({
    ...item,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    lastRestockedDate: item.lastRestockedDate || meta.date
  });

  const totalCost = funding.totalCost > 0 ? funding.totalCost : Math.round(Number(item.currentStock || 0) * Number(item.unitCost || 0));

  if (totalCost > 0 && Number(item.currentStock || 0) > 0) {
    if (funding.source === 'cash' || funding.source === 'bkash' || funding.source === 'nagad' || funding.source === 'rocket') {
      await adjustAccountBalance(funding.source, -totalCost);
      const paymentMethodTitle = funding.source === 'cash' ? 'Cash' : funding.source === 'bkash' ? 'bKash' : funding.source === 'nagad' ? 'Nagad' : 'Rocket';

      await db.expenses.add({
        date: meta.date,
        time: meta.time,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        title: `New Stock Purchase: ${item.name} (${item.currentStock} ${item.unit})`,
        category: 'Inventory / Materials',
        amount: totalCost,
        paymentMethod: paymentMethodTitle,
        note: `Initial stock ${item.currentStock} ${item.unit} @ Tk ${item.unitCost} (${paymentMethodTitle})`
      });

      await db.balanceLogs.add({
        date: meta.date,
        time: meta.time,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        accountId: funding.source,
        accountName: paymentMethodTitle,
        type: 'edit',
        amount: -totalCost,
        previousBalance: 0,
        newBalance: 0,
        note: `Initial stock purchase: ${item.name} (${item.currentStock} ${item.unit})`
      });
    } else if (funding.source === 'loan') {
      const lender = funding.lenderName?.trim() || 'Loan / Borrowing (Stock Purchase)';
      await db.borrowings.add({
        date: meta.date,
        time: meta.time,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        lenderName: lender,
        phone: funding.lenderPhone?.trim() || '',
        amount: totalCost,
        paidAmount: 0,
        dueDate: funding.dueDate || format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        status: 'Unpaid',
        note: `Loan for new stock: ${item.name} (${item.currentStock} ${item.unit})`
      });
    } else if (funding.source === 'due') {
      const supplierName = funding.lenderName?.trim() || (item.supplier ? `${item.supplier} (Supplier Due)` : 'Supplier Credit (Due)');
      await db.borrowings.add({
        date: meta.date,
        time: meta.time,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        lenderName: supplierName,
        phone: funding.lenderPhone?.trim() || '',
        amount: totalCost,
        paidAmount: 0,
        dueDate: funding.dueDate || format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        status: 'Unpaid',
        note: `Supplier Due for stock: ${item.name} (${item.currentStock} ${item.unit})`
      });
    }
  }

  await recordActivityLog({
    action: 'CREATE',
    module: 'System',
    entityId: id,
    title: `Added inventory item: ${item.name}`,
    details: `Initial stock: ${item.currentStock} ${item.unit}. Cost: Tk ${totalCost}`
  });

  return id;
}
