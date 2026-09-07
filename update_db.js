const fs = require('fs');
let code = fs.readFileSync('src/db/db.ts', 'utf8');
code = code.replace(/paymentMethod: string;/g, 'paymentMethod: string;\n  note?: string;');
code = code.replace(/category: string;/g, 'category: string;\n  note?: string;');
fs.writeFileSync('src/db/db.ts', code);
