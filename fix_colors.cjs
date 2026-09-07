const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'components');

const replacements = [
    // Fix invalid tailwind classes introduced by previous sed commands
    { from: /bg-#084b3e/g, to: 'bg-[#084b3e]' },
    { from: /text-#084b3e/g, to: 'text-[#084b3e]' },
    { from: /border-#084b3e/g, to: 'border-[#084b3e]' },
    { from: /focus:border-#084b3e/g, to: 'focus:border-[#084b3e]' },
    { from: /focus:ring-#084b3e/g, to: 'focus:ring-[#084b3e]' },
    { from: /hover:border-#084b3e/g, to: 'hover:border-[#084b3e]' },
    { from: /hover:bg-#084b3e/g, to: 'hover:bg-[#084b3e]' },
    { from: /hover:text-#084b3e/g, to: 'hover:text-[#084b3e]' },
    { from: /text-blue-950/g, to: 'text-gray-900' },
    { from: /bg-blue-950/g, to: 'bg-gray-900' },
    { from: /border-blue-950/g, to: 'border-gray-900' },
    { from: /hover:text-blue-950/g, to: 'hover:text-gray-900' },
    { from: /hover:bg-blue-950/g, to: 'hover:bg-gray-900' },
    
    // Replace remaining blue-* with the new emerald/green theme
    { from: /bg-blue-900/g, to: 'bg-[#084b3e]' },
    { from: /text-blue-900/g, to: 'text-[#084b3e]' },
    { from: /border-blue-900/g, to: 'border-[#084b3e]' },
    { from: /focus:border-blue-900/g, to: 'focus:border-[#084b3e]' },
    { from: /focus:ring-blue-900/g, to: 'focus:ring-[#084b3e]' },
    { from: /hover:bg-blue-900/g, to: 'hover:bg-[#084b3e]' },
    { from: /hover:border-blue-900/g, to: 'hover:border-[#084b3e]' },
    { from: /hover:text-blue-900/g, to: 'hover:text-[#084b3e]' },
    
    { from: /bg-blue-800/g, to: 'bg-[#126b55]' },
    { from: /text-blue-800/g, to: 'text-[#126b55]' },
    { from: /border-blue-800/g, to: 'border-[#126b55]' },
    { from: /hover:bg-blue-800/g, to: 'hover:bg-[#126b55]' },
    
    { from: /bg-blue-50/g, to: 'bg-emerald-50' },
    { from: /text-blue-50/g, to: 'text-emerald-50' },
    { from: /border-blue-50/g, to: 'border-emerald-50' },
    
    { from: /bg-blue-100/g, to: 'bg-emerald-100' },
    { from: /text-blue-100/g, to: 'text-emerald-100' },
    
    { from: /text-blue-200/g, to: 'text-emerald-200' },
    { from: /bg-blue-200/g, to: 'bg-emerald-200' },
    
    // Update container styling rounding and borders
    { from: /rounded-lg shadow-sm border border-gray-200/g, to: 'rounded-2xl shadow-sm border border-gray-100' },
    { from: /rounded-md shadow-sm border border-gray-200/g, to: 'rounded-2xl shadow-sm border border-gray-100' },
    { from: /bg-white rounded-lg shadow-md/g, to: 'bg-white rounded-2xl shadow-sm border border-gray-100' },
    { from: /rounded-md focus:border-/g, to: 'rounded-xl focus:border-' },
    { from: /rounded-lg focus:border-/g, to: 'rounded-xl focus:border-' }
];

function processDirectory(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let newContent = content;
            
            replacements.forEach(rep => {
                newContent = newContent.replace(rep.from, rep.to);
            });
            
            if (content !== newContent) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log(`Updated: ${file}`);
            }
        }
    });
}

processDirectory(directoryPath);
