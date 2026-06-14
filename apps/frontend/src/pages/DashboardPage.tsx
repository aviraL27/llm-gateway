import { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertOctagon,
  Calendar,
} from 'lucide-react';
import { getOverview, getTimeseries, getLogs } from '../services/api';
import { useApi } from '../hooks/useApi';
import PageTransition from '../components/layout/PageTransition';
import StatCard from '../components/dashboard/StatCard';
import ChartContainer from '../components/dashboard/ChartContainer';
import SpendChart from '../components/dashboard/SpendChart';
import RequestVolumeChart from '../components/dashboard/RequestVolumeChart';
import ProviderDonut from '../components/dashboard/ProviderDonut';
import ModelBreakdown from '../components/dashboard/ModelBreakdown';

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');

  // Calculate dates based on time range
  const getFromDateStr = () => {
    const d = new Date();
    if (timeRange === '7d') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 30);
    return d.toISOString();
  };

  const getToDateStr = () => new Date().toISOString();

  const fromDate = getFromDateStr();
  const toDate = getToDateStr();

  // Fetch overview metrics
  const { data: overview, loading: loadingOverview } = useApi(getOverview);

  // Fetch timeseries spend data
  const { data: spendData, loading: loadingSpend } = useApi(
    () => getTimeseries('spend', fromDate, toDate, timeRange === '30d' ? 'day' : 'hour'),
    [timeRange]
  );

  // Fetch timeseries requests data
  const { data: requestsData, loading: loadingRequests } = useApi(
    () => getTimeseries('requests', fromDate, toDate, timeRange === '30d' ? 'day' : 'hour'),
    [timeRange]
  );

  // Fetch logs to extract provider breakdown and top models
  const { data: logsData, loading: loadingLogs } = useApi(
    () => getLogs(1, 100, { from: fromDate }),
    [timeRange]
  );

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Upper Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Operational Overview
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Real-time multi-tenant request routing, billing, and latency metrics.
            </p>
          </div>

          {/* Time range selector */}
          <div
            style={{
              display: 'flex',
              background: 'var(--glass-bg-dark)',
              border: '1px solid var(--glass-border-light)',
              borderRadius: '0.5rem',
              padding: '0.25rem',
            }}
          >
            {(['7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                style={{
                  padding: '0.375rem 0.875rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '0.375rem',
                  background: timeRange === r ? 'var(--glass-bg)' : 'transparent',
                  border: timeRange === r ? '1px solid var(--glass-border-light)' : '1px solid transparent',
                  color: timeRange === r ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: timeRange === r ? '0 2px 10px rgba(0, 0, 0, 0.1)' : 'none',
                }}
              >
                {r === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
          }}
        >
          <StatCard
            title="Spend Today"
            value={formatCurrency(overview?.spend_today)}
            subtitle={`Monthly Limit: ${formatCurrency(overview?.monthly_limit_usd)}`}
            icon={<DollarSign size={20} />}
            loading={loadingOverview}
            glowColor="168, 85, 247" // Purple glow
          />
          <StatCard
            title="Total Requests"
            value={overview?.total_requests?.toLocaleString() || '0'}
            subtitle={`${overview?.requests_today?.toLocaleString() || '0'} today`}
            icon={<TrendingUp size={20} />}
            loading={loadingOverview}
            glowColor="236, 72, 153" // Pink glow
          />
          <StatCard
            title="Average Latency"
            value={`${overview?.avg_latency || 0}ms`}
            subtitle="P50 response time"
            icon={<Clock size={20} />}
            loading={loadingOverview}
          />
          <StatCard
            title="Error Rate"
            value={`${overview?.error_rate || 0}%`}
            subtitle="Unsuccessful requests"
            icon={<AlertOctagon size={20} />}
            loading={loadingOverview}
            glowColor={overview && overview.error_rate > 5 ? '239, 68, 68' : undefined}
          />
        </div>

        {/* Timeseries Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', minWidth: 0 }}>
          <ChartContainer
            title="Spend Analytics (USD)"
            subtitle="Accumulated server cost over time"
            actions={<Calendar size={16} style={{ color: 'var(--text-muted)' }} />}
          >
            {loadingSpend ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading...</span>
              </div>
            ) : (
              <SpendChart data={spendData?.buckets || []} />
            )}
          </ChartContainer>

          <ChartContainer
            title="Request Volume"
            subtitle="Total API requests bucketed by interval"
            actions={<Calendar size={16} style={{ color: 'var(--text-muted)' }} />}
          >
            {loadingRequests ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading...</span>
              </div>
            ) : (
              <RequestVolumeChart data={requestsData?.buckets || []} />
            )}
          </ChartContainer>
        </div>

        {/* Breakdowns Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <ChartContainer title="Provider Distribution" subtitle="Share of requests processed by each provider">
            {loadingLogs ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading...</span>
              </div>
            ) : (
              <ProviderDonut logs={logsData?.rows || []} />
            )}
          </ChartContainer>

          <ChartContainer title="Model Breakdown" subtitle="Distribution of API requests across individual models">
            {loadingLogs ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading...</span>
              </div>
            ) : (
              <ModelBreakdown logs={logsData?.rows || []} />
            )}
          </ChartContainer>
        </div>
      </div>
    </PageTransition>
  );
}
