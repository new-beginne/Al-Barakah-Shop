const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'components');

const replacements = [
    { from: /text-blue-600/g, to: 'text-[#084b3e]' },
    { from: /border-blue-200/g, to: 'border-emerald-200' },
    { from: /group-hover:text-blue-600/g, to: 'group-hover:text-[#084b3e]' }
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
                console.log(`Updated remaining blue in: ${file}`);
            }
        }
    });
}

processDirectory(directoryPath);
