export function formatDateStr(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  if (dateStr.includes('/')) return dateStr;
  
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y.slice(2)}`;
  }
  return dateStr;
}
