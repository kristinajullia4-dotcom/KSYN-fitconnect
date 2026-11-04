import React from 'react';
import EmployeePortal from './EmployeePortal';

/**
 * StaffDashboard Component
 * Re-exports EmployeePortal for role dashboard compatibility
 */
export default function StaffDashboard(props) {
  return <EmployeePortal {...props} />;
}
