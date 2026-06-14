import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { getLogs } from '../services/api';
import PageTransition from '../components/layout/PageTransition';
import GlassTable from '../components/glass/GlassTable';
import GlassBadge from '../components/glass/GlassBadge';
import GlassModal from '../components/glass/GlassModal';
import GlassButton from '../components/glass/GlassButton';
import GlassInput from '../components/glass/GlassInput';
import GlassCard from '../components/glass/GlassCard';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import type { RequestLog } from '../types';

export default function RequestLogsPage() {
  const [page, setPage] = useState(1);
  const [providerFilter, setProviderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);

  // Fetch logs with filters
  const {
    data: logsData,
    loading,
    refetch,
  } = useApi(
    () =>
      getLogs(page, 20, {
        provider: providerFilter || undefined,
        status: statusFilter || undefined,
        model: modelFilter || undefined,
      }),
    [page, providerFilter, statusFilter, modelFilter]
  );

  const formatCost = (costStr: string) => {
    const cost = parseFloat(costStr);
    if (isNaN(cost)) return '$0.00';
    if (cost === 0) return '$0.00';
    if (cost < 0.0001) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  const columns = [
    {
      header: 'Time',
      accessor: (row: RequestLog) => {
        const d = new Date(row.time);
        return (
          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
            {d.toLocaleDateString()} {d.toLocaleTimeString()}
          </span>
        );
      },
    },
    {
      header: 'Provider',
      accessor: (row: RequestLog) => (
        <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>
          {row.provider}
        </span>
      ),
    },
    {
      header: 'Model',
      accessor: (row: RequestLog) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {row.model_used || row.model}
        </span>
      ),
    },
    {
      header: 'Latency',
      accessor: (row: RequestLog) => (
        <span style={{ fontSize: '0.8125rem' }}>
          {row.latency_ms}ms
        </span>
      ),
    },
    {
      header: 'Cost',
      accessor: (row: RequestLog) => (
        <span style={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>
          {formatCost(row.cost_usd)}
        </span>
      ),
    },
    {
      header: 'Fallback',
      accessor: (row: RequestLog) =>
        row.was_fallback ? (
          <GlassBadge variant="warning">Fallback</GlassBadge>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Direct</span>
        ),
    },
    {
      header: 'Status',
      accessor: (row: RequestLog) => (
        <GlassBadge variant={row.status === 'error' ? 'error' : 'success'}>
          {row.status}
        </GlassBadge>
      ),
    },
    {
      header: 'PII Check',
      accessor: (row: RequestLog) =>
        row.pii_detected ? (
          <GlassBadge variant="error" dot>
            PII Redacted
          </GlassBadge>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Clean</span>
        ),
    },
    {
      header: 'Actions',
      accessor: (row: RequestLog) => (
        <GlassButton variant="ghost" onClick={() => setSelectedLog(row)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
          View Details
        </GlassButton>
      ),
    },
  ];

  const totalPages = logsData ? Math.ceil(logsData.total / logsData.limit) : 1;

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Request Logs
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Inspect incoming proxy traffic, provider routing, fallback status, and PII filters.
            </p>
          </div>
          <GlassButton variant="secondary" onClick={() => refetch()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={14} />
            Refresh
          </GlassButton>
        </div>

        {/* Filters Card */}
        <GlassCard variant="inset" padding="1rem">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              alignItems: 'end',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Provider
              </label>
              <select
                value={providerFilter}
                onChange={(e) => {
                  setProviderFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  background: 'var(--glass-bg-dark)',
                  border: '1px solid var(--glass-border-light)',
                  borderRadius: '0.375rem',
                  padding: '0.5rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              >
                <option value="">All Providers</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Gemini</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  background: 'var(--glass-bg-dark)',
                  border: '1px solid var(--glass-border-light)',
                  borderRadius: '0.375rem',
                  padding: '0.5rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
              </select>
            </div>

            <GlassInput
              label="Model Search"
              placeholder="e.g. gpt-4o"
              value={modelFilter}
              onChange={(e) => {
                setModelFilter(e.target.value);
                setPage(1);
              }}
              containerStyle={{ margin: 0 }}
            />
          </div>
        </GlassCard>

        {/* Logs Table */}
        <GlassTable
          columns={columns}
          data={logsData?.rows || []}
          loading={loading}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyMessage="No request logs found matching criteria."
        />

        {/* Detail Modal */}
        <GlassModal
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="Log Record Inspector"
          width="650px"
        >
          {selectedLog && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Stat Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: 'var(--glass-bg-dark)', borderRadius: '0.375rem', textAlign: 'center', border: '1px solid var(--glass-border-light)' }}>
                  <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>LATENCY</span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedLog.latency_ms}ms</span>
                </div>
                <div style={{ padding: '0.5rem', background: 'var(--glass-bg-dark)', borderRadius: '0.375rem', textAlign: 'center', border: '1px solid var(--glass-border-light)' }}>
                  <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>TOKENS</span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedLog.prompt_tokens + selectedLog.completion_tokens} (P: {selectedLog.prompt_tokens} / C: {selectedLog.completion_tokens})
                  </span>
                </div>
                <div style={{ padding: '0.5rem', background: 'var(--glass-bg-dark)', borderRadius: '0.375rem', textAlign: 'center', border: '1px solid var(--glass-border-light)' }}>
                  <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>USD COST</span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCost(selectedLog.cost_usd)}</span>
                </div>
              </div>

              {/* Redaction Alerts */}
              {selectedLog.pii_detected && (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  <ShieldAlert style={{ color: '#ef4444' }} size={20} />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#ef4444' }}>
                      PII Scrubbing Triggered
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Sensitive data was detected and redacted prior to forwarding to LLM provider.
                    </span>
                  </div>
                </div>
              )}

              {/* JSON Payload Inspection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Full Payload Registry
                </span>
                <pre
                  style={{
                    background: 'var(--glass-bg-dark)',
                    border: '1px solid var(--glass-border-light)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <GlassButton variant="secondary" onClick={() => setSelectedLog(null)}>
                  Close
                </GlassButton>
              </div>
            </div>
          )}
        </GlassModal>
      </div>
    </PageTransition>
  );
}
