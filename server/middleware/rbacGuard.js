/**
 * Role-Based Access Control (RBAC) Guard Middleware
 * Restricts route access strictly to authorized role tiers
 */
function rbacGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication required before authorization verification.'
      });
    }

    const userRole = req.user.role;
    const roleAliases = {
      'branch_owner': ['branch_owner'], // Strictly isolated investor role
      'branch_admin': ['branch_admin'],
      'staff': ['employee', 'staff'],
      'employee': ['employee', 'staff'],
      'coach': ['coach', 'trainer'],
      'trainer': ['coach', 'trainer']
    };
    const effectiveRoles = roleAliases[userRole] || [userRole];
    const isAllowed = allowedRoles.some(r => effectiveRoles.includes(r));

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_INSUFFICIENT_PRIVILEGES',
        message: `Role '${req.user.role}' does not possess required authorization credentials.`
      });
    }

    next();
  };
}

/**
 * Tenant Isolation & IDOR Guard
 * Ensures branch_admin and employee can never query or manipulate data from a different branch
 */
function enforceTenantIsolation(req, res, next) {
  const user = req.user;
  if (!user) return next();

  // Super Admin has global cross-tenant visibility
  if (user.role === 'super_admin') {
    return next();
  }

  // Branch-specific roles must match the target branch_id in query or body
  const targetBranchId = req.params.branchId || req.body.branch_id || req.query.branch_id;

  if (targetBranchId && targetBranchId !== user.branch_id) {
    return res.status(403).json({
      success: false,
      error: 'TENANT_ISOLATION_VIOLATION',
      message: 'Access Denied: Cross-tenant data operations are strictly prohibited by KSYN Security Policy.'
    });
  }

  next();
}

module.exports = {
  rbacGuard,
  enforceTenantIsolation
};
