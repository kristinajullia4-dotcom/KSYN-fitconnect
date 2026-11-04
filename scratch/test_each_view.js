const babel = require('../client/node_modules/@babel/parser');
const fs = require('fs');
const code = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8');

// Find all `{activeSection === ` blocks and test parsing them
const regex = /\{activeSection === '[^']+' && \([\s\S]*?\n      \)\}/g;
let match;
while ((match = regex.exec(code)) !== null) {
  const block = match[0];
  const sectionName = block.slice(0, 40);
  const testCode = `const Test = () => (<div>${block}</div>);`;
  try {
    babel.parse(testCode, { sourceType: 'module', plugins: ['jsx'] });
    console.log('Passed:', sectionName);
  } catch (e) {
    console.log('FAILED:', sectionName, 'error:', e.message);
  }
}

// Also test modals
const modalRegex = /\{show[A-Za-z]+ && \([\s\S]*?\n      \)\}/g;
while ((match = modalRegex.exec(code)) !== null) {
  const block = match[0];
  const modalName = block.slice(0, 40);
  const testCode = `const Test = () => (<div>${block}</div>);`;
  try {
    babel.parse(testCode, { sourceType: 'module', plugins: ['jsx'] });
    console.log('Passed modal:', modalName);
  } catch (e) {
    console.log('FAILED modal:', modalName, 'error:', e.message);
  }
}
