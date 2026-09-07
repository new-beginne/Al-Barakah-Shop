const fs = require('fs');

let content = fs.readFileSync('src/components/Expenses.tsx', 'utf8');

content = content.replace(
  `import { CheckCircle2, Circle } from 'lucide-react';`,
  `import { CheckCircle2, Circle } from 'lucide-react';\nimport { useLiveQuery } from 'dexie-react-hooks';\nimport { useEffect } from 'react';`
);

content = content.replace(
  `const SERVICE_NAMES = [  'Shop Rent',  'Electricity Bill',  'Internet Bill',  'Paper/Ink Purchase',  'Snacks/Tea',  'Other'];`,
  `const DEFAULT_EXPENSE_SERVICES = [
  'Shop Rent',
  'Electricity Bill',
  'Internet Bill',
  'Paper/Ink Purchase',
  'Snacks/Tea'
];`
);

const newSetup = `
  const expenseServices = useLiveQuery(() => db.expenseServices.toArray()) || [];

  useEffect(() => {
    // Seed default expense services if empty
    const seed = async () => {
      const count = await db.expenseServices.count();
      if (count === 0) {
        for (const name of DEFAULT_EXPENSE_SERVICES) {
          await db.expenseServices.add({ name });
        }
      }
    };
    seed();
  }, []);
`;

content = content.replace(
  `export function Expenses() {`,
  `export function Expenses() {\n${newSetup}`
);

content = content.replace(
  `{SERVICE_NAMES.map(method => (`,
  `{expenseServices.map(service => (
                <option key={service.id} value={service.name}>{service.name}</option>
              ))}
              <option value="Other" className="font-bold">Other</option>`
);
content = content.replace(
  `<option key={method} value={method}>{method}</option>\n              ))}`,
  ``
);


fs.writeFileSync('src/components/Expenses.tsx', content);

