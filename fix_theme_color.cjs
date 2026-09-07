const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'vite.config.ts');
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/theme_color: '#1e3a8a'/g, "theme_color: '#084b3e'");
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed theme color');
