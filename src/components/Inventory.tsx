import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, InventoryItem, InventoryCategory, InventoryUnit } from '../db/db';
import { 
  initDefaultInventory, addInventoryItem, updateInventoryItem, 
  deleteInventoryItem, restockInventoryItem, consumeInventoryItem 
} from '../services/inventoryService';
import { 
  Package, AlertTriangle, Plus, Search, 
  TrendingDown, CheckCircle2, X, Edit2, 
  Trash2, DollarSign, Check, Loader2, ArrowUpDown, Zap,
  PlusCircle, MinusCircle
} from 'lucide-react';

const CATEGORIES: InventoryCategory[] = [
  'Photo Paper',
  'Plain Paper',
  'Printer Ink',
  'Lamination',
  'Photo Frames',
  'PVC & Cards',
  'Other'
];

const UNITS: InventoryUnit[] = ['sheets', 'packs', 'reams', 'bottles', 'pieces', 'units'];

export function Inventory() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [consumeItem, setConsumeItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  // Form states for Add / Edit
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<InventoryCategory>('Photo Paper');
  const [formStock, setFormStock] = useState('');
  const [formUnit, setFormUnit] = useState<InventoryUnit>('sheets');
  const [formMinAlert, setFormMinAlert] = useState('20');
  const [formUnitCost, setFormUnitCost] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formNote, setFormNote] = useState('');

  // Form states for Restock
  const [restockQty, setRestockQty] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restockNote, setRestockNote] = useState('');

  // Form states for Consume
  const [consumeQty, setConsumeQty] = useState('');
  const [consumeReason, setConsumeReason] = useState('Customer Print');

  // Notification message
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live Query
  const items = useLiveQuery(() => db.inventory.toArray(), []) || [];
  const services = useLiveQuery(() => db.services.toArray(), []) || [];
  const serviceItemLinks = useLiveQuery(() => db.serviceItemLinks.toArray(), []) || [];

  // Auto initialize defaults if empty
  useEffect(() => {
    initDefaultInventory();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormStock(String(item.currentStock));
    setFormUnit(item.unit);
    setFormMinAlert(String(item.minAlertStock));
    setFormUnitCost(String(item.unitCost));
    setFormSellingPrice(item.sellingPrice ? String(item.sellingPrice) : '');
    setFormSupplier(item.supplier || '');
    setFormNote(item.note || '');
    setIsAddModalOpen(true);
  };

  const closeFormModal = () => {
    setIsAddModalOpen(false);
    setEditingItem(null);
    setFormName('');
    setFormCategory('Photo Paper');
    setFormStock('');
    setFormUnit('sheets');
    setFormMinAlert('20');
    setFormUnitCost('');
    setFormSellingPrice('');
    setFormSupplier('');
    setFormNote('');
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('error', 'Please enter item name.');
      return;
    }

    const currentStock = Number(formStock) || 0;
    const minAlertStock = Number(formMinAlert) || 10;
    const unitCost = Number(formUnitCost) || 0;
    const sellingPrice = formSellingPrice ? Number(formSellingPrice) : undefined;

    try {
      if (editingItem && editingItem.id) {
        await updateInventoryItem(editingItem.id, {
          name: formName.trim(),
          category: formCategory,
          currentStock,
          unit: formUnit,
          minAlertStock,
          unitCost,
          sellingPrice,
          supplier: formSupplier.trim() || undefined,
          note: formNote.trim() || undefined,
        });
        showToast('success', `Item "${formName}" updated.`);
      } else {
        await addInventoryItem({
          name: formName.trim(),
          category: formCategory,
          currentStock,
          unit: formUnit,
          minAlertStock,
          unitCost,
          sellingPrice,
          supplier: formSupplier.trim() || undefined,
          note: formNote.trim() || undefined,
        });
        showToast('success', `Item "${formName}" added.`);
      }
      closeFormModal();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save item.');
    }
  };

  const handleSaveRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem || !restockItem.id) return;
    const addQty = Number(restockQty);
    if (!addQty || addQty <= 0) {
      showToast('error', 'Please enter a valid quantity.');
      return;
    }

    const newCost = restockCost ? Number(restockCost) : undefined;

    try {
      await restockInventoryItem(restockItem.id, addQty, newCost, restockNote);
      showToast('success', `Restocked +${addQty} ${restockItem.unit}.`);
      setRestockItem(null);
      setRestockQty('');
      setRestockCost('');
      setRestockNote('');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to restock item.');
    }
  };

  const handleSaveConsume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumeItem || !consumeItem.id) return;
    const reduceQty = Number(consumeQty);
    if (!reduceQty || reduceQty <= 0) {
      showToast('error', 'Please enter a valid quantity.');
      return;
    }

    try {
      await consumeInventoryItem(consumeItem.id, reduceQty, consumeReason);
      showToast('success', `Used ${reduceQty} ${consumeItem.unit}.`);
      setConsumeItem(null);
      setConsumeQty('');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to deduct stock.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteTarget.id) return;
    try {
      await deleteInventoryItem(deleteTarget.id, deleteTarget.name);
      showToast('success', `Item deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete item.');
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    let totalItems = items.length;
    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    items.forEach(item => {
      const stock = Number(item.currentStock || 0);
      const cost = Number(item.unitCost || 0);
      totalValuation += stock * cost;

      if (stock === 0) {
        outOfStockCount++;
        lowStockCount++;
      } else if (stock <= Number(item.minAlertStock || 0)) {
        lowStockCount++;
      }
    });

    return { totalItems, totalValuation, lowStockCount, outOfStockCount };
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.note && item.note.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesLowStock = !showLowStockOnly || (Number(item.currentStock || 0) <= Number(item.minAlertStock || 0));

      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [items, searchQuery, selectedCategory, showLowStockOnly]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto mb-16 md:mb-0 space-y-4">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 border text-xs font-bold animate-fadeIn ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Inventory</h1>
          <p className="text-xs text-gray-500 font-medium">Studio stock & supplies</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/inventory/rules')}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            title="Configure automatic paper and stock deduction rules for services"
          >
            <Zap size={14} className="text-amber-600 fill-amber-500/20" />
            <span className="hidden sm:inline">Service Stock Rules</span>
            <span className="sm:hidden">Rules</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Clean 4-Card Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Items */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Total Items</span>
          <div className="text-lg font-black text-gray-900 mt-0.5">{metrics.totalItems}</div>
        </div>

        {/* Stock Value */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Stock Value</span>
          <div className="text-lg font-black text-emerald-800 mt-0.5">Tk {metrics.totalValuation.toLocaleString()}</div>
        </div>

        {/* Low Stock Alert */}
        <button
          type="button"
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            metrics.lowStockCount > 0
              ? showLowStockOnly
                ? 'bg-amber-100/80 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
                : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/60'
              : 'bg-white border-gray-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">Low Stock</span>
            {showLowStockOnly && (
              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded">Active</span>
            )}
          </div>
          <div className="text-lg font-black text-amber-900 mt-0.5">{metrics.lowStockCount}</div>
        </button>

        {/* Out of Stock */}
        <div className={`p-3.5 rounded-xl border shadow-xs ${
          metrics.outOfStockCount > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-gray-100'
        }`}>
          <span className={`text-[11px] font-semibold uppercase tracking-wider block ${
            metrics.outOfStockCount > 0 ? 'text-rose-600' : 'text-gray-500'
          }`}>Out of Stock</span>
          <div className={`text-lg font-black mt-0.5 ${
            metrics.outOfStockCount > 0 ? 'text-rose-700' : 'text-gray-900'
          }`}>{metrics.outOfStockCount}</div>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-xs flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, supplier..."
            className="w-full pl-8 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Categories Quick Filter */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 outline-none focus:border-[#084b3e] cursor-pointer"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {showLowStockOnly && (
            <button
              type="button"
              onClick={() => setShowLowStockOnly(false)}
              className="text-xs font-bold text-rose-600 hover:underline px-2 py-1 cursor-pointer whitespace-nowrap"
            >
              Clear Low Stock Filter
            </button>
          )}
        </div>
      </div>

      {/* Inventory Table / Clean List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-xs">
            No items found.
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            {/* Desktop / Tablet Table View */}
            <div className="hidden sm:block w-full overflow-hidden">
              <table className="w-full text-left text-xs table-fixed">
                <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="py-2.5 px-3 w-[28%]">Item Name</th>
                    <th className="py-2.5 px-3 w-[14%]">Category</th>
                    <th className="py-2.5 px-3 w-[11%] text-right">Available Stock</th>
                    <th className="py-2.5 px-3 w-[12%] text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 w-[13%] text-right">Total Value</th>
                    <th className="py-2.5 px-2 w-[22%] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map(item => {
                    const stock = Number(item.currentStock || 0);
                    const minAlert = Number(item.minAlertStock || 0);
                    const isLow = stock <= minAlert && stock > 0;
                    const isOut = stock === 0;
                    const totalVal = stock * Number(item.unitCost || 0);

                    // Find which sales services are linked to this stock item
                    const linkedServicesFromDB = services
                      .filter(s => s.linkedInventoryItemId === item.id)
                      .map(s => s.name);
                    const linkedServicesFromLinks = serviceItemLinks
                      .filter(l => l.inventoryItemId === item.id)
                      .map(l => l.serviceName);
                    const allLinkedServiceNames = Array.from(new Set([...linkedServicesFromDB, ...linkedServicesFromLinks]));

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* Name, Supplier & Linked Services */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-gray-900 truncate" title={item.name}>{item.name}</div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {item.supplier && (
                              <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{item.supplier}</span>
                            )}
                            {allLinkedServiceNames.length > 0 && (
                              <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60 font-semibold truncate max-w-full">
                                Auto-cuts for: {allLinkedServiceNames.slice(0, 2).join(', ')}{allLinkedServiceNames.length > 2 ? ` +${allLinkedServiceNames.length - 2}` : ''}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 inline-block truncate max-w-full">
                            {item.category}
                          </span>
                        </td>

                        {/* Available Stock with status badge */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <span className="font-black text-gray-900 whitespace-nowrap">
                              {stock} {item.unit}
                            </span>
                            {isOut ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 shrink-0">
                                Out
                              </span>
                            ) : isLow ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                                Low
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Unit Cost */}
                        <td className="py-2.5 px-3 text-right text-gray-700 font-semibold whitespace-nowrap">
                          Tk {item.unitCost}
                        </td>

                        {/* Total Value */}
                        <td className="py-2.5 px-3 text-right font-black text-[#084b3e] whitespace-nowrap">
                          Tk {totalVal.toLocaleString()}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setRestockItem(item);
                                setRestockCost(String(item.unitCost));
                              }}
                              className="p-2 text-gray-600 hover:text-[#084b3e] hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                              title="Restock (+)"
                            >
                              <PlusCircle size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setConsumeItem(item)}
                              className="p-2 text-gray-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                              title="Use / Deduct (-)"
                            >
                              <MinusCircle size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="p-2 text-gray-600 hover:text-[#084b3e] hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                              title="Edit Item"
                            >
                              <Edit2 size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card / List View (Zero Horizontal Scroll on Mobile) */}
            <div className="block sm:hidden divide-y divide-gray-100">
              {filteredItems.map(item => {
                const stock = Number(item.currentStock || 0);
                const minAlert = Number(item.minAlertStock || 0);
                const isLow = stock <= minAlert && stock > 0;
                const isOut = stock === 0;
                const totalVal = stock * Number(item.unitCost || 0);

                const linkedServicesFromDB = services
                  .filter(s => s.linkedInventoryItemId === item.id)
                  .map(s => s.name);
                const linkedServicesFromLinks = serviceItemLinks
                  .filter(l => l.inventoryItemId === item.id)
                  .map(l => l.serviceName);
                const allLinkedServiceNames = Array.from(new Set([...linkedServicesFromDB, ...linkedServicesFromLinks]));

                return (
                  <div key={item.id} className="p-3 space-y-2 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-gray-900 text-xs truncate">{item.name}</div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                            {item.category}
                          </span>
                          {item.supplier && (
                            <span className="text-[10px] text-gray-400">{item.supplier}</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-black text-gray-900 text-xs">
                          {stock} {item.unit}
                        </div>
                        {isOut ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 inline-block mt-0.5">
                            Out
                          </span>
                        ) : isLow ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 inline-block mt-0.5">
                            Low
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {allLinkedServiceNames.length > 0 && (
                      <div className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-medium truncate">
                        Auto-cuts for: {allLinkedServiceNames.join(', ')}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-gray-50 text-xs">
                      <div className="text-gray-500 text-[11px]">
                        Cost: <span className="font-semibold text-gray-700">Tk {item.unitCost}</span> | Val: <span className="font-black text-[#084b3e]">Tk {totalVal.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setRestockItem(item);
                            setRestockCost(String(item.unitCost));
                          }}
                          className="p-1.5 text-gray-600 hover:text-[#084b3e] hover:bg-emerald-50 rounded-xl transition-colors"
                          title="Restock (+)"
                        >
                          <PlusCircle size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConsumeItem(item)}
                          className="p-1.5 text-gray-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors"
                          title="Use / Deduct (-)"
                        >
                          <MinusCircle size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-gray-600 hover:text-[#084b3e] hover:bg-emerald-50 rounded-xl transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ADD / EDIT MATERIAL MODAL */}
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={closeFormModal}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-xl text-[#182236] mb-6 text-center">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Item Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. 4R Glossy Photo Paper"
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as InventoryCategory)}
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none cursor-pointer transition-all"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Unit</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as InventoryUnit)}
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none cursor-pointer transition-all"
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Current Stock</label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Low Alert Level</label>
                  <input
                    type="number"
                    value={formMinAlert}
                    onChange={(e) => setFormMinAlert(e.target.value)}
                    placeholder="20"
                    min="0"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Unit Cost (Tk) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formUnitCost}
                    onChange={(e) => setFormUnitCost(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Selling Price (Tk)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    placeholder="Optional"
                    min="0"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">Supplier</label>
                <input
                  type="text"
                  value={formSupplier}
                  onChange={(e) => setFormSupplier(e.target.value)}
                  placeholder="Optional supplier..."
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer active:translate-y-px flex items-center justify-center"
                >
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESTOCK MODAL */}
      {restockItem && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => setRestockItem(null)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-xl text-[#182236] mb-1 text-center">Restock Item</h3>
            <p className="text-center text-xs text-gray-500 font-semibold mb-5">{restockItem.name}</p>

            <form onSubmit={handleSaveRestock} className="space-y-4">
              <div className="p-3 bg-[#f8f9fa] rounded-xl border border-[#dce1e7] text-xs text-gray-800 flex justify-between items-center">
                <span className="font-medium text-gray-600">Current Stock:</span>
                <strong className="text-emerald-800 font-black text-sm">{restockItem.currentStock} {restockItem.unit}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Add Quantity ({restockItem.unit}) *
                </label>
                <input
                  type="number"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  placeholder="e.g. 50"
                  min="1"
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-base font-black text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all font-mono"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  New Unit Cost (Tk) [Optional]
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={restockCost}
                  onChange={(e) => setRestockCost(e.target.value)}
                  placeholder={`Current: Tk ${restockItem.unitCost}`}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer active:translate-y-px flex items-center justify-center"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONSUME / USE MODAL */}
      {consumeItem && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => setConsumeItem(null)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-xl text-[#182236] mb-1 text-center">Use / Deduct Stock</h3>
            <p className="text-center text-xs text-gray-500 font-semibold mb-5">{consumeItem.name}</p>

            <form onSubmit={handleSaveConsume} className="space-y-4">
              <div className="p-3 bg-[#f8f9fa] rounded-xl border border-[#dce1e7] text-xs text-gray-800 flex justify-between items-center">
                <span className="font-medium text-gray-600">In Stock:</span>
                <strong className="text-[#075b4d] font-black text-sm">{consumeItem.currentStock} {consumeItem.unit}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Quantity Used ({consumeItem.unit}) *
                </label>
                <input
                  type="number"
                  value={consumeQty}
                  onChange={(e) => setConsumeQty(e.target.value)}
                  placeholder="e.g. 10"
                  min="1"
                  max={consumeItem.currentStock}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-base font-black text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all font-mono"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Reason
                </label>
                <select
                  value={consumeReason}
                  onChange={(e) => setConsumeReason(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none cursor-pointer transition-all"
                >
                  <option value="Customer Print">Customer Print</option>
                  <option value="Photocopy">Photocopy</option>
                  <option value="Damaged / Jam">Damaged / Jam</option>
                  <option value="Internal Studio Use">Internal Studio Use</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-[49px] bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer active:translate-y-px flex items-center justify-center"
                >
                  Confirm Deduction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-2 border border-red-100">
              <Trash2 size={28} strokeWidth={2.5} />
            </div>
            <h3 className="font-bold text-xl text-[#182236]">Delete Item?</h3>
            <p className="text-sm text-gray-500 font-medium">
              Are you sure you want to remove <span className="font-bold text-gray-900">"{deleteTarget.name}"</span> from inventory?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
