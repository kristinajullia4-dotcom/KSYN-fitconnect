/**
 * Admin Controller
 * Re-exports and extends Super Admin Controller for franchise and corporate governance
 */
const superAdminController = require('./superAdminController');

module.exports = {
  ...superAdminController
};
