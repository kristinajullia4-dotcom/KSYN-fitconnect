const babel = require('../client/node_modules/@babel/parser');
const fs = require('fs');
const lines = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8').split('\n');

for (let i = 1894; i < lines.length; i++) {
  // Test parsing the file up to line i, closing the return with '</div>);}'
  const code = lines.slice(0, i).join('\n') + '\n</div>\n);\n}';
  try {
    babel.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    // If it fails with 'Unexpected token, expected "}"', that means line i or earlier opened a { in JSX
    if (e.message.includes('expected "}"')) {
      console.log(`Failed at line ${i} with expected "}"`);
      // check line i-1
      console.log(`Line ${i}: ${lines[i - 1]}`);
      break;
    }
  }
}
