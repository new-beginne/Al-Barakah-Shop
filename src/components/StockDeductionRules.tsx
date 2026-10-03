import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ServiceItemLink, getRecordMetadata } from '../db/db';
import { 
  ArrowLeft, Plus, Zap, Trash2, Edit2, CheckCircle2, 
  AlertCircle, Package, Search, X
} from 'lucide-react';

export function StockDeductionRules() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ServiceItemLink | null>(null);

  // Form State
  const [selectedService, setSelectedService] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | ''>('');
  const [quantityMultiplier, setQuantityMultiplier] = useState('1');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Live queries directly from user system database
  const links = useLiveQuery(() => db.serviceItemLinks.toArray()) || [];
  const inventoryItems = useLiveQuery(() => db.inventory.toArray()) || [];
  const services = useLiveQuery(() => db.services.toArray()) || [];

  const filteredLinks = links.filter(link => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      link.serviceName.toLowerCase().includes(q) ||
      link.inventoryItemName.toLowerCase().includes(q)
    );
  });

  const openAddForm = () => {
    setEditingLink(null);
    setSelectedService(services.length > 0 ? services[0].name : 'custom');
    setCustomServiceName('');
    setSelectedInventoryId(inventoryItems.length > 0 ? inventoryItems[0].id! : '');
    setQuantityMultiplier('1');
    setIsFormOpen(true);
  };

  const openEditForm = (link: ServiceItemLink) => {
    setEditingLink(link);
    const hasPreset = services.some(s => s.name.toLowerCase() === link.serviceName.toLowerCase());
    if (hasPreset) {
      setSelectedService(link.serviceName);
      setCustomServiceName('');
    } else {
      setSelectedService('custom');
      setCustomServiceName(link.serviceName);
    }
    setSelectedInventoryId(link.inventoryItemId);
    setQuantityMultiplier(String(link.quantityPerUnit || 1));
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalServiceName = selectedService === 'custom' 
      ? customServiceName.trim() 
      : selectedService.trim();

    if (!finalServiceName) {
      setErrorMsg('Please select or enter a service name.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    if (!selectedInventoryId) {
      setErrorMsg('Please choose a stock material to deduct.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    const matchedItem = inventoryItems.find(i => i.id === Number(selectedInventoryId));
    if (!matchedItem) {
      setErrorMsg('Selected stock item not found.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    const qty = Math.max(1, parseInt(quantityMultiplier, 10) || 1);
    const meta = getRecordMetadata();

    try {
      if (editingLink && editingLink.id) {
        await db.serviceItemLinks.update(editingLink.id, {
          serviceName: finalServiceName,
          inventoryItemId: matchedItem.id!,
          inventoryItemName: matchedItem.name,
          quantityPerUnit: qty,
          updatedAt: meta.updatedAt
        });
        setSuccessMsg(`Rule for "${finalServiceName}" updated.`);
      } else {
        const existing = links.find(l => l.serviceName.toLowerCase() === finalServiceName.toLowerCase());
        if (existing && existing.id) {
          await db.serviceItemLinks.update(existing.id, {
            serviceName: finalServiceName,
            inventoryItemId: matchedItem.id!,
            inventoryItemName: matchedItem.name,
            quantityPerUnit: qty,
            updatedAt: meta.updatedAt
          });
          setSuccessMsg(`Updated existing rule for "${finalServiceName}".`);
        } else {
          await db.serviceItemLinks.add({
            serviceName: finalServiceName,
            inventoryItemId: matchedItem.id!,
            inventoryItemName: matchedItem.name,
            quantityPerUnit: qty,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt
          });
          setSuccessMsg(`New rule created: "${finalServiceName}" ➔ "${matchedItem.name}".`);
        }
      }

      setIsFormOpen(false);
      setEditingLink(null);
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save deduction rule.');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await db.serviceItemLinks.delete(id);
      setDeleteConfirmId(null);
      setSuccessMsg('Deduction rule deleted.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete rule.');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto mb-16 md:mb-0 space-y-4">
      {/* Toast Notifications */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold animate-fadeIn">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold animate-fadeIn">
          <AlertCircle size={16} className="text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors cursor-pointer"
            title="Back to Inventory"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span>Stock Deduction Rules</span>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                Auto-Cut
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Automatically deduct paper, ink and materials when sales are made
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={openAddForm}
            className="px-4 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Add Deduction Rule</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-2.5">
        <Search size={16} className="text-gray-400 shrink-0 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search rules by service name or inventory item..."
          className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-gray-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Rules Table / Cards */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {filteredLinks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Sales Service</th>
                  <th className="py-3.5 px-4">Deducted Stock Item</th>
                  <th className="py-3.5 px-4 text-center">Quantity / Sale</th>
                  <th className="py-3.5 px-4 text-center">Current Stock</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLinks.map((link) => {
                  const stockItem = inventoryItems.find(i => i.id === link.inventoryItemId);
                  const isStockAvailable = stockItem ? (stockItem.currentStock || 0) > 0 : false;
                  
                  return (
                    <tr key={link.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 text-sm">{link.serviceName}</div>
                        <div className="text-[10px] text-gray-400 font-medium">Automatic Trigger</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                          <Package size={14} className="text-emerald-600" />
                          <span>{link.inventoryItemName}</span>
                        </div>
                        {stockItem && (
                          <div className="text-[10px] text-gray-400 font-medium">{stockItem.category}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-black text-xs text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">
                          {link.quantityPerUnit || 1} {stockItem?.unit || 'unit'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {stockItem ? (
                          <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md ${
                            isStockAvailable 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {stockItem.currentStock} {stockItem.unit}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {deleteConfirmId === link.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(link.id!)}
                                className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold text-[11px] hover:bg-rose-700 transition-colors cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-[11px] font-bold hover:bg-gray-200 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditForm(link)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#084b3e] transition-colors cursor-pointer"
                                title="Edit Rule"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(link.id!)}
                                className="p-1.5 hover:bg-rose-50 rounded-lg text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Delete Rule"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
              <Zap size={24} />
            </div>
            <div className="text-gray-900 font-bold text-sm">No Deduction Rules Configured</div>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Add deduction rules so selling a service automatically deducts paper, ink, or stock items.
            </p>
            <button
              type="button"
              onClick={openAddForm}
              className="px-4 py-2 bg-[#084b3e] text-white rounded-xl text-xs font-bold hover:bg-[#0c5e4e] transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Add Deduction Rule</span>
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Rule Modal (Following Universal Modal Design) */}
      {isFormOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => setIsFormOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-xl text-[#182236] mb-6 text-center">
              {editingLink ? 'Edit Deduction Rule' : 'Add New Deduction Rule'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                  Service Name *
                </label>
                <select
                  required
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] outline-none focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 cursor-pointer transition-all"
                >
                  <option value="">-- Choose Sales Service --</option>
                  {services.map(s => (
                    <option key={s.id || s.name} value={s.name}>{s.name} ({s.category})</option>
                  ))}
                  <option value="custom">+ Custom Service Name</option>
                </select>
              </div>

              {selectedService === 'custom' && (
                <div>
                  <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                    Custom Service Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={customServiceName}
                    onChange={(e) => setCustomServiceName(e.target.value)}
                    placeholder="e.g. Visa Photo, Document Scan"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl font-bold text-[#1d2939] outline-none focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 transition-all text-sm"
                    autoFocus
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                  Deduct from Stock Material *
                </label>
                <select
                  required
                  value={selectedInventoryId}
                  onChange={(e) => setSelectedInventoryId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] outline-none focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 cursor-pointer transition-all"
                >
                  <option value="">-- Choose Stock Material --</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.currentStock} {item.unit} in stock)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] mb-1.5 uppercase tracking-wider">
                  Quantity to Deduct per Sale *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    value={quantityMultiplier}
                    onChange={(e) => setQuantityMultiplier(e.target.value)}
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-black text-[#1d2939] outline-none focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 font-mono transition-all"
                    placeholder="1"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                    Unit(s)
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer active:translate-y-px flex items-center justify-center"
                >
                  {editingLink ? 'Update Rule' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
