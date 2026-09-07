const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/Reports.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the Statement Actions (Print / Export PDF) from the top
// Lines 284 to 348 approx. Let's find the exact string.
const topExportRegex = /\{\/\* Statement Actions \(Hidden on Print\) \*\/\}[\s\S]*?\{\/\* Printable Area Starts Here \*\/\}/;
content = content.replace(topExportRegex, '{/* Printable Area Starts Here */}');

// 2. Fix the Quick Export Button at the bottom
const bottomExportRegex = /\{\/\* Tabs and Quick Export Button \(Hidden on Print\) \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* All Transactions Table \*\/\}/;
const newBottomExport = `{/* Tabs and Quick Export Button (Hidden on Print) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-gray-100 mb-4 sm:mb-6 print:hidden gap-3 pb-2">
          <div className="flex space-x-1 sm:space-x-2 w-full sm:w-auto">
            {(['all', 'sales', 'expenses', 'mfs'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={\`flex-1 sm:flex-none px-3 sm:px-5 py-2.5 font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors whitespace-nowrap rounded-xl cursor-pointer \${
                  activeTab === tab 
                    ? 'bg-[#084b3e] text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }\`}
              >
                {tab === 'all' ? 'Full Audit' : tab === 'sales' ? 'Sales' : tab === 'expenses' ? 'Expenses' : 'MFS'}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => handleExportPDF(activeTab === 'all' ? 'full' : 'active')}
              disabled={isExporting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#084b3e] hover:bg-[#126b55] disabled:bg-gray-400 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors shadow-sm whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : pdfSuccess ? <Check size={16} className="text-white" /> : <Download size={16} />}
              <span>
                {isExporting ? 'Generating...' : pdfSuccess ? 'Downloaded' : 
                  activeTab === 'all' ? 'Export Full Audit' : 
                  activeTab === 'sales' ? 'Export Sales Report' : 
                  activeTab === 'expenses' ? 'Export Expense Report' : 
                  'Export MFS Report'
                }
              </span>
            </button>
          </div>
        </div>

        {/* All Transactions Table */}`;
content = content.replace(bottomExportRegex, newBottomExport);

// 3. Update table designs
// Replace table headers
content = content.replace(/<tr className="bg-\[#084b3e\] text-white text-\[10px\] sm:text-xs uppercase tracking-wider select-none print:bg-black print:text-white">/g, 
                          '<tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider select-none print:border-b-2 print:border-black">');
// Since text is no longer white, font needs adjusting perhaps, let's keep it bold.
content = content.replace(/<th className="w-\[([0-9]+)%\] p-2 sm:p-3 font-black truncate">/g, '<th className="w-[$1%] p-3 sm:p-4 font-bold text-gray-500 truncate">');
content = content.replace(/<th className="w-\[([0-9]+)%\] md:w-\[([0-9]+)%\] print:w-\[([0-9]+)%\] p-2 sm:p-3 font-black truncate">/g, '<th className="w-[$1%] md:w-[$2%] print:w-[$3%] p-3 sm:p-4 font-bold text-gray-500 truncate">');
content = content.replace(/<th className="w-\[([0-9]+)%\] md:w-\[([0-9]+)%\] print:w-\[([0-9]+)%\] p-2 sm:p-3 text-center font-black truncate">/g, '<th className="w-[$1%] md:w-[$2%] print:w-[$3%] p-3 sm:p-4 text-center font-bold text-gray-500 truncate">');
content = content.replace(/<th className="w-\[([0-9]+)%\] md:w-\[([0-9]+)%\] print:w-\[([0-9]+)%\] p-2 sm:p-3 text-right font-black truncate">/g, '<th className="w-[$1%] md:w-[$2%] print:w-[$3%] p-3 sm:p-4 text-right font-bold text-gray-500 truncate">');
content = content.replace(/<th className="hidden md:table-cell print:table-cell md:w-\[([0-9]+)%\] print:w-\[([0-9]+)%\] p-2 sm:p-3 text-right font-black truncate">/g, '<th className="hidden md:table-cell print:table-cell md:w-[$1%] print:w-[$2%] p-3 sm:p-4 text-right font-bold text-gray-500 truncate">');
content = content.replace(/<th className="hidden md:table-cell print:table-cell md:w-\[([0-9]+)%\] print:w-\[([0-9]+)%\] p-2 sm:p-3 font-black truncate">/g, '<th className="hidden md:table-cell print:table-cell md:w-[$1%] print:w-[$2%] p-3 sm:p-4 font-bold text-gray-500 truncate">');

// Adjust table body cell padding to make them roomier
content = content.replace(/<td className="p-2 sm:p-3/g, '<td className="p-3 sm:p-4');
content = content.replace(/<td className="hidden md:table-cell print:table-cell p-2 sm:p-3/g, '<td className="hidden md:table-cell print:table-cell p-3 sm:p-4');

// Improve hover state of rows
content = content.replace(/className="hover:bg-gray-50 transition-colors/g, 'className="hover:bg-gray-50/80 hover:shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.05)] transition-all');

// Fix Table tfoot styling
content = content.replace(/<tr className="bg-gray-100 text-gray-900 font-black text-\[11px\] sm:text-xs border-t-2 border-gray-300 print:bg-white print:border-t-2 print:border-black">/g, '<tr className="bg-gray-50 text-gray-900 font-bold text-[11px] sm:text-sm border-t border-gray-200 print:bg-white print:border-t-2 print:border-black">');
// Since cell padding changed, total labels might need adjusting if they are hardcoded
content = content.replace(/<td colSpan=\{([0-9]+)\} className="p-2 sm:p-3/g, '<td colSpan={$1} className="p-3 sm:p-4');


fs.writeFileSync(file, content, 'utf8');
console.log('Update complete');
