import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, InventoryItem, InventoryCategory, InventoryUnit } from '../db/db';
import { 
  initDefaultInventory, addInventoryItem, updateInventoryItem, 
  deleteInventoryItem, restockInventoryItem, consumeInventoryItem 
} from '../services/inventoryService';
import { 
  Package, AlertTriangle, Plus, Search, 
  TrendingDown, CheckCircle2, X, Edit2, 
  Trash2, DollarSign, Check, Loader2, ArrowUpDown
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

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>Add Item</span>
        </button>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-3.5">Item Name</th>
                  <th className="py-2.5 px-3.5">Category</th>
                  <th className="py-2.5 px-3.5 text-right">Available Stock</th>
                  <th className="py-2.5 px-3.5 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3.5 text-right">Total Value</th>
                  <th className="py-2.5 px-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map(item => {
                  const stock = Number(item.currentStock || 0);
                  const minAlert = Number(item.minAlertStock || 0);
                  const isLow = stock <= minAlert && stock > 0;
                  const isOut = stock === 0;
                  const totalVal = stock * Number(item.unitCost || 0);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Name & Supplier */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-bold text-gray-900">{item.name}</div>
                        {item.supplier && (
                          <span className="text-[10px] text-gray-400">{item.supplier}</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                          {item.category}
                        </span>
                      </td>

                      {/* Available Stock with status badge */}
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-black text-gray-900">
                            {stock} {item.unit}
                          </span>
                          {isOut ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              Out
                            </span>
                          ) : isLow ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Low
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Unit Cost */}
                      <td className="py-2.5 px-3.5 text-right text-gray-700 font-semibold">
                        Tk {item.unitCost}
                      </td>

                      {/* Total Value */}
                      <td className="py-2.5 px-3.5 text-right font-black text-[#084b3e]">
                        Tk {totalVal.toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setRestockItem(item);
                              setRestockCost(String(item.unitCost));
                            }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#084b3e] rounded-lg text-[11px] font-bold border border-emerald-200 transition-colors cursor-pointer"
                          >
                            + Restock
                          </button>

                          <button
                            type="button"
                            onClick={() => setConsumeItem(item)}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-bold border border-gray-200 transition-colors cursor-pointer"
                          >
                            - Use
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT MATERIAL MODAL */}
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
          onClick={closeFormModal}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-900">
                {editingItem ? 'Edit Item' : 'Add Item'}
              </h3>
              <button 
                type="button" 
                onClick={closeFormModal}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. 4R Glossy Photo Paper"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as InventoryCategory)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Unit</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as InventoryUnit)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none cursor-pointer"
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Current Stock</label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Low Alert Level</label>
                  <input
                    type="number"
                    value={formMinAlert}
                    onChange={(e) => setFormMinAlert(e.target.value)}
                    placeholder="20"
                    min="0"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Unit Cost (Tk) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formUnitCost}
                    onChange={(e) => setFormUnitCost(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Selling Price (Tk)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    placeholder="Optional"
                    min="0"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier</label>
                <input
                  type="text"
                  value={formSupplier}
                  onChange={(e) => setFormSupplier(e.target.value)}
                  placeholder="Optional supplier..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="flex-1 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#084b3e] hover:bg-[#0c5e4e] rounded-xl cursor-pointer shadow-xs"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
          onClick={() => setRestockItem(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden border border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Restock Item</h3>
                <p className="text-[11px] text-gray-500">{restockItem.name}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setRestockItem(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveRestock} className="p-4 space-y-3">
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-900 flex justify-between">
                <span>Current Stock:</span>
                <strong>{restockItem.currentStock} {restockItem.unit}</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Add Quantity ({restockItem.unit}) *
                </label>
                <input
                  type="number"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  placeholder="e.g. 50"
                  min="1"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  New Unit Cost (Tk) [Optional]
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={restockCost}
                  onChange={(e) => setRestockCost(e.target.value)}
                  placeholder={`Current: Tk ${restockItem.unitCost}`}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="flex-1 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#084b3e] hover:bg-[#0c5e4e] rounded-xl cursor-pointer shadow-xs"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
          onClick={() => setConsumeItem(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden border border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Use / Deduct Stock</h3>
                <p className="text-[11px] text-gray-500">{consumeItem.name}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setConsumeItem(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveConsume} className="p-4 space-y-3">
              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-800 flex justify-between">
                <span>In Stock:</span>
                <strong>{consumeItem.currentStock} {consumeItem.unit}</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Quantity Used ({consumeItem.unit}) *
                </label>
                <input
                  type="number"
                  value={consumeQty}
                  onChange={(e) => setConsumeQty(e.target.value)}
                  placeholder="e.g. 10"
                  min="1"
                  max={consumeItem.currentStock}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason
                </label>
                <select
                  value={consumeReason}
                  onChange={(e) => setConsumeReason(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#084b3e] outline-none cursor-pointer"
                >
                  <option value="Customer Print">Customer Print</option>
                  <option value="Photocopy">Photocopy</option>
                  <option value="Damaged / Jam">Damaged / Jam</option>
                  <option value="Internal Studio Use">Internal Studio Use</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConsumeItem(null)}
                  className="flex-1 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl cursor-pointer shadow-xs"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
          onClick={() => setDeleteTarget(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-xs w-full p-4 text-center space-y-3 border border-gray-100 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Delete Item?</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Remove "{deleteTarget.name}"?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
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
