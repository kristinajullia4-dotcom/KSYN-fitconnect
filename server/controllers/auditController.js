const { memoryStore, query, isPostgres } = require('../config/db');

// Get Immutable System Audit Trail (ISO 27001 & RA 10173 compliance)
async function getAuditLogs(req, res) {
  try {
    const user = req.user;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : null;
    const offset = limit ? (page - 1) * limit : 0;

    let total = 0;
    let enriched = [];

    if (isPostgres()) {
      let countSql = 'SELECT COUNT(*) FROM audit_logs';
      let sql = `
        SELECT a.id, a.branch_id, a.user_id, a.user_role, a.action, a.resource, a.ip_address,
               a.details, a.prev_hash, a.hash, a.created_at,
               COALESCE(b.name, 'Corporate HQ') AS branch_name,
               COALESCE(u.name, 'System') AS actor_name
        FROM audit_logs a
        LEFT JOIN branches b ON a.branch_id = b.id
        LEFT JOIN users u ON a.user_id = u.id
      `;
      const params = [];
      if (user.role !== 'super_admin') {
        countSql += ' WHERE branch_id = $1';
        sql += ' WHERE a.branch_id = $1';
        params.push(user.branch_id);
      }
      sql += ' ORDER BY a.created_at DESC';
      if (limit) {
        sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
      }
      const countRes = await query(countSql, user.role !== 'super_admin' ? [user.branch_id] : []);
      total = parseInt(countRes.rows[0].count, 10);
      const dataRes = await query(sql, params);
      enriched = dataRes.rows;
    } else {
      let logs = [...(memoryStore.audit_logs || [])];
      if (user.role !== 'super_admin') {
        logs = logs.filter(l => l.branch_id === user.branch_id);
      }
      total = logs.length;
      if (limit) {
        logs = logs.slice(offset, offset + limit);
      }

      enriched = logs.map(log => {
        const branch = (memoryStore.branches || []).find(b => b.id === log.branch_id);
        const actor = (memoryStore.users || []).find(u => u.id === log.user_id);

        return {
          ...log,
          branch_name: branch ? branch.name : (log.branch_id ? 'Unknown' : 'Corporate HQ'),
          actor_name: actor ? actor.name : 'System'
        };
      });
    }

    const response = { success: true, logs: enriched };
    if (limit) {
      response.pagination = {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAuditLogs
};
