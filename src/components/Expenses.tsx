import React, { useState } from 'react';
import { db, Expense, getRecordMetadata } from '../db/db';
import { adjustAccountBalance, mapPaymentMethodToAccountId } from '../services/accountService';
import { format } from 'date-fns';
import { CheckCircle2, Circle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';

const DEFAULT_EXPENSE_SERVICES = [
  'Shop Rent',
  'Electricity Bill',
  'Internet Bill',
  'Paper/Ink Purchase',
  'Snacks/Tea'
];

export function Expenses() {

  const expenseServices = useLiveQuery(() => db.expenseServices.toArray()) || [];

  useEffect(() => {
    // Seed default expense services if empty
    const seed = async () => {
      const count = await db.expenseServices.count();
      if (count === 0) {
        for (const name of DEFAULT_EXPENSE_SERVICES) {
          await db.expenseServices.add({ name });
        }
      }
    };
    seed();
  }, []);

  const [selectedService, setSelectedService] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedService) {
      alert("Select Service Name!");
      return;
    }

    const price = parseFloat(buyingPrice) || 0;
    
    if (price <= 0) {
      alert("Enter correct amount!");
      return;
    }

    let finalTitle = selectedService;
    if (selectedService === 'Other') {
      if (!customServiceName) {
        alert("Enter custom service name!");
        return;
      }
      finalTitle = customServiceName;
    }

    const qtyString = quantity.trim() ? `Qty: ${quantity}, ` : '';

    const meta = getRecordMetadata();

    const newExpense: Expense = {
      date: meta.date,
      time: meta.time,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      title: `${finalTitle} (${qtyString}Pay: ${paymentMethod})`,
      amount: price,
      category: finalTitle,
      note
    };

    await db.expenses.add(newExpense);
    
    // Deduct expense from corresponding account
    try {
      const targetAccountId = mapPaymentMethodToAccountId(paymentMethod) || 'cash';
      await adjustAccountBalance(targetAccountId, -price);
    } catch (err) {
      console.error('Failed to update account balance on expense:', err);
    }
    
    setSuccess(true);
    setSelectedService('');
    setCustomServiceName('');
    setBuyingPrice('');
    setQuantity('');
    setPaymentMethod('Cash');
    setNote('');
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="p-4 md:p-6 mx-auto mb-4 md:mb-0 w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 uppercase tracking-wider">New Expense Entry</h1>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {success && (
          <div className="mb-6 p-4 bg-gray-100 border border-[#084b3e] rounded-xl flex items-center text-gray-900 font-bold text-sm uppercase tracking-wider">
            <CheckCircle2 className="mr-2" size={18} />
            Saved successfully!
          </div>
        )}

        <form onSubmit={handleAddExpense} className="space-y-6">
          
          {/* Service Name (Dropdown) */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Service Name</label>
            <select 
              required
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none font-medium bg-white"
            >
              <option value="" disabled>Select a service...</option>
              {expenseServices.map(service => (
                <option key={service.id} value={service.name}>{service.name}</option>
              ))}
              <option value="Other" className="font-bold">Other</option>
                
            </select>
          </div>

          {/* Custom Service Name (Only if 'Other' is selected) */}
          {selectedService === 'Other' && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Custom Name</label>
              <input 
                type="text" 
                required
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                placeholder="Enter name..."
                className="w-full p-3 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none font-medium"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Buying Price */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Buying Price</label>
              <input 
                type="number" 
                required
                value={buyingPrice}
                onChange={(e) => setBuyingPrice(e.target.value)}
                placeholder="0.00"
                className="w-full p-3 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none font-medium"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Quantity (Optional)</label>
              <input 
                type="text" 
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 1 box, 2 pcs"
                className="w-full p-3 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none font-black text-lg"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Note (Optional)</label>
            <input 
              type="text" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter any note or info..."
              className="w-full p-3 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none font-medium"
            />
          </div>

          {/* Payment Method (Checkboxes) */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Payment Method</label>
            <div className="flex flex-wrap gap-4">
              {['Cash', 'bKash', 'Nagad', 'Rocket', 'Due'].map(method => {
                const isSelected = paymentMethod === method;
                return (
                  <label 
                    key={method} 
                    className={`flex items-center space-x-2 cursor-pointer p-3 border rounded-md transition-all ${isSelected ? 'border-[#084b3e] bg-[#084b3e] text-white' : 'border-gray-300 bg-white text-gray-900 hover:border-[#084b3e]'}`}
                  >
                    {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-gray-300" />}
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value={method}
                      checked={isSelected}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="hidden"
                    />
                    <span className="font-bold text-sm">{method}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <button 
              type="submit"
              className="w-full bg-[#084b3e] hover:bg-[#126b55] text-white font-black py-4 px-4 rounded-md transition-all shadow-md uppercase tracking-widest text-lg"
            >
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
