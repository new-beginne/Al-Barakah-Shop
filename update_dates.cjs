const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const replacePatterns = [
    { regex: /'dd MMM yyyy, hh:mm a'/g, replacement: "'dd/MM/yy, hh:mm a'" },
    { regex: /'dd\/MM\/yyyy, hh:mm a'/g, replacement: "'dd/MM/yy, hh:mm a'" },
    { regex: /'dd\/MM\/yyyy hh:mm a'/g, replacement: "'dd/MM/yy hh:mm a'" },
    { regex: /'dd MMM yyyy'/g, replacement: "'dd/MM/yy'" },
    { regex: /'dd\/MM\/yyyy'/g, replacement: "'dd/MM/yy'" },
    { regex: /'dd MMM'/g, replacement: "'dd/MM'" }
  ];

  replacePatterns.forEach(({ regex, replacement }) => {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated format() in:', file);
  }
});
