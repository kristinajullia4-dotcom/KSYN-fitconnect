const babel = require('../client/node_modules/@babel/parser');
const fs = require('fs');
const lines = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8').split('\n');

// Binary search on the JSX return body
async function findExactLine() {
  const start = 1893;
  const total = lines.length;

  for (let l = 1900; l < total; l += 50) {
    // Take lines 0 to l, close any open divs and the return and function
    const snippet = lines.slice(0, l).join('\n') + '\n</div>\n</div>\n</div>\n</div>\n</div>\n</div>\n</div>\n</div>\n);\n}';
    try {
      babel.parse(snippet, { sourceType: 'module', plugins: ['jsx'] });
    } catch (e) {
      // It failed at l. Let's step line by line from l-50 to l
      for (let exact = l - 50; exact <= l; exact++) {
        const sub = lines.slice(0, exact).join('\n') + '\n</div>\n</div>\n</div>\n</div>\n</div>\n</div>\n</div>\n</div>\n);\n}';
        try {
          babel.parse(sub, { sourceType: 'module', plugins: ['jsx'] });
        } catch (subErr) {
          console.log(`Failed at line ${exact}: ${subErr.message}`);
          console.log(`Line content: ${lines[exact - 1]}`);
          return;
        }
      }
      return;
    }
  }
}

findExactLine();
