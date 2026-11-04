const fs = require('fs');
const path = require('path');
const parser = require(require.resolve('@babel/parser', { paths: ['ksyn/client'] }));
const traverse = require(require.resolve('@babel/traverse', { paths: ['ksyn/client'] })).default;

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allFiles = getFiles('ksyn/client/src');

const globals = new Set([
  'window', 'document', 'localStorage', 'sessionStorage', 'console', 'setTimeout', 'clearTimeout', 
  'setInterval', 'clearInterval', 'fetch', 'alert', 'confirm', 'prompt', 'Date', 'Math', 'Number', 
  'String', 'Boolean', 'Array', 'Object', 'JSON', 'RegExp', 'Error', 'Promise', 'Set', 'Map', 
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'Intl', 'URL', 'URLSearchParams', 'Blob', 'FileReader', 'FormData', 'BroadcastChannel',
  'requestAnimationFrame', 'cancelAnimationFrame', 'Event', 'CustomEvent', 'navigator',
  'React', 'process', 'require', 'module', 'exports', 'global', 'Image'
]);

for (const file of allFiles) {
  const code = fs.readFileSync(file, 'utf-8');
  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  } catch (err) {
    console.error('Parse error in', file, err.message);
    continue;
  }

  const undeclared = new Set();
  traverse(ast, {
    Program(progPath) {
      progPath.traverse({
        Identifier(idPath) {
          const name = idPath.node.name;
          if (
            idPath.isReferencedIdentifier() &&
            !idPath.scope.hasBinding(name) &&
            !globals.has(name)
          ) {
            // Filter out typeof checks e.g. typeof foo === 'function'
            if (idPath.parentPath && idPath.parentPath.isUnaryExpression({ operator: 'typeof' })) {
              return;
            }
            undeclared.add(name);
          }
        }
      });
    }
  });

  if (undeclared.size > 0) {
    console.log(`[${file}] Undeclared identifiers:`, Array.from(undeclared));
  }
}
console.log('Scan completed.');
