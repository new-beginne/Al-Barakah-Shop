const fs = require('fs');

const files = [
  'src/components/Settings.tsx',
  'src/components/MfsLedger.tsx',
  'src/components/NotificationCenter.tsx',
  'src/components/Reports.tsx',
  'src/components/CustomerProfile.tsx',
  'src/components/Customers.tsx',
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Add import if not present
  if (!content.includes('formatDateStr')) {
    // find last import
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfImport = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, endOfImport + 1) + "import { formatDateStr } from '../utils/dateFormatter';\n" + content.slice(endOfImport + 1);
      changed = true;
    }
  }

  const replacePatterns = [
    { regex: />{log\.date}</g, replacement: ">{formatDateStr(log.date)}<" },
    { regex: />{tx\.date}</g, replacement: ">{formatDateStr(tx.date)}<" },
    { regex: />{notification\.date}</g, replacement: ">{formatDateStr(notification.date)}<" },
    { regex: />{item\.date}</g, replacement: ">{formatDateStr(item.date)}<" },
    { regex: />{s\.date}</g, replacement: ">{formatDateStr(s.date)}<" },
    { regex: />{e\.date}</g, replacement: ">{formatDateStr(e.date)}<" },
    { regex: />{m\.date}</g, replacement: ">{formatDateStr(m.date)}<" },
    { regex: />{t\.date}</g, replacement: ">{formatDateStr(t.date)}<" },
    { regex: /\{data\.date\}/g, replacement: "{formatDateStr(data.date)}" },
    { regex: /Date: \{d\.date \|\| 'N\/A'\}/g, replacement: "Date: {formatDateStr(d.date)}" }
  ];

  replacePatterns.forEach(({ regex, replacement }) => {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated bare dates in:', file);
  }
});
