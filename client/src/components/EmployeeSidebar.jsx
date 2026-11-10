import React, { useState, useRef } from 'react';
import {
  QrCode,
  Users,
  ShieldCheck,
  CreditCard,
  Flame,
  Dumbbell,
  User,
  Shield,
  ChevronRight
} from 'lucide-react';

const DEFAULT_EMPLOYEE_NAV_ITEMS = [
  { id: 'turnstile', label: 'Turnstile Gate / QR Scanner', icon: <QrCode size={18} /> },
  { id: 'members', label: 'Member Look-Up & Roster', icon: <Users size={18} /> },
  { id: 'lockers', label: 'Locker Key Manager', icon: <ShieldCheck size={18} /> },
  { id: 'pos', label: 'Front-Desk POS / Cashier', icon: <CreditCard size={18} /> },
  { id: 'schedule', label: 'Class Schedules', icon: <Flame size={18} /> },
  { id: 'pt_enrollments', label: 'PT Enrollments Queue', icon: <Dumbbell size={18} /> },
  { id: 'profile', label: 'Staff Profile & Rota', icon: <User size={18} /> }
];

export default function EmployeeSidebar({
  currentTab,
  onSelectTab,
  navItems = DEFAULT_EMPLOYEE_NAV_ITEMS,
  isItemActive,
  roleName = 'Role Workspace',
  hasAnnouncement = false
}) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  const renderIcon = (icon, active) => {
    if (!icon) return <Dumbbell size={18} color={active ? '#0a0c0b' : '#9ca3af'} />;
    if (React.isValidElement(icon)) {
      return React.cloneElement(icon, {
        size: 18,
        color: active ? '#0a0c0b' : '#9ca3af'
      });
    }
    const IconComp = icon;
    return <IconComp size={18} color={active ? '#0a0c0b' : '#9ca3af'} />;
  };

  const checkActive = (item) => {
    if (typeof isItemActive === 'function') {
      return isItemActive(item.id);
    }
    return currentTab === item.id;
  };

  const fixedTop = hasAnnouncement ? '118px' : '76px';
  const railHeight = hasAnnouncement ? 'calc(100vh - 134px)' : 'calc(100vh - 92px)';

  return (
    <div
      style={{
        width: '64px',
        minWidth: '64px',
        flexShrink: 0,
        zIndex: 50
      }}
    >
      {/* Invisible 64px layout spacer to reserve space in flex layout */}
      <div style={{ width: '64px', height: '100%', minHeight: railHeight, pointerEvents: 'none' }} />

      {/* Floating Animated Navigation Rail - Fixed to viewport so it is ALWAYS on the screen */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'fixed',
          top: fixedTop,
          left: '12px',
          height: railHeight,
          width: isHovered ? '256px' : '64px',
          minWidth: isHovered ? '256px' : '64px',
          backgroundColor: '#0a0c0b',
          border: '1px solid #1c201d',
          borderRadius: '12px',
          boxShadow: isHovered
            ? '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 25px rgba(225, 194, 86, 0.12)'
            : '0 4px 12px rgba(0, 0, 0, 0.4)',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, top 0.2s ease, height 0.2s ease',
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden'
        }}
        aria-label="Workspace Navigation Rail"
      >
        {/* Top Brand / Section Header - Strictly NO EMOJI */}
        <div>
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid #1c201d',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '64px',
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                minWidth: '32px',
                minHeight: '32px',
                borderRadius: '8px',
                background: 'rgba(225, 194, 86, 0.1)',
                border: '1px solid rgba(225, 194, 86, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#e1c256'
              }}
            >
              <Dumbbell size={18} color="#e1c256" />
            </div>
            <div
              style={{
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? 'translateX(0)' : 'translateX(-8px)',
                pointerEvents: isHovered ? 'auto' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#9ca3af'
                }}
              >
                {roleName || 'Role Workspace'}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)'
                }}
              >
                LIVE
              </span>
            </div>
          </div>

          {/* Navigation Items List */}
          <nav
            className="nav-rail-scroll"
            style={{
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              maxHeight: 'calc(100vh - 200px)'
            }}
          >
            {navItems.map((item) => {
              const isActive = checkActive(item);
              return (
                <div key={item.id} className="group relative" style={{ position: 'relative', width: '100%' }}>
                  <button
                    id={`nav-rail-${item.id}`}
                    type="button"
                    onClick={() => onSelectTab && onSelectTab(item.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      backgroundColor: isActive ? '#e1c256' : 'transparent',
                      color: isActive ? '#0a0c0b' : '#9ca3af',
                      boxShadow: isActive ? '0 2px 8px rgba(225, 194, 86, 0.35)' : 'none',
                      transition: 'background-color 0.15s ease, color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = '#131614';
                        e.currentTarget.style.color = '#ffffff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#9ca3af';
                      }
                    }}
                  >
                    {/* Centered Icon Slot (Always 20px centered) */}
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        minWidth: '20px',
                        minHeight: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {renderIcon(item.icon, isActive)}
                    </div>

                    {/* Text Label: Fades & slides smoothly on hover */}
                    <span
                      style={{
                        marginLeft: '12px',
                        fontSize: '0.8125rem',
                        fontWeight: isActive ? 800 : 500,
                        opacity: isHovered ? 1 : 0,
                        transform: isHovered ? 'translateX(0)' : 'translateX(-8px)',
                        pointerEvents: isHovered ? 'auto' : 'none',
                        transition: 'opacity 0.2s ease, transform 0.2s ease',
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {item.label}
                    </span>

                    {/* Optional Counter Badge (When expanded) */}
                    {item.badge !== undefined && item.badge > 0 && isHovered && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          backgroundColor: isActive ? '#0a0c0b' : '#ef4444',
                          color: isActive ? '#e1c256' : '#ffffff',
                          padding: '1px 6px',
                          borderRadius: '999px',
                          marginLeft: 'auto',
                          flexShrink: 0
                        }}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Active Chevron Indicator when expanded */}
                    {isActive && isHovered && (
                      <ChevronRight size={14} color="#0a0c0b" style={{ flexShrink: 0, marginLeft: '6px' }} />
                    )}
                  </button>

                  {/* Floating Tooltip only when collapsed and cursor hovers individual icon */}
                  {!isHovered && (
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                      style={{
                        position: 'absolute',
                        left: '100%',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        marginLeft: '12px',
                        padding: '6px 12px',
                        backgroundColor: '#12151e',
                        border: '1px solid #2d3748',
                        color: '#f8fafc',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        whiteSpace: 'nowrap',
                        zIndex: 100,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.6)'
                      }}
                    >
                      {item.label}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </div>
  );
}
