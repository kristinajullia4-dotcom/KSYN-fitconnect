const express = require('express');
const router = express.Router();
const authGuard = require('../middleware/authGuard');
const { rbacGuard } = require('../middleware/rbacGuard');
const { memoryStore } = require('../config/db');
const { sendSms } = require('../utils/smsGateway');

router.use(authGuard);

// 1. View SMS Audit Logs
router.get('/sms/logs', rbacGuard('super_admin', 'branch_admin'), (req, res) => {
  const logs = memoryStore.sms_audit_logs || [];
  res.json({
    success: true,
    count: logs.length,
    logs
  });
});

// 2. Dispatch Direct Administrative SMS
router.post('/sms/send', rbacGuard('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { recipient, message, category = 'ADMIN_DISPATCH' } = req.body;
    if (!recipient || !message) {
      return res.status(400).json({ success: false, message: 'Recipient phone number and message text are required.' });
    }

    const result = await sendSms(recipient, message, {
      category,
      dispatched_by: req.user.name,
      branch_id: req.user.branch_id
    });

    res.status(201).json({
      success: true,
      message: 'SMS message dispatched to gateway.',
      sms: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Multi-Tenant Notification Feed
router.get('/', (req, res) => {
  const user = req.user;
  const allNotifs = memoryStore.notifications || [];

  let filtered = [];
  if (user.role === 'super_admin') {
    filtered = allNotifs;
  } else if (['branch_admin', 'branch_owner', 'front_desk'].includes(user.role)) {
    // Branch admin sees notifications targeted to their branch, their role, or their user ID
    filtered = allNotifs.filter(n =>
      (n.branch_id === user.branch_id || !n.branch_id) &&
      (n.target_role === 'branch_admin' || !n.target_role || n.target_user_id === user.id)
    );
  } else {
    // Member or Coach sees notifications explicitly targeted to them
    filtered = allNotifs.filter(n => n.target_user_id === user.id || (n.target_role === user.role && n.branch_id === user.branch_id));
  }

  res.json({
    success: true,
    count: filtered.length,
    notifications: filtered
  });
});

// 4. Mark Notification as Read
router.patch('/:id/read', (req, res) => {
  const { id } = req.params;
  const notif = (memoryStore.notifications || []).find(n => n.id === id);
  if (notif) {
    notif.read = true;
  }
  res.json({ success: true, message: 'Notification marked as read.' });
});

module.exports = router;
