const babel = require('../client/node_modules/@babel/parser');
const fs = require('fs');
const code = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8');

const start = code.indexOf("{activeSection === 'ledger' && (");
const end = code.indexOf("{/* VIEW: XENDIT DIGITAL TRANSACTIONS");
const chunk = code.slice(start, end);

try {
  babel.parse('const Test = () => (<div>' + chunk + '</div>);', { sourceType: 'module', plugins: ['jsx'] });
  console.log('Ledger OK');
} catch (e) {
  console.log('Ledger error:', e.message, 'at line', e.loc.line, 'col', e.loc.column);
  const chunkLines = ('const Test = () => (<div>' + chunk + '</div>);').split('\n');
  console.log('Error line text:', chunkLines[e.loc.line - 1]);
}
