const babel = require('../client/node_modules/@babel/parser');
const fs = require('fs');
const code = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8');

// Let's find the JSX opening and closing elements inside return (
try {
  babel.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log('Valid!');
} catch (e) {
  console.log('Error info:', e.message, 'at line', e.loc.line, 'col', e.loc.column);
}
