import { db, InventoryItem, InventoryCategory, InventoryUnit, getRecordMetadata } from '../db/db';
import { recordActivityLog } from './activityLogService';

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
    name: 'A4 Bond Paper 80gsm (Double A)',
    category: 'Plain Paper',
    currentStock: 6,
    unit: 'reams',
    minAlertStock: 2,
    unitCost: 480,
    sellingPrice: 600,
    supplier: 'Stationery Market',
    note: 'For photocopy and standard document print'
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
