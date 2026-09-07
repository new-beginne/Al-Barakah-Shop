const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'components');

const replacements = [
    { from: /border-gray-200/g, to: 'border-gray-100' },
    { from: /rounded-lg/g, to: 'rounded-xl' }
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
                console.log(`Updated border and rounded in: ${file}`);
            }
        }
    });
}

processDirectory(directoryPath);
