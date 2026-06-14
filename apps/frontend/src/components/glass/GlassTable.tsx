import { ReactNode } from 'react';
import GlassCard from './GlassCard';

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
            fontSize: '0.875rem',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--glass-border-light)',
                background: 'var(--glass-bg-dark)',
              }}
            >
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 600,
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
                <td colSpan={columns.length} style={{ padding: '3rem', textAlign: 'center' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      width: '1.5rem',
                      height: '1.5rem',
                      border: '2px solid var(--glass-border)',
                      borderTopColor: 'var(--primary-glow)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                    Loading data...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
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
                    borderBottom: '1px solid var(--glass-border-light)',
                    transition: 'background-color 0.2s',
                  }}
                  className="hover-row"
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      style={{
                        padding: '0.75rem 1rem',
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
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--glass-border-light)',
            background: 'var(--glass-bg-dark)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                transition: 'all 0.2s',
              }}
            >
              Prev
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                transition: 'all 0.2s',
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
