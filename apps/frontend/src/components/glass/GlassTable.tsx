import { ReactNode } from 'react';
import GlassCard from './GlassCard';
import GlassButton from './GlassButton';

interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface GlassTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export default function GlassTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records found.',
  currentPage,
  totalPages,
  onPageChange,
}: GlassTableProps<T>) {
  return (
    <GlassCard variant="inset" padding="0" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.8125rem', // 13px
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--glass-border)',
                background: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    padding: '12px 16px',
                    fontWeight: 600,
                    fontSize: '0.6875rem', // 11px
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-secondary)',
                    textAlign: col.align || 'left',
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '48px', textAlign: 'center' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      width: '24px',
                      height: '24px',
                      border: '2px solid rgba(255,255,255,0.05)',
                      borderTopColor: 'var(--primary-glow)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <div style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    Fetching records...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '48px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{
                    borderBottom: '1px solid var(--glass-border)',
                    transition: 'background-color 0.2s ease',
                  }}
                  className="table-row-hover"
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      style={{
                        padding: '12px 16px',
                        color: 'var(--text-primary)',
                        textAlign: col.align || 'left',
                      }}
                    >
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages && totalPages > 1 && currentPage && onPageChange && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            borderTop: '1px solid var(--glass-border)',
            background: 'rgba(0, 0, 0, 0.15)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Page {currentPage} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <GlassButton
              size="sm"
              variant="secondary"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{ padding: '4px 10px' }}
            >
              Previous
            </GlassButton>
            <GlassButton
              size="sm"
              variant="secondary"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{ padding: '4px 10px' }}
            >
              Next
            </GlassButton>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
