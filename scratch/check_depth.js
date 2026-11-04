const fs = require('fs');
const lines = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8').split('\n');

// Find return (
let returnLine = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('return (') || lines[i].includes('return (')) {
    returnLine = i + 1;
    break;
  }
}
console.log('Return line:', returnLine);

// Count '{' and '}' on each top-level section inside return
let depth = 0;
for (let i = returnLine; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') depth++;
    if (line[j] === '}') depth--;
  }
  if (line.includes('{/* VIEW') || line.includes('{/* MODAL')) {
    console.log(`Line ${i + 1} (${line.trim()}): depth = ${depth}`);
  }
}
console.log('Final depth at EOF:', depth);
