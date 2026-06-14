import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface ProviderDonutProps {
  logs: any[];
}

const PROVIDER_COLORS: { [key: string]: string } = {
  openai: '#10b981',
  anthropic: '#f59e0b',
  google: '#3b82f6',
  gemini: '#3b82f6',
  cohere: '#ec4899',
  local: '#8b5cf6',
  mock: '#6b7280',
};

export default function ProviderDonut({ logs }: ProviderDonutProps) {
  // Aggregate provider counts from logs
  const counts: { [key: string]: number } = {};
  logs.forEach((log) => {
    const provider = (log.provider || 'unknown').toLowerCase();
    counts[provider] = (counts[provider] || 0) + 1;
  });

  let data = Object.keys(counts).map((provider) => ({
    name: provider.toUpperCase(),
    value: counts[provider],
    color: PROVIDER_COLORS[provider] || '#64748b',
  }));

  // Fallback default data if no logs yet
  if (data.length === 0) {
    data = [
      { name: 'OPENAI', value: 65, color: PROVIDER_COLORS.openai },
      { name: 'ANTHROPIC', value: 25, color: PROVIDER_COLORS.anthropic },
      { name: 'GEMINI', value: 10, color: PROVIDER_COLORS.gemini },
    ];
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percentage = ((payload[0].value / total) * 100).toFixed(1);
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
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: payload[0].payload.color }}>
            {payload[0].name}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
            {payload[0].value} ({percentage}%)
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', width: '100%' }}>
      <div style={{ width: '55%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend */}
      <div
        style={{
          width: '45%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '0.5rem',
          paddingLeft: '0.5rem',
        }}
      >
        {data.map((item, index) => {
          const pct = ((item.value / total) * 100).toFixed(0);
          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: item.color,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  fontSize: '0.75rem',
                }}
              >
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {item.name}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
