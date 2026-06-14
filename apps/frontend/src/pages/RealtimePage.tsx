import { useSocket } from '../hooks/useSocket';
import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/glass/GlassCard';
import GlassButton from '../components/glass/GlassButton';
import GlassBadge from '../components/glass/GlassBadge';
import { Activity, Trash2, ArrowUpRight, Zap } from 'lucide-react';

export default function RealtimePage() {
  const { events, isConnected, clearEvents } = useSocket();

  const formatCost = (costStr: string) => {
    const cost = parseFloat(costStr);
    if (isNaN(cost)) return '$0.00';
    if (cost === 0) return '$0.00';
    if (cost < 0.0001) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  const getRelativeTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return d.toLocaleTimeString();
  };

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Live Telemetry Feed
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Real-time feed of gateway traffic pushed directly via WebSockets.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <GlassButton variant="secondary" onClick={clearEvents} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trash2 size={14} />
              Clear Feed
            </GlassButton>
          </div>
        </div>

        {/* Status Alert Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: isConnected ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)',
            border: isConnected ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isConnected ? '#10b981' : '#f59e0b',
                boxShadow: isConnected ? '0 0 8px #10b981' : '0 0 8px #f59e0b',
                animation: isConnected ? 'pulse 2s infinite' : 'none',
              }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {isConnected
                ? 'Telemetry Node online. Listening for incoming proxy logs...'
                : 'Offline. Reconnecting to gateway server...'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Zap size={12} />
            <span>WebSockets active</span>
          </div>
        </div>

        {/* Feed List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {events.length === 0 ? (
            <div
              style={{
                padding: '4rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'var(--glass-bg)',
                borderRadius: '0.5rem',
                border: '1px solid var(--glass-border-light)',
              }}
            >
              <Activity size={32} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>No live logs yet</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>
                Make requests through the gateway proxy at <code>http://localhost:3000/v1/chat/completions</code> to stream log records here.
              </p>
            </div>
          ) : (
            events.map((log, idx) => (
              <GlassCard
                key={idx}
                variant="default"
                padding="0.875rem 1.25rem"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1.5rem',
                  borderLeft: log.status === 'error' ? '3px solid #ef4444' : '3px solid #10b981',
                  animation: 'slide-up 0.3s ease-out',
                }}
              >
                {/* Left: Provider, model, was fallback */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '0.375rem',
                      background: 'var(--glass-bg-dark)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--glass-border-light)',
                      flexShrink: 0,
                    }}
                  >
                    <ArrowUpRight size={16} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                        {log.provider}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          color: 'var(--text-secondary)',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.model_used || log.model}
                      </span>
                      {log.was_fallback && <GlassBadge variant="warning">Fallback</GlassBadge>}
                      {log.pii_detected && <GlassBadge variant="error">PII Redacted</GlassBadge>}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      <span>Tokens: {log.prompt_tokens + log.completion_tokens}</span>
                      <span>•</span>
                      <span>Latency: {log.latency_ms}ms</span>
                    </div>
                  </div>
                </div>

                {/* Right: Cost, status, time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {formatCost(log.cost_usd)}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {getRelativeTime(log.time)}
                    </span>
                  </div>

                  <GlassBadge variant={log.status === 'error' ? 'error' : 'success'}>
                    {log.status}
                  </GlassBadge>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}
