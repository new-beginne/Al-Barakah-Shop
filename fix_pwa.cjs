const fs = require('fs');
const path = require('path');

// 1. Fix vite.config.ts icons
const vitePath = path.join(__dirname, 'vite.config.ts');
let viteConfig = fs.readFileSync(vitePath, 'utf8');
viteConfig = viteConfig.replace(/icons:\s*\[[\s\S]*?\]/, `icons: [
            {
              src: '/icon.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: '/icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]`);
fs.writeFileSync(vitePath, viteConfig, 'utf8');

// 2. Fix index.html theme color
const indexPath = path.join(__dirname, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace(/#1e3a8a/g, '#084b3e');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

// 3. Add Service Worker registration to main.tsx
const mainPath = path.join(__dirname, 'src/main.tsx');
let mainTsx = fs.readFileSync(mainPath, 'utf8');
if (!mainTsx.includes('virtual:pwa-register')) {
  mainTsx = `import { registerSW } from 'virtual:pwa-register';\nregisterSW({ immediate: true });\n` + mainTsx;
  fs.writeFileSync(mainPath, mainTsx, 'utf8');
}

console.log('PWA fixed!');
