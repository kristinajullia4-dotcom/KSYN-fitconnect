const fs = require('fs');
const lines = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8').split('\n');

const stack = [];
for (let i = 1893; i < lines.length; i++) {
  const line = lines[i];
  // Check for lines that open a block like `{expr && (`
  if (line.match(/\{\s*([A-Za-z0-9_$.]+(\s*===|\s*!==)?.*)\s*&&\s*\(/)) {
    stack.push({ line: i + 1, text: line.trim() });
  }
  // Check for lines that close with `)}`
  if (line.trim() === ')}' || line.trim() === ')}' || line.includes(')}')) {
    if (line.trim() === ')}' || line.trim().startsWith(')}')) {
      const popped = stack.pop();
      // console.log(`Closed block from line ${popped?.line} at line ${i + 1}`);
    }
  }
}

console.log('Unclosed condition blocks:', stack.length);
if (stack.length > 0) {
  console.log(stack);
}
