interface ModelBreakdownProps {
  logs: any[];
}

export default function ModelBreakdown({ logs }: ModelBreakdownProps) {
  // Aggregate counts of models
  const counts: { [key: string]: number } = {};
  logs.forEach((log) => {
    const model = log.model || 'Unknown';
    counts[model] = (counts[model] || 0) + 1;
  });

  let data = Object.keys(counts).map((model) => ({
    name: model,
    count: counts[model],
  }));

  // Sort descending
  data.sort((a, b) => b.count - a.count);

  // Fallback defaults if no logs
  if (data.length === 0) {
    data = [
      { name: 'gpt-4o', count: 120 },
      { name: 'claude-3-5-sonnet-20240620', count: 68 },
      { name: 'gemini-1.5-pro', count: 32 },
      { name: 'gpt-3.5-turbo', count: 15 },
    ];
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
        maxHeight: '220px',
        overflowY: 'auto',
        paddingRight: '0.25rem',
      }}
    >
      {data.map((item, idx) => {
        const pctOfMax = (item.count / maxCount) * 100;
        const pctOfTotal = ((item.count / totalCount) * 100).toFixed(0);

        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  maxWidth: '75%',
                }}
              >
                {item.name}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {item.count} ({pctOfTotal}%)
              </span>
            </div>

            {/* Progress bar container */}
            <div
              style={{
                height: '6px',
                width: '100%',
                backgroundColor: 'var(--glass-bg-dark)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pctOfMax}%`,
                  borderRadius: '3px',
                  background: 'linear-gradient(90deg, var(--primary-glow), var(--accent-glow))',
                  boxShadow: '0 0 8px var(--glass-glow)',
                  transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
