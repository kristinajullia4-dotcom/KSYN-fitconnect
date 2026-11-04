import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible, Responsive Tooltip Component for KSYN FitConnect
 * Supports hover/focus, smooth transitions, screen boundary detection,
 * and ARIA attributes for screen readers.
 */
export default function Tooltip({
  content,
  text,
  title,
  children,
  position = 'top',
  delay = 120,
  disabled = false,
  className = '',
  style = {},
  fullWidth = false
}) {
  const tooltipText = content || text || title;
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, actualPosition: position, isCalculated: false });
  const timeoutRef = useRef(null);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipId = useId();

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 8;

    let targetTop = 0;
    let targetLeft = 0;
    let chosenPos = position;

    // Evaluate desired position vs boundaries
    if (position === 'top' && triggerRect.top - tooltipRect.height - gap < 0) {
      chosenPos = 'bottom';
    } else if (position === 'bottom' && triggerRect.bottom + tooltipRect.height + gap > viewportHeight) {
      chosenPos = 'top';
    } else if (position === 'left' && triggerRect.left - tooltipRect.width - gap < 0) {
      chosenPos = 'right';
    } else if (position === 'right' && triggerRect.right + tooltipRect.width + gap > viewportWidth) {
      chosenPos = 'left';
    }

    if (chosenPos === 'top') {
      targetTop = triggerRect.top - tooltipRect.height - gap;
      targetLeft = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
    } else if (chosenPos === 'bottom') {
      targetTop = triggerRect.bottom + gap;
      targetLeft = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
    } else if (chosenPos === 'left') {
      targetTop = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
      targetLeft = triggerRect.left - tooltipRect.width - gap;
    } else { // right
      targetTop = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
      targetLeft = triggerRect.right + gap;
    }

    // Keep within horizontal bounds (with 12px margin)
    if (targetLeft < 12) targetLeft = 12;
    if (targetLeft + tooltipRect.width > viewportWidth - 12) {
      targetLeft = Math.max(12, viewportWidth - tooltipRect.width - 12);
    }

    // Keep within vertical bounds
    if (targetTop < 12) targetTop = 12;
    if (targetTop + tooltipRect.height > viewportHeight - 12) {
      targetTop = Math.max(12, viewportHeight - tooltipRect.height - 12);
    }

    setCoords({
      top: targetTop,
      left: targetLeft,
      actualPosition: chosenPos,
      isCalculated: true
    });
  };

  const showTooltip = () => {
    if (disabled || !tooltipText) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
    setCoords(prev => ({ ...prev, isCalculated: false }));
  };

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
      const handleResizeOrScroll = () => calculatePosition();
      window.addEventListener('resize', handleResizeOrScroll, { passive: true });
      window.addEventListener('scroll', handleResizeOrScroll, { passive: true });
      return () => {
        window.removeEventListener('resize', handleResizeOrScroll);
        window.removeEventListener('scroll', handleResizeOrScroll);
      };
    }
  }, [isVisible]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isVisible) {
        hideTooltip();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timeoutRef.current);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible]);

  if (!tooltipText) return children;

  const isBlock = fullWidth || className?.includes('w-full') || className?.includes('block') || style?.width === '100%';

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-describedby={isVisible ? tooltipId : undefined}
        className={`${isBlock ? 'block w-full' : 'inline-flex items-center justify-center'} ${className}`}
        style={{
          display: isBlock ? 'block' : 'inline-flex',
          width: isBlock ? '100%' : undefined,
          ...style
        }}
      >
        {children}
      </span>

      {isVisible && typeof document !== 'undefined' && document?.body && createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          aria-hidden={!isVisible}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 999999,
            backgroundColor: '#16191f',
            color: '#f3f4f6',
            border: '1px solid rgba(225, 194, 86, 0.35)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 600,
            lineHeight: 1.4,
            letterSpacing: '0.015em',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.06)',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            width: 'max-content',
            maxWidth: '340px',
            pointerEvents: 'none',
            textAlign: 'center',
            opacity: coords.isCalculated ? 1 : 0,
            transform: 'translateZ(0)',
            transition: 'opacity 0.15s ease-out'
          }}
        >
          {tooltipText}
        </div>,
        document.body
      )}
    </>
  );
}
