const path = require('path');
const esbuild = require(path.join(__dirname, '../client/node_modules/esbuild'));
const fs = require('fs');

async function test() {
  const code = fs.readFileSync(path.join(__dirname, '../client/src/views/EmployeePortal.jsx'), 'utf8');

  // Transpile JSX to JS
  const result = await esbuild.transform(code, {
    loader: 'jsx',
    format: 'cjs',
    target: 'node18'
  });

  // Mock React and dependencies
  const mockReact = {
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: (fn) => {},
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn,
    createContext: () => ({}),
    createElement: (type, props, ...children) => ({ type, props, children })
  };

  const mockAuth = {
    user: { id: 'u1000000-0000-0000-0000-000000000002', name: 'Maya Lin', email: 'makati.staff@ksyn.com', role: 'employee', branch_id: 'b-mkt-01', branch_name: 'KSYN Fitness Makati' },
    authFetch: async () => ({ json: async () => ({ success: true }) })
  };

  const mockToast = {
    toast: {
      success: console.log,
      error: console.error,
      warning: console.warn,
      info: console.info
    }
  };

  // Create sandbox
  const vm = require('vm');
  const context = vm.createContext({
    console,
    Date,
    Math,
    String,
    Number,
    Array,
    Object,
    Set,
    Map,
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => 100 },
    window: {
      location: { pathname: '/dashboard/employee' },
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    navigator: { mediaDevices: {} },
    require: (mod) => {
      if (mod === 'react') return mockReact;
      if (mod === '../context/AuthContext') return { useAuth: () => mockAuth };
      if (mod === '../context/ToastContext') return { useToast: () => mockToast };
      if (mod === 'lucide-react') {
        return new Proxy({}, { get: (_, prop) => () => null });
      }
      if (mod === 'jsqr') return () => null;
      if (mod === '../components/DataTable') return () => null;
      if (mod === '../components/MemberOnboardingWizard') return () => null;
      return {};
    },
    exports: {},
    module: { exports: {} }
  });

  try {
    vm.runInContext(result.code, context);
    console.log('Transpile & Evaluation OK. Exported component:', typeof context.exports.default);

    const Component = context.module.exports.default || context.module.exports;
    console.log('Attempting to call EmployeePortal()...', typeof Component);
    const sections = ['turnstile', 'checkins', 'schedule', 'pos', 'drawer', 'lockers'];
    for (const sec of sections) {
      console.log(`Testing section [${sec}]...`);
      const rendered = Component({ activeSection: sec, activeTab: sec });
      console.log(`Section [${sec}] rendered OK! Type:`, rendered?.type);
    }
  } catch (err) {
    console.error('CRASHED DURING RENDER!');
    console.error(err);
  }
}

test();
