const fs = require('fs');
const path = require('path');

function search(dir, regex) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git' || e.name === 'brain') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) search(full, regex);
    else if (/\.(jsx?|json|html|css)$/.test(e.name)) {
      const text = fs.readFileSync(full, 'utf8');
      const lines = text.split('\n');
      lines.forEach((l, idx) => {
        if (regex.test(l)) {
          console.log(`${full}:${idx+1} -> ${l.trim()}`);
        }
      });
    }
  }
}

console.log('--- Search: Complete Roster ---');
search('./ksyn', /Complete Roster|Search applicant/i);
