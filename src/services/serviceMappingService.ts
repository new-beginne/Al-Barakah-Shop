import { db, ServiceItemLink, InventoryItem, ServiceRate, getRecordMetadata } from '../db/db';
import { initDefaultInventory } from './inventoryService';

export interface ConsumedItemRecord {
  inventoryItemId: number;
  inventoryItemName: string;
  quantity: number;
}

export interface ServiceStockImpact {
  isLinked: boolean;
  links: Array<{
    linkId?: number;
    inventoryItemId: number;
    inventoryItemName: string;
    quantityPerUnit: number;
    totalDeduct: number;
    currentStock: number;
    unit: string;
    isLowStock: boolean;
    isOutOfStock: boolean;
  }>;
}

/**
 * Initialize default sales services and their automatic inventory material links
 */
export async function initDefaultServicesAndMappings(): Promise<void> {
  try {
    let inventory = await db.inventory.toArray();
    if (inventory.length === 0) {
      await initDefaultInventory();
      inventory = await db.inventory.toArray();
    }
    if (inventory.length === 0) return;

    // Helper to find inventory item by keywords
    const findInv = (...keywords: string[]): InventoryItem | undefined => {
      return inventory.find(item => {
        const n = item.name.toLowerCase();
        return keywords.every(kw => n.includes(kw.toLowerCase()));
      });
    };

    const a4PlainPaper = 
      findInv('a4', 'plain') || 
      findInv('a4', 'paper') || 
      findInv('a4', 'bond') || 
      findInv('a4') || 
      inventory.find(i => i.category === 'Plain Paper') || 
      inventory[0];

    const photoPaper4R = 
      findInv('4r', 'photo') || 
      findInv('photo', 'paper') || 
      inventory.find(i => i.category === 'Photo Paper') || 
      inventory[0];

    const nidPouch = 
      findInv('nid') || 
      findInv('id card') || 
      inventory.find(i => i.category === 'Lamination') || 
      inventory[0];

    const a4Lamination = 
      findInv('a4', 'lamination') || 
      findInv('lamination') || 
      inventory[0];

    const meta = getRecordMetadata();

    // 1. Check and seed db.services if empty
    const servicesCount = await db.services.count();
    if (servicesCount === 0) {
      const defaultServices: ServiceRate[] = [
        {
          name: 'Photocopy',
          category: 'Printing',
          defaultCost: 1.5,
          defaultPrice: 5,
          linkedInventoryItemId: a4PlainPaper?.id,
          linkedInventoryItemName: a4PlainPaper?.name,
          deductQuantity: 1,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt
        },
        {
          name: 'Computer Print (B&W)',
          category: 'Printing',
          defaultCost: 2,
          defaultPrice: 10,
          linkedInventoryItemId: a4PlainPaper?.id,
          linkedInventoryItemName: a4PlainPaper?.name,
          deductQuantity: 1,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt
        },
        {
          name: 'Document Print (Color)',
          category: 'Printing',
          defaultCost: 5,
          defaultPrice: 20,
          linkedInventoryItemId: a4PlainPaper?.id,
          linkedInventoryItemName: a4PlainPaper?.name,
          deductQuantity: 1,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt
        },
        {
          name: 'Passport Size Photo (4 Copies)',
          category: 'Digital Studio',
          defaultCost: 10,
          defaultPrice: 50,
          linkedInventoryItemId: photoPaper4R?.id,
          linkedInventoryItemName: photoPaper4R?.name,
          deductQuantity: 1,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt
        },
        {
          name: '4R Photo Print',
          category: 'Digital Studio',
          defaultCost: 8,
          defaultPrice: 30,
          linkedInventoryItemId: photoPaper4R?.id,
          linkedInventoryItemName: photoPaper4R?.name,
          deductQuantity: 1,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt
        },
        {
          name: 'NID Card Print',
          category: 'Govt/NID Service',
          defaultCost: 8,
          defaultPrice: 40,
          linkedInventoryItemId: photoPaper4R?.id,
          linkedInventoryItemName: photoPaper4R?.name,
          deductQuantity: 1,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt
        },
        {
          name: 'NID Card Lamination',
          category: 'Govt/NID Service',
          defaultCost: 5,
          defaultPrice: 20,
          linkedInventoryItemId: nidPouch?.id,
          linkedInventoryItemName: nidPouch?.name,
          deductQuantity: 1,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt
        },
        {
          name: 'A4 Document Lamination',
          category: 'Printing',
          defaultCost: 10,
          defaultPrice: 30,
          linkedInventoryItemId: a4Lamination?.id,
          linkedInventoryItemName: a4Lamination?.name,
          deductQuantity: 1,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt
        },
        {
          name: 'Online Application / Registration',
          category: 'Online Service',
          defaultCost: 0,
          defaultPrice: 50,
          linkedInventoryItemId: a4PlainPaper?.id,
          linkedInventoryItemName: a4PlainPaper?.name,
          deductQuantity: 1,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt
        }
      ];

      await db.services.bulkAdd(defaultServices);
    }

    // 2. Check and seed db.serviceItemLinks if empty
    const existingLinksCount = await db.serviceItemLinks.count();
    if (existingLinksCount === 0) {
      const defaultMappings: Omit<ServiceItemLink, 'id'>[] = [];

      // A4 Plain Paper mappings
      if (a4PlainPaper?.id) {
        const plainPaperServices = [
          'Photocopy',
          'Computer Print (B&W)',
          'Computer Print',
          'Document Print (Color)',
          'Color Print',
          'Print',
          'Online Application / Registration',
          'Online Application Print'
        ];

        for (const sName of plainPaperServices) {
          defaultMappings.push({
            serviceName: sName,
            inventoryItemId: a4PlainPaper.id,
            inventoryItemName: a4PlainPaper.name,
            quantityPerUnit: 1,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt
          });
        }
      }

      // Photo Paper mappings
      if (photoPaper4R?.id) {
        const photoServices = [
          'Passport Size Photo (4 Copies)',
          'Passport Size Photo',
          '4R Photo Print',
          'Photo Print',
          'NID Card Print',
          'NID Print'
        ];

        for (const sName of photoServices) {
          defaultMappings.push({
            serviceName: sName,
            inventoryItemId: photoPaper4R.id,
            inventoryItemName: photoPaper4R.name,
            quantityPerUnit: 1,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt
          });
        }
      }

      // NID Lamination Pouch mappings
      if (nidPouch?.id) {
        defaultMappings.push(
          {
            serviceName: 'NID Card Lamination',
            inventoryItemId: nidPouch.id,
            inventoryItemName: nidPouch.name,
            quantityPerUnit: 1,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt
          },
          {
            serviceName: 'NID Lamination',
            inventoryItemId: nidPouch.id,
            inventoryItemName: nidPouch.name,
            quantityPerUnit: 1,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt
          }
        );
      }

      // A4 Lamination mappings
      if (a4Lamination?.id) {
        defaultMappings.push(
          {
            serviceName: 'A4 Document Lamination',
            inventoryItemId: a4Lamination.id,
            inventoryItemName: a4Lamination.name,
            quantityPerUnit: 1,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt
          },
          {
            serviceName: 'A4 Lamination',
            inventoryItemId: a4Lamination.id,
            inventoryItemName: a4Lamination.name,
            quantityPerUnit: 1,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt
          }
        );
      }

      if (defaultMappings.length > 0) {
        await db.serviceItemLinks.bulkAdd(defaultMappings);
      }
    }
  } catch (err) {
    console.error('Failed to initialize default services and mappings:', err);
  }
}

/**
 * Backward compatibility export
 */
export const initDefaultServiceMappings = initDefaultServicesAndMappings;

/**
 * Link a sales service to an inventory stock item
 * Updates both db.serviceItemLinks and db.services
 */
export async function linkServiceToInventoryItem(
  serviceName: string,
  inventoryItemId: number,
  quantityPerUnit: number = 1,
  serviceId?: number
): Promise<void> {
  const meta = getRecordMetadata();
  const item = await db.inventory.get(inventoryItemId);
  if (!item || !item.id) return;

  const mult = Math.max(1, Number(quantityPerUnit) || 1);

  // 1. Update or create rule in db.serviceItemLinks
  const existingLink = await db.serviceItemLinks
    .filter(l => l.serviceName.toLowerCase().trim() === serviceName.toLowerCase().trim())
    .first();

  if (existingLink && existingLink.id) {
    await db.serviceItemLinks.update(existingLink.id, {
      serviceName: serviceName.trim(),
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      quantityPerUnit: mult,
      updatedAt: meta.updatedAt
    });
  } else {
    await db.serviceItemLinks.add({
      serviceName: serviceName.trim(),
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      quantityPerUnit: mult,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt
    });
  }

  // 2. Update service in db.services if it exists
  const targetService = serviceId 
    ? await db.services.get(serviceId)
    : await db.services.filter(s => s.name.toLowerCase().trim() === serviceName.toLowerCase().trim()).first();

  if (targetService && targetService.id) {
    await db.services.update(targetService.id, {
      linkedInventoryItemId: item.id,
      linkedInventoryItemName: item.name,
      deductQuantity: mult,
      updatedAt: meta.updatedAt
    });
  }
}

/**
 * Unlink a sales service from inventory stock
 */
export async function unlinkServiceFromInventory(
  serviceName: string,
  serviceId?: number
): Promise<void> {
  const meta = getRecordMetadata();

  // 1. Delete from serviceItemLinks
  const links = await db.serviceItemLinks
    .filter(l => l.serviceName.toLowerCase().trim() === serviceName.toLowerCase().trim())
    .toArray();

  for (const l of links) {
    if (l.id) await db.serviceItemLinks.delete(l.id);
  }

  // 2. Clear link on service in db.services
  const targetService = serviceId 
    ? await db.services.get(serviceId)
    : await db.services.filter(s => s.name.toLowerCase().trim() === serviceName.toLowerCase().trim()).first();

  if (targetService && targetService.id) {
    await db.services.update(targetService.id, {
      linkedInventoryItemId: undefined,
      linkedInventoryItemName: undefined,
      deductQuantity: undefined,
      updatedAt: meta.updatedAt
    });
  }
}

/**
 * Find all matching inventory links for a given service name
 * Matches via:
 * 1. Direct ServiceRate link in db.services
 * 2. db.serviceItemLinks exact match
 * 3. db.serviceItemLinks partial match
 * 4. Studio keyword heuristics (Photocopy, Print, Photo, NID, Lamination)
 * 5. Direct inventory item name match
 */
export async function findLinksForServiceName(serviceName: string): Promise<ServiceItemLink[]> {
  if (!serviceName || !serviceName.trim()) return [];
  const sClean = serviceName.trim().toLowerCase();

  // 1. Check if db.services has a direct link
  const registeredService = await db.services
    .filter(s => s.name.trim().toLowerCase() === sClean)
    .first();

  if (registeredService && registeredService.linkedInventoryItemId) {
    const inv = await db.inventory.get(registeredService.linkedInventoryItemId);
    if (inv && inv.id) {
      return [{
        serviceName: registeredService.name,
        inventoryItemId: inv.id,
        inventoryItemName: inv.name,
        quantityPerUnit: registeredService.deductQuantity || 1
      }];
    }
  }

  const allLinks = await db.serviceItemLinks.toArray();

  // 2. Exact match in serviceItemLinks
  const exact = allLinks.filter(l => l.serviceName.trim().toLowerCase() === sClean);
  if (exact.length > 0) return exact;

  // 3. Contains match (service name includes link's serviceName or vice versa)
  const contains = allLinks.filter(l => {
    const lName = l.serviceName.trim().toLowerCase();
    return sClean.includes(lName) || lName.includes(sClean);
  });
  if (contains.length > 0) return contains;

  // 4. Keyword-based studio heuristics
  // A. Lamination check first (so "NID Card Lamination" is not treated as "NID Card Print")
  if (sClean.includes('lamination')) {
    if (sClean.includes('nid')) {
      const nidLam = allLinks.filter(l => 
        l.serviceName.toLowerCase().includes('nid') &&
        l.serviceName.toLowerCase().includes('lamination')
      );
      if (nidLam.length > 0) return nidLam;
    }
    const generalLam = allLinks.filter(l => 
      l.serviceName.toLowerCase().includes('lamination')
    );
    if (generalLam.length > 0) return generalLam;
  }

  // B. NID check: "NID print / NID card" automatically consumes photo paper
  if (sClean.includes('nid') || sClean.includes('national id')) {
    const nidPrint = allLinks.filter(l => 
      l.serviceName.toLowerCase().includes('nid') &&
      !l.serviceName.toLowerCase().includes('lamination')
    );
    if (nidPrint.length > 0) return nidPrint;

    // Fallback: any photo paper link
    const photoPaperLink = allLinks.filter(l => 
      l.inventoryItemName.toLowerCase().includes('photo') || 
      l.serviceName.toLowerCase().includes('photo')
    );
    if (photoPaperLink.length > 0) return photoPaperLink;
  }

  // C. Photo check: "photo print / passport photo" automatically consumes photo paper
  if (
    sClean.includes('photo') || 
    sClean.includes('passport') || 
    sClean.includes('4r') ||
    sClean.includes('picture') ||
    sClean.includes('image')
  ) {
    const photoMatch = allLinks.filter(l => 
      l.serviceName.toLowerCase().includes('photo') || 
      l.serviceName.toLowerCase().includes('passport') ||
      l.inventoryItemName.toLowerCase().includes('photo')
    );
    if (photoMatch.length > 0) return photoMatch;
  }

  // D. Photocopy & Print check: automatically consumes A4 plain paper
  if (
    sClean.includes('photocopy') || 
    sClean.includes('copy') || 
    sClean.includes('print')
  ) {
    const copyMatch = allLinks.filter(l => 
      l.serviceName.toLowerCase().includes('photocopy') || 
      l.serviceName.toLowerCase().includes('print') ||
      l.inventoryItemName.toLowerCase().includes('plain paper') ||
      l.inventoryItemName.toLowerCase().includes('a4')
    );
    if (copyMatch.length > 0) return copyMatch;
  }

  // 5. Fallback: direct match with an inventory item name
  const allInv = await db.inventory.toArray();
  const directMatch = allInv.find(
    inv => inv.name.toLowerCase().trim() === sClean
  );
  if (directMatch && directMatch.id) {
    return [{
      serviceName,
      inventoryItemId: directMatch.id,
      inventoryItemName: directMatch.name,
      quantityPerUnit: 1
    }];
  }

  return [];
}

/**
 * Get the real-time stock impact for a service name and quantity.
 * Supports explicit override for interactive SalesEntry selection.
 */
export async function getServiceStockImpact(
  serviceName: string, 
  quantity: number = 1,
  overrideInventoryItemId?: number | 'auto' | 'none',
  overrideQuantityMultiplier?: number
): Promise<ServiceStockImpact> {
  const qty = Math.max(1, Number(quantity) || 1);

  // If user explicitly chose "none"
  if (overrideInventoryItemId === 'none') {
    return { isLinked: false, links: [] };
  }

  // If user explicitly selected a specific inventory item
  if (typeof overrideInventoryItemId === 'number' && overrideInventoryItemId > 0) {
    const item = await db.inventory.get(overrideInventoryItemId);
    if (item && item.id) {
      const mult = Math.max(1, Number(overrideQuantityMultiplier) || 1);
      const totalDeduct = qty * mult;
      const currentStock = Number(item.currentStock || 0);
      return {
        isLinked: true,
        links: [{
          inventoryItemId: item.id,
          inventoryItemName: item.name,
          quantityPerUnit: mult,
          totalDeduct,
          currentStock,
          unit: item.unit || 'sheets',
          isLowStock: currentStock <= (item.minAlertStock || 10) && currentStock > 0,
          isOutOfStock: currentStock === 0 || currentStock < totalDeduct
        }]
      };
    }
  }

  if (!serviceName || !serviceName.trim()) {
    return { isLinked: false, links: [] };
  }

  const links = await findLinksForServiceName(serviceName);
  if (links.length > 0) {
    const results = [];
    for (const link of links) {
      const item = await db.inventory.get(link.inventoryItemId);
      if (item && item.id) {
        const mult = link.quantityPerUnit > 0 ? link.quantityPerUnit : 1;
        const totalDeduct = qty * mult;
        const currentStock = Number(item.currentStock || 0);
        results.push({
          linkId: link.id,
          inventoryItemId: item.id,
          inventoryItemName: item.name,
          quantityPerUnit: mult,
          totalDeduct,
          currentStock,
          unit: item.unit || 'sheets',
          isLowStock: currentStock <= (item.minAlertStock || 10) && currentStock > 0,
          isOutOfStock: currentStock === 0 || currentStock < totalDeduct
        });
      }
    }
    return { isLinked: results.length > 0, links: results };
  }

  return { isLinked: false, links: [] };
}

/**
 * Deduct inventory stock for a sale based on linked service rules or explicit stock item choice
 */
export async function deductInventoryForService(
  serviceName: string, 
  saleQuantity: number,
  overrideInventoryItemId?: number | 'auto' | 'none',
  overrideQuantityMultiplier?: number
): Promise<ConsumedItemRecord[]> {
  const qty = Math.max(1, Number(saleQuantity) || 1);

  // If explicitly requested no stock deduction
  if (overrideInventoryItemId === 'none') {
    return [];
  }

  // If user explicitly chose a specific inventory item on the sales form
  if (typeof overrideInventoryItemId === 'number' && overrideInventoryItemId > 0) {
    const item = await db.inventory.get(overrideInventoryItemId);
    if (item && item.id) {
      const mult = Math.max(1, Number(overrideQuantityMultiplier) || 1);
      const totalDeduct = qty * mult;
      const currentStock = Number(item.currentStock || 0);
      const newStock = Math.max(0, currentStock - totalDeduct);

      await db.inventory.update(item.id, {
        currentStock: newStock,
        updatedAt: new Date().toISOString()
      });

      return [{
        inventoryItemId: item.id,
        inventoryItemName: item.name,
        quantity: totalDeduct
      }];
    }
  }

  const links = await findLinksForServiceName(serviceName);
  const consumed: ConsumedItemRecord[] = [];

  if (links.length > 0) {
    for (const link of links) {
      const item = await db.inventory.get(link.inventoryItemId);
      if (item && item.id) {
        const multiplier = link.quantityPerUnit > 0 ? link.quantityPerUnit : 1;
        const totalDeduct = qty * multiplier;
        const currentStock = Number(item.currentStock || 0);
        const newStock = Math.max(0, currentStock - totalDeduct);

        await db.inventory.update(item.id, {
          currentStock: newStock,
          updatedAt: new Date().toISOString()
        });

        consumed.push({
          inventoryItemId: item.id,
          inventoryItemName: item.name,
          quantity: totalDeduct
        });
      }
    }
  }

  return consumed;
}

/**
 * Restore inventory stock when a sale or due is deleted
 */
export async function restoreInventoryForSale(
  consumedItems?: ConsumedItemRecord[],
  fallbackServiceName?: string,
  fallbackQty?: number
): Promise<void> {
  if (consumedItems && consumedItems.length > 0) {
    for (const c of consumedItems) {
      const item = await db.inventory.get(c.inventoryItemId);
      if (item && item.id) {
        const currentStock = Number(item.currentStock || 0);
        await db.inventory.update(item.id, {
          currentStock: currentStock + Number(c.quantity || 1),
          updatedAt: new Date().toISOString()
        });
      }
    }
    return;
  }

  // Fallback for legacy sales before consumedItems tracking
  if (fallbackServiceName) {
    const qty = Math.max(1, Number(fallbackQty) || 1);
    const links = await findLinksForServiceName(fallbackServiceName);
    if (links.length > 0) {
      for (const link of links) {
        const item = await db.inventory.get(link.inventoryItemId);
        if (item && item.id) {
          const currentStock = Number(item.currentStock || 0);
          const multiplier = link.quantityPerUnit > 0 ? link.quantityPerUnit : 1;
          await db.inventory.update(item.id, {
            currentStock: currentStock + (qty * multiplier),
            updatedAt: new Date().toISOString()
          });
        }
      }
      return;
    }

    const allInv = await db.inventory.toArray();
    const directMatch = allInv.find(
      inv => inv.name.toLowerCase().trim() === fallbackServiceName.toLowerCase().trim()
    );
    if (directMatch && directMatch.id) {
      const currentStock = Number(directMatch.currentStock || 0);
      await db.inventory.update(directMatch.id, {
        currentStock: currentStock + qty,
        updatedAt: new Date().toISOString()
      });
    }
  }
}
