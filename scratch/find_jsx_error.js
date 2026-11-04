const esbuild = require('../client/node_modules/esbuild');
const fs = require('fs');
const lines = fs.readFileSync('ksyn/client/src/views/BranchAdminDashboard.jsx', 'utf8').split('\n');

// Find the line where syntax breaks
async function binarySearch() {
  // Let's test chunks
  for (let end = 3300; end <= lines.length; end += 200) {
    const chunk = lines.slice(0, end).join('\n') + '\n</div>);\n}';
    try {
      await esbuild.transform(chunk, { loader: 'jsx' });
      // If chunk compiles, error is after 'end'
    } catch (e) {
      console.log(`Fails when including up to line ${end}`);
      // Now drill down
      for (let l = end - 200; l <= end; l += 10) {
        const subChunk = lines.slice(0, l).join('\n') + '\n</div>);\n}';
        try {
          await esbuild.transform(subChunk, { loader: 'jsx' });
        } catch (err) {
          console.log(`First failure around line ${l}: ${err.errors[0]?.text}`);
          for (let exact = Math.max(0, l - 15); exact <= Math.min(lines.length, l + 5); exact++) {
            console.log(`${exact}: ${lines[exact - 1]}`);
          }
          return;
        }
      }
      return;
    }
  }
}

binarySearch();
