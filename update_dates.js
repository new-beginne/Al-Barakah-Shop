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

  // Replace format(..., 'dd MMM yyyy') to format(..., 'dd/MM/yy')
  const r1 = /format\(([^,]+),\s*'dd MMM yyyy(?:,\s*hh:mm a)?'\)/g;
  if (r1.test(content)) {
    content = content.replace(r1, "format($1, 'dd/MM/yy')");
    changed = true;
  }
  
  const r2 = /format\(([^,]+),\s*'dd\/MM\/yyyy(?:,\s*hh:mm a)?'\)/g;
  if (r2.test(content)) {
    content = content.replace(r2, "format($1, 'dd/MM/yy')");
    changed = true;
  }
  
  const r3 = /format\(([^,]+),\s*'dd\/MM\/yyyy(?: hh:mm a)?'\)/g;
  if (r3.test(content)) {
    content = content.replace(r3, "format($1, 'dd/MM/yy')");
    changed = true;
  }

  // Also replace 'dd MMM' with 'dd/MM'
  const r4 = /format\(([^,]+),\s*'dd MMM'\)/g;
  if (r4.test(content)) {
    content = content.replace(r4, "format($1, 'dd/MM')");
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated format() in:', file);
  }
});
