/**
 * KSYN FitConnect - Real-Time Cross-Portal Synchronization
 * Synchronizes plan upgrades, subscriptions, and member events across
 * MemberPortal, BranchAdminDashboard, and EmployeePortal (Front Desk).
 */

export const PORTAL_SYNC_CHANNEL = 'ksyn_portal_sync';

/**
 * Broadcasts a member plan upgrade event to all open tabs/windows
 * (Branch Admin, Front Desk, Member Portal)
 */
export function broadcastMemberUpgrade(data) {
  if (typeof window === 'undefined') return;

  const payload = {
    type: 'MEMBER_PLAN_UPGRADED',
    memberId: data.memberId || data.id,
    memberName: data.memberName || data.name || 'Member',
    planId: data.planId || data.plan,
    planName: data.planName || data.name,
    tier: data.tier,
    branchId: data.branchId || data.branch_id,
    timestamp: Date.now()
  };

  // 1. Native BroadcastChannel (Multi-tab real-time pub/sub)
  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(PORTAL_SYNC_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    } catch (e) {
      console.warn('[BroadcastChannel Error]:', e);
    }
  }

  // 2. LocalStorage StorageEvent fallback (Triggers across tabs in all browsers)
  try {
    localStorage.setItem('ksyn_last_plan_upgrade', JSON.stringify(payload));
  } catch (e) {}

  // 3. Same-tab CustomEvent
  try {
    window.dispatchEvent(new CustomEvent('ksyn_local_plan_upgrade', { detail: payload }));
  } catch (e) {}
}

/**
 * Subscribes a dashboard (Branch Admin or Front Desk) to live member upgrades
 * @param {Function} onUpgrade - Callback receiving the upgrade event payload
 * @returns {Function} cleanup - Function to unsubscribe listeners on unmount
 */
export function subscribeToMemberUpgrades(onUpgrade) {
  if (typeof window === 'undefined' || typeof onUpgrade !== 'function') {
    return () => {};
  }

  let broadcastChannel = null;

  // 1. BroadcastChannel Listener
  if ('BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel(PORTAL_SYNC_CHANNEL);
      broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'MEMBER_PLAN_UPGRADED') {
          onUpgrade(event.data);
        }
      };
    } catch (e) {
      console.warn('[subscribeToMemberUpgrades error]:', e);
    }
  }

  // 2. Storage Event Listener (Cross-tab)
  const handleStorage = (event) => {
    if (event.key === 'ksyn_last_plan_upgrade' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed && parsed.type === 'MEMBER_PLAN_UPGRADED') {
          onUpgrade(parsed);
        }
      } catch (e) {}
    }
  };
  window.addEventListener('storage', handleStorage);

  // 3. Same-window CustomEvent Listener
  const handleCustomEvent = (event) => {
    if (event.detail && event.detail.type === 'MEMBER_PLAN_UPGRADED') {
      onUpgrade(event.detail);
    }
  };
  window.addEventListener('ksyn_local_plan_upgrade', handleCustomEvent);

  // Cleanup handler
  return () => {
    if (broadcastChannel) {
      try {
        broadcastChannel.close();
      } catch (e) {}
    }
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('ksyn_local_plan_upgrade', handleCustomEvent);
  };
}

/**
 * Broadcasts class booking events (booking confirmed or cancelled)
 * across all portals in real-time
 */
export function broadcastClassBooking(data) {
  if (typeof window === 'undefined') return;

  const payload = {
    type: data.type || 'CLASS_BOOKING_CHANGED',
    classId: data.classId,
    className: data.className,
    userId: data.userId || data.id,
    userName: data.userName || data.name,
    userEmail: data.userEmail || data.email,
    timestamp: Date.now()
  };

  // 1. Native BroadcastChannel
  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(PORTAL_SYNC_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    } catch (e) {
      console.warn('[BroadcastChannel ClassBooking Error]:', e);
    }
  }

  // 2. LocalStorage StorageEvent fallback
  try {
    localStorage.setItem('ksyn_last_class_sync', JSON.stringify(payload));
  } catch (e) {}

  // 3. Same-tab CustomEvent
  try {
    window.dispatchEvent(new CustomEvent('ksyn_local_class_sync', { detail: payload }));
  } catch (e) {}
}

/**
 * Subscribes a portal (e.g. CoachDashboard, EmployeePortal) to class booking events
 */
export function subscribeToClassBookings(onClassChange) {
  if (typeof window === 'undefined' || typeof onClassChange !== 'function') {
    return () => {};
  }

  let broadcastChannel = null;

  if ('BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel(PORTAL_SYNC_CHANNEL);
      broadcastChannel.onmessage = (event) => {
        if (event.data && (
          event.data.type === 'CLASS_BOOKING_CHANGED' ||
          event.data.type === 'CLASS_BOOKING_CANCELLED' ||
          event.data.type === 'CLASS_BOOKING_CONFIRMED'
        )) {
          onClassChange(event.data);
        }
      };
    } catch (e) {
      console.warn('[subscribeToClassBookings error]:', e);
    }
  }

  const handleStorage = (event) => {
    if (event.key === 'ksyn_last_class_sync' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed) onClassChange(parsed);
      } catch (e) {}
    }
  };
  window.addEventListener('storage', handleStorage);

  const handleCustomEvent = (event) => {
    if (event.detail) onClassChange(event.detail);
  };
  window.addEventListener('ksyn_local_class_sync', handleCustomEvent);

  return () => {
    if (broadcastChannel) {
      try {
        broadcastChannel.close();
      } catch (e) {}
    }
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('ksyn_local_class_sync', handleCustomEvent);
  };
}
