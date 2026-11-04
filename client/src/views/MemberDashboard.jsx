import React from 'react';
import MemberPortal from './MemberPortal';

/**
 * MemberDashboard Component
 * Re-exports MemberPortal for role dashboard compatibility
 */
export default function MemberDashboard(props) {
  return <MemberPortal {...props} />;
}
