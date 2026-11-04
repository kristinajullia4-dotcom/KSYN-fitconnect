const jwt = require('jsonwebtoken');
const { memoryStore, query, isPostgres } = require('../config/db');
const { JWT_SECRET } = require('../config/secrets');

function extractCookie(req, name) {
  if (req.cookies && req.cookies[name]) return req.cookies[name];
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function authGuard(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      // Fallback to secure HTTP-only cookie
      token = extractCookie(req, 'ksyn_token') || extractCookie(req, 'token');
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Access denied. Missing Authorization header or security session cookie.'
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_INVALID_OR_EXPIRED',
        message: 'Security token has expired or signature verification failed.'
      });
    }

    // Check if token has been revoked / blacklisted upon logout
    if (memoryStore.revoked_tokens && memoryStore.revoked_tokens.has(token)) {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_REVOKED',
        message: 'Security session has been terminated. Please log in again.'
      });
    }

    // Verify user still exists and is active
    let user;
    if (isPostgres()) {
      const result = await query(
        'SELECT id, role, branch_id, email, name, status FROM users WHERE id = $1',
        [decoded.id]
      );
      user = result.rows[0];
    } else {
      user = memoryStore.users.find(u => u.id === decoded.id);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Associated user account could not be found.'
      });
    }

    if (user.status === 'suspended' || user.status === 'banned' || user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been deactivated or suspended by gym management.'
      });
    }

    // Attach user information and RLS tenant context
    req.user = {
      id: user.id,
      role: user.role,
      branch_id: user.branch_id,
      email: user.email,
      name: user.name,
      status: user.status
    };

    req.context = {
      userId: user.id,
      role: user.role,
      branchId: user.branch_id
    };

    next();
  } catch (error) {
    console.error('[authGuard Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'AUTH_INTERNAL_ERROR',
      message: 'Failed to authenticate request.'
    });
  }
}

module.exports = authGuard;
