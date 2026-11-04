const fs = require('fs');
const lines = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8').split('\n');

const stack = [];
for (let i = 1284; i < lines.length; i++) {
  const line = lines[i];
  // Find JSX tags: <Tag ... or </Tag>
  const tagRegex = /<\/?([A-Za-z0-9_.-]+)(\s|>|\/)/g;
  let match;
  while ((match = tagRegex.exec(line)) !== null) {
    const full = match[0];
    const tagName = match[1];
    const isClosing = full.startsWith('</');
    const isSelfClosing = line.slice(match.index).match(/^<[^>]*\/>/);
    if (isSelfClosing) continue;
    if (isClosing) {
      if (stack.length === 0) {
        console.log(`Unexpected closing tag </${tagName}> at line ${i + 1}`);
      } else {
        const top = stack.pop();
        if (top.tagName !== tagName) {
          console.log(`Mismatched <${top.tagName}> at line ${top.line} with </${tagName}> at line ${i + 1}`);
        }
      }
    } else {
      // opening tag - check if self-closing on the same line
      const sub = line.slice(match.index);
      const closeIdx = sub.indexOf('>');
      if (closeIdx !== -1 && sub.slice(0, closeIdx + 1).endsWith('/>')) {
        // self closing
        continue;
      }
      stack.push({ tagName, line: i + 1 });
    }
  }
}

console.log('Remaining open tags:');
console.log(stack);
