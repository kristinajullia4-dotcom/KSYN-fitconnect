const fs = require('fs');
const content = fs.readFileSync('ksyn/client/src/views/EmployeePortal.jsx', 'utf8');
const importsMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
if (!importsMatch) {
  console.log('No lucide imports found!');
  process.exit(1);
}
const imported = new Set(importsMatch[1].split(',').map(s => s.trim()).filter(Boolean));
console.log('Imported icons count:', imported.size);

const jsxTags = new Set();
const tagRegex = /<([A-Z][a-zA-Z0-9]+)[\s\/>]/g;
let m;
while ((m = tagRegex.exec(content)) !== null) {
  jsxTags.add(m[1]);
}

const standardComponents = new Set([
  'EmployeePortal',
  'DataTable',
  'MemberOnboardingWizard',
  'Fragment',
  'React'
]);

const missing = [];
for (const tag of jsxTags) {
  if (!imported.has(tag) && !standardComponents.has(tag)) {
    missing.push(tag);
  }
}
console.log('Missing / unimported tags:', missing);
