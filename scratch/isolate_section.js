const babel = require('../client/node_modules/@babel/parser');
const fs = require('fs');
let code = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8');

const returnIdx = code.indexOf('return (');
const preReturn = code.slice(0, returnIdx);

// Try replacing all views and modals inside return (
const testJSX = `
return (
  <div>
    <h1>Test</h1>
  </div>
);
}
`;

try {
  babel.parse(preReturn + testJSX, { sourceType: 'module', plugins: ['jsx'] });
  console.log('Pre-return is clean!');
} catch (e) {
  console.log('Pre-return error:', e.message);
}
