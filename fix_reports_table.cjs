const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/Reports.tsx');
let content = fs.readFileSync(file, 'utf8');

// Restore table header row
content = content.replace(/<tr className="bg-gray-50\/80 border-b border-gray-100 text-gray-500 text-\[10px\] sm:text-xs uppercase tracking-wider select-none print:border-b-2 print:border-black">/g, 
                          '<tr className="bg-[#084b3e] text-white text-[10px] sm:text-xs uppercase tracking-wider select-none print:bg-black print:text-white">');

// Restore th styles
content = content.replace(/p-3 sm:p-4 font-bold text-gray-500 truncate/g, 'p-2 sm:p-3 font-black truncate');
content = content.replace(/p-3 sm:p-4 text-center font-bold text-gray-500 truncate/g, 'p-2 sm:p-3 text-center font-black truncate');
content = content.replace(/p-3 sm:p-4 text-right font-bold text-gray-500 truncate/g, 'p-2 sm:p-3 text-right font-black truncate');

// Restore td paddings
content = content.replace(/<td className="p-3 sm:p-4/g, '<td className="p-2 sm:p-3');
content = content.replace(/<td className="hidden md:table-cell print:table-cell p-3 sm:p-4/g, '<td className="hidden md:table-cell print:table-cell p-2 sm:p-3');
// Edge case td colspans
content = content.replace(/<td colSpan=\{([0-9]+)\} className="p-3 sm:p-4/g, '<td colSpan={$1} className="p-2 sm:p-3');

// Restore hover
content = content.replace(/className="hover:bg-gray-50\/80 hover:shadow-\[inset_0_-1px_0_0_rgba\(0,0,0,0\.05\)\] transition-all/g, 'className="hover:bg-gray-50 transition-colors');

// Restore tfoot
content = content.replace(/<tr className="bg-gray-50 text-gray-900 font-bold text-\[11px\] sm:text-sm border-t border-gray-200 print:bg-white print:border-t-2 print:border-black">/g, '<tr className="bg-gray-100 text-gray-900 font-black text-[11px] sm:text-xs border-t-2 border-gray-300 print:bg-white print:border-t-2 print:border-black">');

fs.writeFileSync(file, content, 'utf8');
console.log('Restored table styles');
