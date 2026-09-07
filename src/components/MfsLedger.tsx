import React, { useState } from 'react';
import { db, MfsTransaction, getRecordMetadata } from '../db/db';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2 } from 'lucide-react';

export function MfsLedger() {
  const [operator, setOperator] = useState('bKash');
  const [type, setType] = useState('Cash-Out');
  const [amount, setAmount] = useState('');
  const [success, setSuccess] = useState(false);

  // Default profit calculation (approximate agent profit per 1000)
  // Cash-Out: usually 4.10 tk per 1000
  // Cash-In: usually 4.10 tk per 1000
  // These are standard Bangladesh MFS agent rates roughly.
  const calculateProfit = (amt: number) => {
    return (amt / 1000) * 4.10;
  };

  const calculateCharge = (amt: number, t: string) => {
    if (t === 'Cash-Out') return (amt / 1000) * 18.50; // standard cash out charge to customer
    return 0;
  };

  const amtNum = parseFloat(amount) || 0;
  const estimatedProfit = calculateProfit(amtNum).toFixed(2);
  const customerCharge = calculateCharge(amtNum, type).toFixed(2);

  const allMfs = useLiveQuery(() => db.mfs.toArray()) || [];
  
  // Calculate current balances
  const getBalance = (op: string) => {
    const txs = allMfs.filter(m => m.operator === op);
    return txs.length > 0 ? txs[txs.length - 1].balanceAfter : 0;
  };

  const bkashBalance = getBalance('bKash');
  const nagadBalance = getBalance('Nagad');
  const rocketBalance = getBalance('Rocket');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amtNum <= 0) return;

    let currentBal = getBalance(operator);
    let newBal = currentBal;
    
    // logic: 
    // Cash-In: Agent sends digital money to customer. Digital balance DECREASES, Cash INCREASES.
    // Cash-Out: Customer sends digital money to agent. Digital balance INCREASES, Cash DECREASES.
    if (type === 'Cash-In') {
      newBal -= amtNum;
    } else if (type === 'Cash-Out') {
      newBal += amtNum;
    }

    const meta = getRecordMetadata();

    const tx: MfsTransaction = {
      date: meta.date,
      time: meta.time,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      operator,
      type,
      amount: amtNum,
      charge: parseFloat(customerCharge),
      profit: parseFloat(estimatedProfit),
      balanceAfter: newBal
    };

    await db.mfs.add(tx);
    setSuccess(true);
    setAmount('');
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto mb-4 md:mb-0 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">MFS Ledger</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-100 rounded-xl p-4 border border-gray-100 text-center">
          <p className="text-gray-900 text-sm font-bold">bKash</p>
          <p className="text-xl font-bold text-gray-800">Tk {bkashBalance.toFixed(2)}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 text-center">
          <p className="text-orange-600 text-sm font-bold">Nagad</p>
          <p className="text-xl font-bold text-gray-800">Tk {nagadBalance.toFixed(2)}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 text-center">
          <p className="text-purple-600 text-sm font-bold">Rocket</p>
          <p className="text-xl font-bold text-gray-800">Tk {rocketBalance.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4">New Transaction</h2>
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center text-green-700">
            <CheckCircle2 className="mr-2" size={20} />
            Transaction saved successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
              <select 
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#084b3e] outline-none"
              >
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Rocket">Rocket</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
              <select 
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#084b3e] outline-none"
              >
                <option value="Cash-Out">Cash-Out</option>
                <option value="Cash-In">Cash-In</option>
                <option value="Send-Money">Send Money</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Tk)</label>
            <input 
              type="number" 
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#084b3e] outline-none"
            />
          </div>

          {amtNum > 0 && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Customer Charge:</span>
                <span className="font-bold text-gray-800">Tk {customerCharge}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Estimated Profit (Agent):</span>
                <span className="font-bold text-gray-900">Tk {estimatedProfit}</span>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button 
              type="submit"
              className="w-full bg-[#084b3e] hover:bg-[#126b55] text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
