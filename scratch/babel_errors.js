const babel = require('../client/node_modules/@babel/parser');
const fs = require('fs');
const code = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8');

// Tokenize and track JSXExpressionContainer
const tokens = babel.parse(code, {
  sourceType: 'module',
  plugins: ['jsx'],
  errorRecovery: true
});

if (tokens.errors) {
  tokens.errors.forEach(err => {
    console.log(`Error at line ${err.loc?.line}:${err.loc?.column} - ${err.message}`);
  });
}
