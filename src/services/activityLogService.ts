import { db, ActivityLog } from '../db/db';
import { format } from 'date-fns';

export async function recordActivityLog(entry: {
  action: 'DELETE' | 'EDIT' | 'BULK_DELETE' | 'RESET' | 'CREATE';
  module: 'Sales' | 'Expenses' | 'MFS' | 'Dues' | 'Customers' | 'Borrowings' | 'Services' | 'Balance' | 'All Data' | 'System';
  entityId?: string | number;
  title: string;
  details?: string;
  meta?: Record<string, any>;
}): Promise<number | undefined> {
  try {
    const now = new Date();
    const log: ActivityLog = {
      date: format(now, 'yyyy-MM-dd'),
      time: format(now, 'hh:mm:ss a'),
      timestamp: now.toISOString(),
      action: entry.action,
      module: entry.module,
      entityId: entry.entityId,
      title: entry.title,
      details: entry.details,
      meta: entry.meta,
    };
    return await db.activityLogs.add(log);
  } catch (error) {
    console.error('Failed to record activity log:', error);
    return undefined;
  }
}

export async function clearAllActivityLogs(): Promise<void> {
  await db.activityLogs.clear();
}

export async function deleteActivityLog(id: number): Promise<void> {
  await db.activityLogs.delete(id);
}

// Specialized logging helpers
export async function logSaleDelete(sale: {
  id?: number;
  serviceName: string;
  amount: number;
  paymentMethod: string;
  customerName?: string;
  date: string;
  cost?: number;
  profit?: number;
}) {
  const cust = sale.customerName ? ` • Customer: ${sale.customerName}` : '';
  await recordActivityLog({
    action: 'DELETE',
    module: 'Sales',
    entityId: sale.id,
    title: `Deleted Sale #${sale.id || ''}: ${sale.serviceName} (Tk ${sale.amount.toLocaleString()})`,
    details: `Payment: ${sale.paymentMethod}${cust} • Date: ${sale.date} • Profit: Tk ${(sale.profit || 0).toLocaleString()}`,
    meta: { sale },
  });
}

export async function logExpenseDelete(expense: {
  id?: number;
  title: string;
  amount: number;
  category: string;
  paymentMethod?: string;
  date: string;
  note?: string;
}) {
  await recordActivityLog({
    action: 'DELETE',
    module: 'Expenses',
    entityId: expense.id,
    title: `Deleted Expense #${expense.id || ''}: ${expense.title} (Tk ${expense.amount.toLocaleString()})`,
    details: `Category: ${expense.category} • Method: ${expense.paymentMethod || 'Cash'} • Date: ${expense.date}${expense.note ? ` • Note: ${expense.note}` : ''}`,
    meta: { expense },
  });
}

export async function logMfsDelete(mfs: {
  id?: number;
  operator: string;
  type: string;
  amount: number;
  charge: number;
  profit: number;
  recipientNumber?: string;
  date: string;
}) {
  await recordActivityLog({
    action: 'DELETE',
    module: 'MFS',
    entityId: mfs.id,
    title: `Deleted MFS #${mfs.id || ''}: ${mfs.operator} ${mfs.type} (Tk ${mfs.amount.toLocaleString()})`,
    details: `Recipient: ${mfs.recipientNumber || 'N/A'} • Charge: Tk ${mfs.charge} • Profit: Tk ${mfs.profit} • Date: ${mfs.date}`,
    meta: { mfs },
  });
}

export async function logCustomerDelete(customer: {
  id?: number;
  name: string;
  phone: string;
  address?: string;
}) {
  await recordActivityLog({
    action: 'DELETE',
    module: 'Customers',
    entityId: customer.id,
    title: `Deleted Customer: ${customer.name} (${customer.phone})`,
    details: customer.address ? `Address: ${customer.address}` : undefined,
    meta: { customer },
  });
}

export async function logCustomerEdit(customerOrId: any, updatedDataOrName: any, extraData?: any) {
  let customerId: any;
  let customerName: string;
  let detailsText = 'Customer profile updated';

  if (typeof customerOrId === 'object' && customerOrId !== null) {
    customerId = customerOrId.id;
    customerName = updatedDataOrName?.name || customerOrId.name;
    const changes: string[] = [];
    if (updatedDataOrName?.name && updatedDataOrName.name !== customerOrId.name) changes.push(`Name: "${customerOrId.name}" ➔ "${updatedDataOrName.name}"`);
    if (updatedDataOrName?.phone && updatedDataOrName.phone !== customerOrId.phone) changes.push(`Phone: "${customerOrId.phone}" ➔ "${updatedDataOrName.phone}"`);
    if (updatedDataOrName?.address !== undefined && updatedDataOrName.address !== customerOrId.address) changes.push(`Address updated`);
    if (updatedDataOrName?.notes !== undefined && updatedDataOrName.notes !== customerOrId.notes) changes.push(`Notes updated`);
    if (changes.length > 0) detailsText = changes.join(' | ');
  } else {
    customerId = customerOrId;
    customerName = typeof updatedDataOrName === 'string' ? updatedDataOrName : 'Customer';
    if (extraData?.phone) detailsText = `Phone: ${extraData.phone}`;
  }

  await recordActivityLog({
    action: 'EDIT',
    module: 'Customers',
    entityId: customerId,
    title: `Edited Customer: ${customerName}`,
    details: detailsText,
    meta: { customerOrId, updatedDataOrName, extraData },
  });
}

export async function logDueEdit(customerName: string, amount: number, paymentMethod: string) {
  await recordActivityLog({
    action: 'EDIT',
    module: 'Dues',
    title: `Collected Due Tk ${amount.toLocaleString()} from ${customerName}`,
    details: `Payment Method: ${paymentMethod} • Date: ${format(new Date(), 'yyyy-MM-dd')}`,
    meta: { customerName, amount, paymentMethod },
  });
}

export async function logDuePaymentCollection(due: any, amountPaid: number, remaining: number) {
  await recordActivityLog({
    action: 'EDIT',
    module: 'Dues',
    entityId: due.id,
    title: `Collected Due Payment: Tk ${amountPaid.toLocaleString()} from ${due.customerName}`,
    details: `Phone: ${due.phone} • Remaining Due: Tk ${remaining.toLocaleString()}`,
    meta: { due, amountPaid, remaining },
  });
}

export async function logBorrowingPayment(borrowing: any, payAmount: number, newStatus: string) {
  await recordActivityLog({
    action: 'EDIT',
    module: 'Borrowings',
    entityId: borrowing.id,
    title: `Paid Borrowing to ${borrowing.lenderName}: Tk ${payAmount.toLocaleString()}`,
    details: `Total: Tk ${borrowing.amount.toLocaleString()} • Status: ${newStatus}`,
    meta: { borrowing, payAmount, newStatus },
  });
}

export async function logCustomRangeDelete(data: {
  startDate: string;
  endDate: string;
  counts: { sales: number; expenses: number; mfs: number; borrowings: number; total: number };
  adjustBalances: boolean;
  selectedModules: string[];
}) {
  const parts: string[] = [];
  if (data.counts.sales) parts.push(`${data.counts.sales} Sales`);
  if (data.counts.expenses) parts.push(`${data.counts.expenses} Expenses`);
  if (data.counts.mfs) parts.push(`${data.counts.mfs} MFS`);
  if (data.counts.borrowings) parts.push(`${data.counts.borrowings} Borrowings`);

  const summary = parts.length > 0 ? parts.join(', ') : '0 records';

  await recordActivityLog({
    action: 'BULK_DELETE',
    module: 'All Data',
    title: `Custom Range Delete: ${data.counts.total} records removed (${data.startDate} to ${data.endDate})`,
    details: `Deleted: [${summary}] • Balance Adjustment: ${data.adjustBalances ? 'Enabled' : 'Disabled'} • Modules: ${data.selectedModules.join(', ')}`,
    meta: data,
  });
}

export async function logAllDataReset(data: {
  counts: { sales: number; expenses: number; mfs: number; dues: number; customers: number; borrowings: number; total: number };
  wipeAccounts: boolean;
  wipePresets: boolean;
}) {
  await recordActivityLog({
    action: 'RESET',
    module: 'All Data',
    title: `Database Reset: ${data.counts.total} transaction records cleared`,
    details: `Sales: ${data.counts.sales}, Expenses: ${data.counts.expenses}, MFS: ${data.counts.mfs}, Dues: ${data.counts.dues}, Borrowings: ${data.counts.borrowings} • Accounts Reset: ${data.wipeAccounts ? 'Yes' : 'No'}`,
    meta: data,
  });
}
