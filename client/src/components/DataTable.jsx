import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * Reusable KSYN Dark Industrial DataTable Component
 * Props:
 * - columns: Array of column definitions ({ header/name/title/key, accessor/field, render, width, align })
 * - data: Array of data records
 * - title: Optional table title string
 * - emptyMessage: Fallback message when data is empty (default: 'No records found.')
 * - children: Optional child elements
 */
export default function DataTable({
  columns = [],
  data = [],
  title = '',
  emptyMessage = 'No records found.',
  className = '',
  children
}) {
  if (children) {
    return (
      <div 
        style={{ 
          width: '100%', 
          overflowX: 'auto', 
          WebkitOverflowScrolling: 'touch',
          background: '#141414', 
          border: '1px solid #262626', 
          borderRadius: '8px', 
          padding: '16px', 
          margin: '16px 0' 
        }} 
        className={`table-scroll-touch ${className}`}
      >
        {title && <h3 style={{ color: '#e1c256', fontSize: '14px', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 700 }}>{title}</h3>}
        {children}
      </div>
    );
  }

  return (
    <div 
      style={{ 
        width: '100%', 
        overflowX: 'auto', 
        WebkitOverflowScrolling: 'touch',
        background: '#0a0c0b', 
        border: '1px solid #1c201d', 
        borderRadius: '8px', 
        padding: '16px', 
        margin: '16px 0' 
      }} 
      className={`table-scroll-touch ${className}`}
    >
      {title && (
        <h3 style={{ color: '#e1c256', fontSize: '14px', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 700 }}>
          {title}
        </h3>
      )}
      <table style={{ width: '100%', minWidth: '480px', textAlign: 'left', borderCollapse: 'collapse', color: '#e5e7eb', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #262626', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', background: '#0f0f0f' }}>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  padding: '12px 14px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  width: col.width || 'auto',
                  textAlign: col.align || 'left'
                }}
              >
                {col.header || col.name || col.title || col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, rIdx) => (
              <tr
                key={row.id || rIdx}
                style={{
                  borderBottom: rIdx === data.length - 1 ? 'none' : '1px solid #1f1f1f',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(225, 194, 86, 0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {columns.map((col, cIdx) => {
                  let val;
                  if (typeof col.accessor === 'function') {
                    val = col.accessor(row);
                  } else if (col.render) {
                    val = col.render(row[col.key || col.accessor || col.field], row, rIdx);
                  } else {
                    val = row[col.accessor || col.field || col.key || col];
                  }
                  return (
                    <td
                      key={col.key || cIdx}
                      style={{
                        padding: '12px 14px',
                        textAlign: col.align || 'left',
                        verticalAlign: 'middle'
                      }}
                    >
                      {val ?? '-'}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length || 1}
                style={{ padding: '32px 14px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <Inbox size={24} color="#6b7280" />
                  <span>{emptyMessage}</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
