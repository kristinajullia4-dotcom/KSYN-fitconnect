import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

// Optional external emitter for non-React contexts or fast global triggers
let globalToastEmitter = null;
export const triggerToast = (type, message, title) => {
  if (globalToastEmitter) {
    globalToastEmitter(type, message, title);
  }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, title = '') => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const newToast = {
      id,
      type: type || 'info',
      message: typeof message === 'string' ? message : JSON.stringify(message),
      title: title || '',
      createdAt: Date.now()
    };

    setToasts((prev) => [...prev.slice(-4), newToast]); // keep up to 5 concurrent toasts

    // Auto-dismiss after 2.2s (2200ms) to prevent lingering occlusion
    setTimeout(() => {
      removeToast(id);
    }, 2200);

    return id;
  }, [removeToast]);

  useEffect(() => {
    globalToastEmitter = (type, message, title) => addToast(type, message, title);
    return () => {
      globalToastEmitter = null;
    };
  }, [addToast]);

  const toast = {
    success: (message, title = 'Action Succeeded') => addToast('success', message, title),
    error: (message, title = 'Action Failed') => addToast('error', message, title),
    warning: (message, title = 'Notice') => addToast('warning', message, title),
    info: (message, title = 'System Update') => addToast('info', message, title)
  };

  const getToastIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} style={{ color: '#7fa36d' }} />;
      case 'error':
        return <AlertCircle size={18} style={{ color: '#ef4444' }} />;
      case 'warning':
        return <AlertTriangle size={18} style={{ color: '#e1c256' }} />;
      case 'info':
      default:
        return <Info size={18} style={{ color: '#e1c256' }} />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'success':
        return '#658256';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#e1c256';
      case 'info':
      default:
        return '#e1c256';
    }
  };

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}

      {/* Floating Upper-Right Toast Stack (repositioned away from bottom data tables) */}
      <div
        style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '400px',
          width: 'calc(100% - 48px)',
          pointerEvents: 'none'
        }}
        aria-live="polite"
      >
        {toasts.map((t) => {
          const accentColor = getTypeColor(t.type);
          return (
            <div
              key={t.id}
              className="toast-item pointer-events-auto"
              style={{
                background: '#0c0e0d',
                border: '1px solid #1d211e',
                borderLeft: `4px solid ${accentColor}`,
                borderRadius: '12px',
                boxShadow: '0 16px 36px -6px rgba(0, 0, 0, 0.7), 0 4px 12px rgba(0, 0, 0, 0.4)',
                padding: '16px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                pointerEvents: 'auto'
              }}
            >
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                {getToastIcon(t.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
                {t.title && (
                  <div
                    style={{
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.8125rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {t.title}
                  </div>
                )}
                <div
                  style={{
                    color: '#d1d5db',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    wordBreak: 'break-word'
                  }}
                >
                  {t.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                title="Close notification"
              >
                <X size={16} />
              </button>
              {/* Progress Bar (3px high colored bar matching the type on the bottom edge) */}
              <div
                className="toast-progress-bar"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '3px',
                  background: accentColor
                }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Return graceful no-op if used outside provider during transition
    return {
      toast: {
        success: (msg, title) => console.log('[Toast success]:', title, msg),
        error: (msg, title) => console.error('[Toast error]:', title, msg),
        warning: (msg, title) => console.warn('[Toast warning]:', title, msg),
        info: (msg, title) => console.info('[Toast info]:', title, msg)
      },
      addToast: () => {},
      removeToast: () => {}
    };
  }
  return context;
}

export default ToastContext;
