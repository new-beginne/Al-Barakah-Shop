const fs = require('fs');

let content = fs.readFileSync('src/components/Expenses.tsx', 'utf8');
content = content.replace(
`const SERVICE_NAMES = [
  'Shop Rent',
  'Electricity Bill',
  'Internet Bill',
  'Paper/Ink Purchase',
  'Snacks/Tea',
  'Other'
];`,
`const DEFAULT_EXPENSE_SERVICES = [
  'Shop Rent',
  'Electricity Bill',
  'Internet Bill',
  'Paper/Ink Purchase',
  'Snacks/Tea'
];`
);

fs.writeFileSync('src/components/Expenses.tsx', content);

