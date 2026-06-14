import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TimeseriesBucket } from '../../types';

interface SpendChartProps {
  data: TimeseriesBucket[];
}

export default function SpendChart({ data }: SpendChartProps) {
  // Format dates nicely
  const formattedData = data.map((b) => {
    const d = new Date(b.time);
    return {
      ...b,
      formattedTime: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--glass-border-light)',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}
          >
            {payload[0].payload.formattedTime}
          </p>
          <p
            style={{
              margin: '0.125rem 0 0 0',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            ${payload[0].value.toFixed(4)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary-glow)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--primary-glow)" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--glass-border-light)"
          vertical={false}
        />
        <XAxis
          dataKey="formattedTime"
          stroke="var(--text-muted)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          stroke="var(--text-muted)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(val) => `$${val}`}
          dx={-5}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--glass-border)' }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--primary-glow)"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#spendGlow)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
