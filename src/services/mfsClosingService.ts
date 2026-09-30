import { db, MfsClosing, MfsTransaction, getRecordMetadata } from '../db/db';
import { recordActivityLog } from './activityLogService';
import { format } from 'date-fns';

export interface TodayMfsSummary {
  cashInTotal: number;
  cashInCount: number;
  cashOutTotal: number;
  cashOutCount: number;
  rechargeTotal: number;
  rechargeCount: number;
  dueTotal: number;
  dueCount: number;
  cashCollectedTotal: number;
  totalProfit: number;
  totalTransactions: number;
  currentSimBalances: {
    bkash: number;
    nagad: number;
    rocket: number;
    total: number;
  };
}

/**
 * Calculate today's MFS stats for a specific operator or all
 */
export async function getTodayMfsSummary(targetDate?: string, operatorFilter: 'All' | 'bKash' | 'Nagad' | 'Rocket' = 'All'): Promise<TodayMfsSummary> {
  const queryDate = targetDate || format(new Date(), 'yyyy-MM-dd');
  
  const allMfs = await db.mfs.toArray();
  const dayTransactions = allMfs.filter(t => {
    const matchesDate = t.date === queryDate;
    const matchesOp = operatorFilter === 'All' || t.operator.toLowerCase() === operatorFilter.toLowerCase();
    return matchesDate && matchesOp;
  });

  let cashInTotal = 0;
  let cashInCount = 0;
  let cashOutTotal = 0;
  let cashOutCount = 0;
  let rechargeTotal = 0;
  let rechargeCount = 0;
  let dueTotal = 0;
  let dueCount = 0;
  let cashCollectedTotal = 0;
  let totalProfit = 0;

  dayTransactions.forEach(t => {
    const amt = Number(t.amount || 0);
    const prf = Number(t.profit || 0);
    totalProfit += prf;

    if (t.isDue) {
      dueTotal += Number(t.dueAmount || 0);
      dueCount++;
    }

    if (t.type === 'Cash-In') {
      cashInTotal += amt;
      cashInCount++;
      cashCollectedTotal += t.isDue ? Number(t.paidAmount || 0) : amt;
    } else if (t.type === 'Cash-Out') {
      cashOutTotal += amt;
      cashOutCount++;
    } else if (t.type === 'Recharge' || t.type === 'Send Money') {
      rechargeTotal += amt;
      rechargeCount++;
      cashCollectedTotal += t.isDue ? Number(t.paidAmount || 0) : amt;
    }
  });

  // Get current account balances
  const bkashAcc = await db.accounts.get('bkash');
  const nagadAcc = await db.accounts.get('nagad');
  const rocketAcc = await db.accounts.get('rocket');

  const bBal = bkashAcc?.balance || 0;
  const nBal = nagadAcc?.balance || 0;
  const rBal = rocketAcc?.balance || 0;

  return {
    cashInTotal,
    cashInCount,
    cashOutTotal,
    cashOutCount,
    rechargeTotal,
    rechargeCount,
    dueTotal,
    dueCount,
    cashCollectedTotal,
    totalProfit,
    totalTransactions: dayTransactions.length,
    currentSimBalances: {
      bkash: bBal,
      nagad: nBal,
      rocket: rBal,
      total: bBal + nBal + rBal
    }
  };
}

/**
 * Record a Daily Closing & SIM Reconciliation
 */
export async function saveMfsDailyClosing(data: {
  date: string;
  operator: 'All' | 'bKash' | 'Nagad' | 'Rocket';
  simClosingBalance: number;
  drawerCashCount: number;
  systemExpectedSimBalance: number;
  systemExpectedCash: number;
  todayCashInTotal: number;
  todayCashOutTotal: number;
  todayProfitTotal: number;
  note?: string;
}): Promise<number> {
  const meta = getRecordMetadata();
  const totalCalculated = data.simClosingBalance + data.drawerCashCount;
  const expectedTotal = data.systemExpectedSimBalance + data.systemExpectedCash;
  const discrepancy = Math.round(totalCalculated - expectedTotal);

  let status: 'Balanced' | 'Surplus' | 'Shortage' = 'Balanced';
  if (discrepancy > 1) {
    status = 'Surplus';
  } else if (discrepancy < -1) {
    status = 'Shortage';
  }

  const closingRecord: MfsClosing = {
    date: data.date || meta.date,
    time: meta.time,
    operator: data.operator,
    simClosingBalance: data.simClosingBalance,
    drawerCashCount: data.drawerCashCount,
    systemExpectedSimBalance: data.systemExpectedSimBalance,
    systemExpectedCash: data.systemExpectedCash,
    totalCalculatedBalance: totalCalculated,
    discrepancy,
    status,
    todayCashInTotal: data.todayCashInTotal,
    todayCashOutTotal: data.todayCashOutTotal,
    todayProfitTotal: data.todayProfitTotal,
    note: data.note || '',
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt
  };

  const id = await db.mfsClosings.add(closingRecord);

  await recordActivityLog({
    action: 'CREATE',
    module: 'MFS',
    entityId: id,
    title: `MFS Closing: ${data.operator} (${status})`,
    details: `Discrepancy: ${discrepancy >= 0 ? '+' : ''}${discrepancy} ৳ (SIM: ৳${data.simClosingBalance}, Drawer: ৳${data.drawerCashCount})`
  });

  return id;
}

/**
 * Delete a past closing record
 */
export async function deleteMfsDailyClosing(id: number): Promise<void> {
  await db.mfsClosings.delete(id);
  await recordActivityLog({
    action: 'DELETE',
    module: 'MFS',
    entityId: id,
    title: `Deleted MFS Daily Closing Record #${id}`
  });
}
