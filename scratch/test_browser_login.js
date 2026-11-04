const { spawn } = require('child_process');
const http = require('http');

async function getDebuggerUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const tabs = await res.json();
      if (tabs.length > 0 && tabs[0].webSocketDebuggerUrl) {
        return tabs[0].webSocketDebuggerUrl;
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error('Could not connect to CDP');
}

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=C:\\Users\\admin\\AppData\\Local\\Temp\\edge-test-profile',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5180'
  ], { detached: true });

  try {
    const wsUrl = await getDebuggerUrl();
    console.log('Connected to CDP at:', wsUrl);

    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('*** BROWSER EXCEPTION ***:', JSON.stringify(msg.params.exceptionDetails, null, 2));
      }
      if (msg.method === 'Console.messageAdded') {
        console.log('[BROWSER CONSOLE]', msg.params.message.level, msg.params.message.text);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise(r => ws.onopen = r);

    await send('Runtime.enable');
    await send('Console.enable');
    await send('Page.enable');

    console.log('Logging in via API to get employee token...');
    const loginRes = await fetch('http://localhost:5080/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'makati.staff@ksyn.com', password: 'StaffMember@2026' })
    });
    const loginData = await loginRes.json();
    console.log('Login API result:', loginData.success, loginData.user?.role);

    // Set localStorage in browser
    const userStr = JSON.stringify(loginData.user);
    const token = loginData.token;

    // Navigate to login page
    await send('Page.navigate', { url: 'http://localhost:5180/' });
    await new Promise(r => setTimeout(r, 2000));

    // Inject localStorage and go to dashboard/employee
    const evalSet = await send('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem('ksyn_token', ${JSON.stringify(token)});
        localStorage.setItem('ksyn_user', ${JSON.stringify(userStr)});
        return localStorage.getItem('ksyn_token');
      })()`,
      returnByValue: true
    });
    console.log('Token stored in localStorage:', !!evalSet.result?.result?.value);

    await send('Page.navigate', { url: 'http://localhost:5180/dashboard/employee' });
    console.log('Navigated to /dashboard/employee. Waiting 3 seconds...');
    await new Promise(r => setTimeout(r, 3000));

    // Evaluate root element content
    const evalRes = await send('Runtime.evaluate', {
      expression: `(() => ({
        url: window.location.href,
        text: document.getElementById('root')?.innerText?.slice(0, 300),
        htmlLen: document.getElementById('root')?.innerHTML?.length || 0,
        bodyBg: window.getComputedStyle(document.body).backgroundColor
      }))()`,
      returnByValue: true
    });
    console.log('Evaluation result on /dashboard/employee:', JSON.stringify(evalRes.result?.result?.value, null, 2));

    // Also test schedule sub-view
    console.log('Testing sub-view: schedule...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem('ksyn_active_view_employee', 'schedule');
        window.location.reload();
      })()`
    });
    await new Promise(r => setTimeout(r, 3000));

    const schedRes = await send('Runtime.evaluate', {
      expression: `(() => ({
        url: window.location.href,
        text: document.getElementById('root')?.innerText?.slice(0, 300),
        htmlLen: document.getElementById('root')?.innerHTML?.length || 0
      }))()`,
      returnByValue: true
    });
    console.log('Evaluation result on schedule subtab:', JSON.stringify(schedRes.result?.result?.value, null, 2));

    // Also test turnstile sub-view
    console.log('Testing sub-view: turnstile...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem('ksyn_active_view_employee', 'turnstile');
        window.location.reload();
      })()`
    });
    await new Promise(r => setTimeout(r, 3000));

    const turnstileRes = await send('Runtime.evaluate', {
      expression: `(() => ({
        url: window.location.href,
        text: document.getElementById('root')?.innerText?.slice(0, 300),
        htmlLen: document.getElementById('root')?.innerHTML?.length || 0
      }))()`,
      returnByValue: true
    });
    console.log('Evaluation result on turnstile subtab:', JSON.stringify(turnstileRes.result?.result?.value, null, 2));

    ws.close();
  } finally {
    try { edge.kill(); } catch (e) {}
  }
}

run().catch(console.error);
