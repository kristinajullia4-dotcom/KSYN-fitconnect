import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Lock,
  Search,
  RefreshCw,
  Key,
  Check,
  X,
  AlertTriangle,
  FileText
} from 'lucide-react';

export default function BranchOwnerStaffManagement() {
  const { user, authFetch } = useAuth();
  const { toast } = useToast();

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [resettingStaff, setResettingStaff] = useState(null);

  // Form states
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'employee',
    canRefund: true,
    canModifyInventory: true,
    canExportReports: true
  });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    try {
      setLoading(true);
      const res = await authFetch('/api/branch-owner/staff');
      const data = await res.json();
      if (res.ok && data.success) {
        setStaffList(data.staff || []);
      } else {
        // Fallback to roles-and-permissions if needed
        const fallbackRes = await authFetch('/api/roles-and-permissions/staff');
        const fallbackData = await fallbackRes.json();
        if (fallbackRes.ok && fallbackData.success) {
          setStaffList(fallbackData.staff || []);
        }
      }
    } catch (err) {
      console.error('Failed to load branch staff:', err);
      toast.error('Network error loading branch staff roster.', 'Roster Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleCreateStaff(e) {
    e.preventDefault();
    if (!addForm.fullName.trim() || !addForm.email.trim() || !addForm.password) {
      toast.error('Please complete all required fields.', 'Validation Error');
      return;
    }
    if (addForm.password.length < 8) {
      toast.error('Temporary password must be at least 8 characters long.', 'Password Policy');
      return;
    }

    try {
      setSubmittingAdd(true);
      const payload = {
        fullName: addForm.fullName.trim(),
        email: addForm.email.trim(),
        password: addForm.password,
        role: addForm.role,
        operationalPermissions: {
          canRefund: addForm.canRefund,
          canModifyInventory: addForm.canModifyInventory,
          canExportReports: addForm.canExportReports
        }
      };

      const res = await authFetch('/api/branch-owner/staff', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Staff member '${payload.fullName}' provisioned successfully!`, 'Account Provisioned');
        setShowAddModal(false);
        setAddForm({
          fullName: '',
          email: '',
          password: '',
          role: 'employee',
          canRefund: true,
          canModifyInventory: true,
          canExportReports: true
        });
        loadStaff();
      } else {
        toast.error(data.message || 'Failed to create staff member.', 'Provisioning Error');
      }
    } catch (err) {
      console.error('Error creating staff:', err);
      toast.error('Network error creating staff member.', 'Error');
    } finally {
      setSubmittingAdd(false);
    }
  }

  async function handleToggleStatus(staff) {
    const isCurrentlyActive = staff.status === 'active' && staff.is_active !== false;
    const newStatus = isCurrentlyActive ? 'inactive' : 'active';
    try {
      const res = await authFetch(`/api/branch-owner/staff/${staff.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Account for '${staff.name}' is now ${newStatus}.`, 'Status Updated');
        loadStaff();
      } else {
        toast.error(data.message || 'Failed to toggle status.', 'Status Error');
      }
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error('Network error updating status.', 'Error');
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resettingStaff || !resetPasswordVal || resetPasswordVal.length < 8) {
      toast.error('Temporary password must be at least 8 characters long.', 'Password Policy');
      return;
    }

    try {
      setSubmittingReset(true);
      const res = await authFetch(`/api/branch-owner/staff/${resettingStaff.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPasswordVal })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Temporary password reset for '${resettingStaff.name}'.`, 'Password Reset');
        setResettingStaff(null);
        setResetPasswordVal('');
      } else {
        toast.error(data.message || 'Failed to reset password.', 'Reset Error');
      }
    } catch (err) {
      console.error('Error resetting password:', err);
      toast.error('Network error resetting password.', 'Error');
    } finally {
      setSubmittingReset(false);
    }
  }

  const filteredStaff = staffList.filter(s => {
    if (s.role === 'member' || s.role === 'super_admin' || s.role === 'branch_owner') return false;
    if (String(s.id) === String(user?.id)) return false;
    if (roleFilter !== 'all') {
      const normRole = s.role === 'trainer' ? 'coach' : (s.role === 'staff' ? 'employee' : s.role);
      if (normRole !== roleFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (s.name || '').toLowerCase().includes(q);
      const matchEmail = (s.email || '').toLowerCase().includes(q);
      const matchRole = (s.role || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchRole) return false;
    }
    return true;
  });

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div className="ksyn-card" style={{
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        borderLeft: '4px solid #e1c256',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'rgba(225, 194, 86, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#e1c256',
            flexShrink: 0
          }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                Branch Staff & Operational Personnel
              </h3>
              <span style={{
                background: 'rgba(225, 194, 86, 0.15)',
                color: '#e1c256',
                border: '1px solid rgba(225, 194, 86, 0.35)',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Lock size={11} /> {user?.branch_code || 'MKT-01'} Scoped
              </span>
            </div>
            <p style={{ margin: '3px 0 0', color: '#9ca3af', fontSize: '0.8125rem' }}>
              Direct authority to provision, configure permissions, and manage personnel for <strong style={{ color: '#e1c256' }}>{user?.branch_name || 'your assigned facility'}</strong>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              loadStaff();
            }}
            className="ksyn-btn ksyn-btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', padding: '8px 14px' }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh Roster
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="ksyn-btn ksyn-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', padding: '8px 16px', fontWeight: 700 }}
          >
            <UserPlus size={15} /> + Add Branch Staff & Managers
          </button>
        </div>
      </div>

      {/* Roster Table Card */}
      <div className="ksyn-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Controls Bar */}
        <div style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid #1e2230',
          background: '#0e111a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 600 }}>Filter by Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="ksyn-input"
              style={{ fontSize: '0.8125rem', padding: '6px 12px', background: '#141824', borderColor: '#262d40', color: '#ffffff' }}
            >
              <option value="all">All Operational Roles ({filteredStaff.length})</option>
              <option value="branch_admin">Branch Administrators</option>
              <option value="coach">Fitness Coaches</option>
              <option value="employee">Front-Desk Staff</option>
            </select>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} color="#6b7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search employee name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ksyn-input"
              style={{ paddingLeft: '36px', width: '100%', fontSize: '0.8125rem', background: '#141824', borderColor: '#262d40' }}
            />
          </div>
        </div>

        {/* Scrollable Table */}
        <div style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          maxHeight: '480px',
          overflowY: 'auto',
          overflowX: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#2d3748 #0e111a'
        }} className="ksyn-custom-scrollbar table-infinite">
          <table className="ksyn-table" style={{ width: '100%', minWidth: '550px', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0e111a' }}>
              <tr style={{ background: '#0e111a', borderBottom: '1px solid #1f2433', color: '#9ca3af', textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.05em' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>EMPLOYEE NAME</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>ROLE</th>
                <th style={{ textAlign: 'center', padding: '12px 16px' }}>STATUS</th>
                <th style={{ textAlign: 'right', padding: '12px 16px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map(s => {
                const isActive = s.status === 'active' && s.is_active !== false;
                const normRole = s.role === 'trainer' ? 'coach' : (s.role === 'staff' ? 'employee' : s.role);

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #1a1e2d' }}>
                    {/* Employee Name & Contact */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.875rem' }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{s.email}</div>
                      {s.phone && s.phone !== '—' && (
                        <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '2px' }}>{s.phone}</div>
                      )}
                    </td>

                    {/* Role Badge */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: normRole === 'branch_admin'
                          ? 'rgba(225, 194, 86, 0.15)'
                          : (normRole === 'coach' ? 'rgba(101, 130, 86, 0.18)' : 'rgba(56, 189, 248, 0.15)'),
                        color: normRole === 'branch_admin'
                          ? '#e1c256'
                          : (normRole === 'coach' ? '#86efac' : '#93c5fd'),
                        border: `1px solid ${normRole === 'branch_admin' ? 'rgba(225, 194, 86, 0.35)' : (normRole === 'coach' ? 'rgba(101, 130, 86, 0.35)' : 'rgba(56, 189, 248, 0.35)')}`
                      }}>
                        <Shield size={12} />
                        {normRole === 'branch_admin' ? 'Branch Administrator' : (normRole === 'coach' ? 'Fitness Coach' : 'Front Desk Staff')}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: isActive ? '#658256' : '#ef4444',
                        background: isActive ? 'rgba(101, 130, 86, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        border: `1px solid ${isActive ? 'rgba(101, 130, 86, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
                      }}>
                        {isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setResettingStaff(s);
                            setResetPasswordVal('KSYN@2026!');
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: '#1a1d1e',
                            color: '#e1c256',
                            border: '1px solid rgba(225, 194, 86, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Reset temporary credentials"
                        >
                          <Key size={11} /> Reset Pass
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(s)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: isActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(101, 130, 86, 0.15)',
                            color: isActive ? '#f87171' : '#86efac',
                            border: `1px solid ${isActive ? 'rgba(239, 68, 68, 0.35)' : 'rgba(101, 130, 86, 0.4)'}`
                          }}
                        >
                          {isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStaff.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '36px', color: '#6b7280' }}>
                    No branch personnel found matching the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD BRANCH STAFF & MANAGERS */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <div className="ksyn-card" style={{ maxWidth: '540px', width: '100%', background: '#12151c', border: '1px solid #e1c256', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1f2533', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} color="#e1c256" /> Add Branch Staff & Manager
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="ksyn-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  className="ksyn-input"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm(f => ({ ...f, fullName: e.target.value }))}
                />
              </div>

              <div>
                <label className="ksyn-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af' }}>Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. maria.santos@ksyn.com"
                  className="ksyn-input"
                  value={addForm.email}
                  onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="ksyn-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af' }}>Temporary Password (Min. 8 characters) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KSYN@2026!"
                  className="ksyn-input"
                  value={addForm.password}
                  onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))}
                />
                <span style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '3px', display: 'block' }}>
                  The employee will be required to change this password upon their first login.
                </span>
              </div>

              <div>
                <label className="ksyn-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af' }}>Operational Role Assignment *</label>
                <select
                  className="ksyn-input"
                  value={addForm.role}
                  onChange={(e) => setAddForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="branch_admin">Branch Admin (General Manager)</option>
                  <option value="coach">Coach / Fitness Trainer</option>
                  <option value="employee">Front-Desk Staff / Cashier</option>
                </select>
              </div>

              {/* Facility Scoping Notice (strictly locked, NO tenant dropdown) */}
              <div style={{
                background: '#0a0d13',
                border: '1px solid #1a2233',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.75rem',
                color: '#94a3b8'
              }}>
                <Lock size={14} color="#e1c256" />
                <span>Facility Tenant: <strong style={{ color: '#e1c256' }}>{user?.branch_name || 'Home Branch'}</strong> (Immutable)</span>
              </div>

              {/* Operational Permissions Checkboxes */}
              <div>
                <label className="ksyn-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '8px', display: 'block' }}>
                  Operational Permissions
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#0a0d13', padding: '12px', borderRadius: '8px', border: '1px solid #1a2233' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#e2e8f0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={addForm.canRefund}
                      onChange={(e) => setAddForm(f => ({ ...f, canRefund: e.target.checked }))}
                      style={{ accentColor: '#e1c256', width: '15px', height: '15px' }}
                    />
                    Can Process Voids &amp; Refunds
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#e2e8f0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={addForm.canModifyInventory}
                      onChange={(e) => setAddForm(f => ({ ...f, canModifyInventory: e.target.checked }))}
                      style={{ accentColor: '#e1c256', width: '15px', height: '15px' }}
                    />
                    Can Conduct Equipment &amp; Stock Audits
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#e2e8f0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={addForm.canExportReports}
                      onChange={(e) => setAddForm(f => ({ ...f, canExportReports: e.target.checked }))}
                      style={{ accentColor: '#e1c256', width: '15px', height: '15px' }}
                    />
                    Can View End-of-Day Shift Reports
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="ksyn-btn"
                  style={{ background: '#1a1f2c', color: '#9ca3af', border: '1px solid #28334a' }}
                  disabled={submittingAdd}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ksyn-btn ksyn-btn-primary"
                  disabled={submittingAdd}
                >
                  {submittingAdd ? 'Provisioning Staff...' : 'Confirm & Provision Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RESET TEMPORARY PASSWORD */}
      {/* ========================================================================= */}
      {resettingStaff && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <div className="ksyn-card" style={{ maxWidth: '440px', width: '100%', background: '#12151c', border: '1px solid #e1c256', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #1f2533', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={16} color="#e1c256" /> Reset Temporary Password
              </h2>
              <button
                type="button"
                onClick={() => setResettingStaff(null)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0 0 14px' }}>
              Issue a temporary password for <strong style={{ color: '#ffffff' }}>{resettingStaff.name}</strong> ({resettingStaff.email}). The user will be required to change it on their next login.
            </p>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="ksyn-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af' }}>New Temporary Password</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KSYN@2026!"
                  className="ksyn-input"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setResettingStaff(null)}
                  className="ksyn-btn"
                  style={{ background: '#1a1f2c', color: '#9ca3af', border: '1px solid #28334a' }}
                  disabled={submittingReset}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ksyn-btn ksyn-btn-primary"
                  disabled={submittingReset}
                >
                  {submittingReset ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
