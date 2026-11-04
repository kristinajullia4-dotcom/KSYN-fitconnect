const fs = require('fs');
const lines = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8').split('\n');

const stack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '{' || ch === '(' || ch === '[') {
      stack.push({ ch, line: i + 1, col: j + 1 });
    } else if (ch === '}' || ch === ')' || ch === ']') {
      if (stack.length === 0) {
        console.log(`Extra closing ${ch} at line ${i + 1}:${j + 1}`);
      } else {
        const top = stack.pop();
        const match = (top.ch === '{' && ch === '}') || (top.ch === '(' && ch === ')') || (top.ch === '[' && ch === ']');
        if (!match) {
          console.log(`Mismatched ${top.ch} at line ${top.line}:${top.col} with ${ch} at line ${i + 1}:${j + 1}`);
        }
      }
    }
  }
}

console.log('Unclosed remaining in stack:', stack.length);
if (stack.length > 0) {
  console.log('Last unclosed:');
  console.log(stack.slice(-5));
}
