import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  Dumbbell, 
  ShoppingCart, 
  Layers, 
  Calendar, 
  ArrowUpRight,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function XenditTransactionsLedger({ defaultChannel = 'plans', branchId = null }) {
  const { authFetch, user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState(defaultChannel); // 'plans' | 'pos' | 'pt' | 'all'
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {
      total_volume: 0,
      plans_volume: 0,
      pos_volume: 0,
      pt_volume: 0,
      total_count: 0,
      plans_count: 0,
      pos_count: 0,
      pt_count: 0,
      settled_count: 0,
      pending_count: 0
    },
    categories: {
      plans: [],
      pos: [],
      pt_enrollments: []
    },
    all: []
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'SETTLED' | 'PENDING'
  const [simulatingId, setSimulatingId] = useState(null);
  const [reconciling, setReconciling] = useState(false);

  const handleReconcile = async () => {
    try {
      setReconciling(true);
      const res = await authFetch('/api/payments/xendit/reconcile', { method: 'POST' });
      const resData = await res.json();
      if (resData.success) {
        toast.success(resData.message || 'Live gateway synchronization complete.', 'Xendit Reconciled');
        await fetchTransactions();
      } else {
        toast.error(resData.message || 'Reconciliation failed.', 'Error');
      }
    } catch (err) {
      console.error('Reconciliation error:', err);
      toast.error('Failed to reconcile with Xendit gateway.', 'Error');
    } finally {
      setReconciling(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const url = branchId 
        ? `/api/payments/xendit/transactions?branch_id=${branchId}`
        : '/api/payments/xendit/transactions';
      const res = await authFetch(url);
      const resData = await res.json();
      if (resData.success) {
        setData(resData);
      } else {
        toast.error(resData.message || 'Failed to fetch Xendit transactions.', 'Ledger Error');
      }
    } catch (err) {
      console.error('[XenditTransactionsLedger] Error:', err);
      toast.error('Network error loading Xendit transactions.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [branchId]);

  // Handle simulating a pending invoice settlement (for staging)
  const handleSimulatePaid = async (externalId, invoiceId) => {
    try {
      setSimulatingId(externalId || invoiceId);
      const res = await authFetch('/api/payments/xendit/simulate-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_id: externalId,
          invoice_id: invoiceId
        })
      });
      const resData = await res.json();
      if (resData.success) {
        toast.success(resData.message || 'Payment simulated as Settled in staging.', 'Simulated Paid');
        await fetchTransactions();
      } else {
        toast.error(resData.message || 'Simulation failed.', 'Simulation Error');
      }
    } catch (err) {
      console.error('Simulate paid error:', err);
      toast.error('Failed to trigger simulation.', 'Error');
    } finally {
      setSimulatingId(null);
    }
  };

  // Get active items according to selected channel
  const currentItems = useMemo(() => {
    if (activeTab === 'plans') return data.categories?.plans || [];
    if (activeTab === 'pos') return data.categories?.pos || [];
    if (activeTab === 'pt') return data.categories?.pt_enrollments || [];
    return data.all || [];
  }, [activeTab, data]);

  // Filter items by search and status
  const filteredItems = useMemo(() => {
    return currentItems.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const matchRef = (item.external_id || '').toLowerCase().includes(q);
      const matchName = (item.customer_name || '').toLowerCase().includes(q);
      const matchEmail = (item.customer_email || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchCoach = (item.details?.coach_name || '').toLowerCase().includes(q);
      const matchBranch = (item.branch_name || '').toLowerCase().includes(q);
      return matchRef || matchName || matchEmail || matchDesc || matchCoach || matchBranch;
    });
  }, [currentItems, searchQuery, statusFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      toast.info('No transactions to export for the selected filter.', 'Empty Export');
      return;
    }
    const headers = ['Date', 'Reference ID', 'Channel', 'Customer Name', 'Customer Email', 'Branch', 'Amount (PHP)', 'Status', 'Payment Rail', 'Description'];
    const rows = filteredItems.map(i => [
      `"${new Date(i.created_at).toLocaleString()}"`,
      `"${i.external_id}"`,
      `"${i.channel}"`,
      `"${i.customer_name}"`,
      `"${i.customer_email}"`,
      `"${i.branch_name}"`,
      i.amount,
      `"${i.status}"`,
      `"${i.payment_rail}"`,
      `"${(i.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ksyn_xendit_${activeTab}_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredItems.length} transactions to CSV.`, 'Export Success');
  };

  const formatCurrency = (amt) => {
    return '₱' + Number(amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* KPI Financial Overview Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Xendit Volume */}
        <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[135px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              TOTAL XENDIT VOLUME
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
              <TrendingUp size={18} className="text-emerald-400" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-emerald-400">
              {formatCurrency(data.summary?.total_volume)}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 gap-2">
            <span>{data.summary?.total_count || 0} Total Digital Orders</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-emerald-400 border border-[#333]">
              {data.summary?.settled_count || 0} Settled
            </span>
          </div>
        </div>

        {/* 2. Membership Plans Volume */}
        <div 
          onClick={() => setActiveTab('plans')}
          className={`bg-[#121212] border rounded-xl p-5 flex flex-col justify-between min-h-[135px] cursor-pointer transition-all ${
            activeTab === 'plans' ? 'border-[#e1c256] shadow-lg shadow-[#e1c256]/5' : 'border-[#262626] hover:border-[#383838]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              MEMBERSHIP PLANS
            </span>
            <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
              <Layers size={18} className="text-[#e1c256]" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-[#e1c256]">
              {formatCurrency(data.summary?.plans_volume)}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 gap-2">
            <span>{data.summary?.plans_count || 0} Invoices</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-[#e1c256] border border-[#333]">
              Passes & Renewals
            </span>
          </div>
        </div>

        {/* 3. Front-Desk POS Volume */}
        <div 
          onClick={() => setActiveTab('pos')}
          className={`bg-[#121212] border rounded-xl p-5 flex flex-col justify-between min-h-[135px] cursor-pointer transition-all ${
            activeTab === 'pos' ? 'border-[#658256] shadow-lg shadow-[#658256]/5' : 'border-[#262626] hover:border-[#383838]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              FRONT-DESK POS RETAIL
            </span>
            <div className="p-2 rounded-lg bg-[#658256]/15 shrink-0">
              <ShoppingCart size={18} className="text-[#84a971]" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-[#84a971]">
              {formatCurrency(data.summary?.pos_volume)}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 gap-2">
            <span>{data.summary?.pos_count || 0} Transactions</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-[#84a971] border border-[#333]">
              Retail & Shakes
            </span>
          </div>
        </div>

        {/* 4. PT Enrollments Volume */}
        <div 
          onClick={() => setActiveTab('pt')}
          className={`bg-[#121212] border rounded-xl p-5 flex flex-col justify-between min-h-[135px] cursor-pointer transition-all ${
            activeTab === 'pt' ? 'border-[#f7ffc4] shadow-lg shadow-[#f7ffc4]/5' : 'border-[#262626] hover:border-[#383838]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              PT ENROLLMENTS
            </span>
            <div className="p-2 rounded-lg bg-[#f7ffc4]/10 shrink-0">
              <Dumbbell size={18} className="text-[#f7ffc4]" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-[#f7ffc4]">
              {formatCurrency(data.summary?.pt_volume)}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 gap-2">
            <span>{data.summary?.pt_count || 0} Contracts</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-[#f7ffc4] border border-[#333]">
              1-on-1 Packages
            </span>
          </div>
        </div>
      </div>

      {/* Main Ledger Card */}
      <div className="w-full rounded-2xl border border-[#222222] bg-[#121212] p-6 shadow-xl space-y-5">
        {/* Header Controls Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={20} className="text-[#e1c256]" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Xendit Gateway Digital Ledger
                </h2>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                Audited real-time breakdown of all digital transactions across Plans, Front Desk POS, and Personal Training enrollments.
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', padding: '4px 10px', background: 'rgba(225, 194, 86, 0.08)', border: '1px solid rgba(225, 194, 86, 0.25)', borderRadius: '6px', fontSize: '0.72rem', color: '#e1c256' }}>
                <span>Payment Rails: Xendit Hosted Checkout, QR Ph, E-Wallets (GCash/Maya), Cards</span>
                <span style={{ color: '#6b7280' }}>•</span>
                <span style={{ color: '#d1d5db' }}>Physical Cash payments are tracked in Front-Desk Shift Drawer & Sales Ledger</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {user?.role === 'super_admin' && (
                <a
                  href="https://dashboard.xendit.co/transactions?status=SUCCESSFUL&page_size=40"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e1c256]/50 bg-[#e1c256]/15 hover:bg-[#e1c256]/25 text-[#e1c256] hover:text-[#f3d778] text-xs font-bold cursor-pointer transition-all shadow-sm"
                  title="Open live Xendit Merchant Dashboard in a new tab"
                >
                  <ExternalLink size={13} />
                  <span>Live Xendit Dashboard</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleReconcile}
                disabled={reconciling || loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e1c256]/40 bg-[#e1c256]/10 hover:bg-[#e1c256]/20 text-[#e1c256] hover:text-[#f3d778] text-xs font-semibold cursor-pointer transition-all"
                title="Reconcile pending invoices with live Xendit status"
              >
                <RefreshCw size={13} className={reconciling ? 'animate-spin' : ''} />
                <span>{reconciling ? 'Syncing...' : 'Sync Live Gateway'}</span>
              </button>

              <button
                type="button"
                onClick={fetchTransactions}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#202020] text-gray-300 hover:text-white text-xs font-semibold cursor-pointer transition-all"
                title="Refresh Ledger"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#202020] text-gray-200 hover:text-white text-xs font-semibold tracking-wide transition-all shadow-sm cursor-pointer"
              >
                <Download size={14} className="text-emerald-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* 4-Channel Tab Switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#161616', padding: '12px', borderRadius: '12px', border: '1px solid #242424' }}>
            {/* Separate Channel Tables Switcher */}
            <div className="inline-flex items-center bg-[#181818] p-1 rounded-xl border border-[#2B2B2B] gap-1 flex-wrap">
              {[
                { id: 'plans', label: 'Membership Plans', count: data.categories?.plans?.length || 0, icon: Layers, color: '#e1c256' },
                { id: 'pos', label: 'Front-Desk POS', count: data.categories?.pos?.length || 0, icon: ShoppingCart, color: '#84a971' },
                { id: 'pt', label: 'PT Enrollments', count: data.categories?.pt_enrollments?.length || 0, icon: Dumbbell, color: '#f7ffc4' },
                { id: 'all', label: 'All Transactions', count: data.all?.length || 0, icon: CreditCard, color: '#ffffff' }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#2a2a2a] text-white shadow-md border border-[#444]' 
                        : 'text-gray-400 hover:text-white hover:bg-[#222]'
                    }`}
                  >
                    <Icon size={14} style={{ color: isActive ? tab.color : '#888' }} />
                    <span>{tab.label}</span>
                    <span style={{
                      fontSize: '0.6875rem',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      background: isActive ? tab.color : '#222',
                      color: isActive ? '#000000' : '#888',
                      fontWeight: 800
                    }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search & Status Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  placeholder={`Search ${activeTab.toUpperCase()} transactions...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ksyn-input"
                  style={{ height: '34px', fontSize: '0.8125rem', paddingLeft: '32px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} color="#9ca3af" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="ksyn-select"
                  style={{ height: '34px', fontSize: '0.8125rem', padding: '0 10px' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="SETTLED">Settled / Paid</option>
                  <option value="PENDING">Pending Checkout</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Table Content with infinite scroll & bounded height */}
        <div
          className="overflow-x-auto overflow-y-auto w-full rounded-xl border border-[#222222] ksyn-custom-scrollbar table-infinite"
          style={{ maxHeight: '340px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#e1c256 #101311' }}
        >
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#161616] shadow-sm">
              <tr>
                <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[130px] whitespace-nowrap">
                  Date & Time
                </th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[130px] whitespace-nowrap">
                  Reference #
                </th>
                {activeTab === 'all' && (
                  <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[120px] whitespace-nowrap">
                    Channel
                  </th>
                )}
                <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[140px] whitespace-nowrap">
                  Customer / Member
                </th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[180px]">
                  {activeTab === 'plans' ? 'Plan Tier & Duration' : activeTab === 'pos' ? 'Retail / Order Items' : activeTab === 'pt' ? 'Coach & Package Plan' : 'Item / Channel Details'}
                </th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[120px] whitespace-nowrap">
                  Payment Rail
                </th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[100px] whitespace-nowrap">
                  Amount
                </th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[100px] whitespace-nowrap">
                  Status
                </th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#161616] first:rounded-l-lg last:rounded-r-lg min-w-[130px] text-right whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'all' ? 9 : 8} className="px-3 py-10 text-center text-sm font-semibold text-[#e1c256] border-b border-[#1F1F1F]">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <RefreshCw size={16} className="animate-spin text-[#e1c256]" />
                      <span>Loading Xendit digital transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'all' ? 9 : 8} className="px-3 py-10 text-center text-sm text-gray-400 border-b border-[#1F1F1F]">
                    No {activeTab.toUpperCase()} transactions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isSettled = item.status === 'SETTLED';
                  const isPending = item.status === 'PENDING';
                  return (
                    <tr key={item.id || item.external_id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Date */}
                      <td className="px-3 py-2.5 text-xs text-gray-300 font-mono border-b border-[#1F1F1F] whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </td>

                      {/* Reference # */}
                      <td className="px-3 py-2.5 text-xs font-mono font-bold border-b border-[#1F1F1F] whitespace-nowrap">
                        <span style={{ color: item.channel === 'PT ENROLLMENT' ? '#f7ffc4' : item.channel === 'POS' ? '#84a971' : '#e1c256' }}>
                          {item.external_id}
                        </span>
                      </td>

                      {/* Channel Badge (if viewing All) */}
                      {activeTab === 'all' && (
                        <td className="px-3 py-2.5 text-xs border-b border-[#1F1F1F] whitespace-nowrap">
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: item.channel === 'PT ENROLLMENT' ? 'rgba(247, 255, 196, 0.12)' : item.channel === 'POS' ? 'rgba(101, 130, 86, 0.15)' : 'rgba(225, 194, 86, 0.12)',
                            color: item.channel === 'PT ENROLLMENT' ? '#f7ffc4' : item.channel === 'POS' ? '#84a971' : '#e1c256',
                            border: '1px solid rgba(255,255,255,0.06)'
                          }}>
                            {item.channel}
                          </span>
                        </td>
                      )}

                      {/* Customer / Member */}
                      <td className="px-3 py-2.5 border-b border-[#1F1F1F] whitespace-nowrap">
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff' }}>
                          {item.customer_name || 'Valued Athlete'}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                          {item.customer_email || '—'}
                        </div>
                      </td>

                      {/* Channel-Specific Details */}
                      <td className="px-3 py-2.5 text-xs text-gray-300 border-b border-[#1F1F1F]">
                        {item.channel === 'PT ENROLLMENT' ? (
                          <div>
                            <span style={{ fontWeight: 700, color: '#f7ffc4' }}>
                              {item.details?.coach_name ? `Coach ${item.details.coach_name}` : 'Coach 1-on-1'}
                            </span>
                            <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                              {item.details?.package_name || item.description} ({item.details?.sessions || 12} sessions)
                            </div>
                          </div>
                        ) : item.channel === 'POS' ? (
                          <div>
                            <span style={{ fontWeight: 600, color: '#e5e7eb' }}>
                              {item.description}
                            </span>
                            {item.details?.cashier_name && (
                              <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                                Cashier: {item.details.cashier_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span style={{ fontWeight: 600, color: '#e1c256' }}>
                              {item.description || 'Membership Plan'}
                            </span>
                            <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                              {item.branch_name}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Payment Rail */}
                      <td className="px-3 py-2.5 text-xs text-gray-300 border-b border-[#1F1F1F] whitespace-nowrap">
                        <span style={{
                          display: 'inline-block',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: '#1c1c1c',
                          color: '#d1d5db',
                          border: '1px solid #333'
                        }}>
                          {item.payment_rail}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-2.5 text-xs font-mono font-bold text-white border-b border-[#1F1F1F] whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 text-xs border-b border-[#1F1F1F] whitespace-nowrap">
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: isSettled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isSettled ? '#34d399' : '#fbbf24',
                          border: `1px solid ${isSettled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                        }}>
                          {isSettled ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                          <span>{item.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 text-xs border-b border-[#1F1F1F] text-right whitespace-nowrap">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {item.invoice_url && (
                            <a
                              href={item.invoice_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1f1f1f] hover:bg-[#2a2a2a] text-gray-300 hover:text-white text-[11px] font-semibold border border-[#333] transition-colors"
                              title="Open Xendit Hosted Checkout Screen"
                            >
                              <span>Invoice</span>
                              <ExternalLink size={10} />
                            </a>
                          )}

                          {isPending && (
                            <button
                              type="button"
                              disabled={simulatingId === (item.external_id || item.id)}
                              onClick={() => handleSimulatePaid(item.external_id, item.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 text-[11px] font-bold border border-amber-500/30 transition-colors cursor-pointer"
                              title="Simulate payment confirmation in staging sandbox"
                            >
                              {simulatingId === (item.external_id || item.id) ? (
                                <RefreshCw size={10} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={10} />
                              )}
                              <span>Simulate Paid</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
