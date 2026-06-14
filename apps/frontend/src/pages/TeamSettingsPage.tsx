import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { getTeamSettings, updateBudget, updateFallbackConfig, updatePiiSettings } from '../services/api';
import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/glass/GlassCard';
import GlassButton from '../components/glass/GlassButton';
import GlassInput from '../components/glass/GlassInput';
import GlassAlert from '../components/glass/GlassAlert';
import { Shield, Coins, Shuffle } from 'lucide-react';

export default function TeamSettingsPage() {
  const { data: settings, loading, refetch } = useApi(getTeamSettings);

  const [budgetLimit, setBudgetLimit] = useState<number>(100);
  const [piiRedaction, setPiiRedaction] = useState(false);
  const [fallbackConfig, setFallbackConfig] = useState<{ [key: string]: string[] }>({});

  const [savingBudget, setSavingBudget] = useState(false);
  const [savingPii, setSavingPii] = useState(false);
  const [savingFallback, setSavingFallback] = useState(false);

  const [newPrimary, setNewPrimary] = useState('');
  const [fallbackInputs, setFallbackInputs] = useState<{ [key: string]: string }>({});

  // Sync state with fetched settings
  useEffect(() => {
    if (settings) {
      setBudgetLimit(settings.monthly_limit_usd || 100);
      setPiiRedaction(settings.pii_redaction_enabled || false);
      try {
        const parsed = typeof settings.fallback_config === 'string'
          ? JSON.parse(settings.fallback_config)
          : settings.fallback_config || {};
        setFallbackConfig(parsed);
      } catch (err) {
        setFallbackConfig({});
      }
    }
  }, [settings]);

  const handleUpdateBudget = async () => {
    setSavingBudget(true);
    try {
      await updateBudget(Number(budgetLimit));
      refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingBudget(false);
    }
  };

  const handleUpdatePii = async (checked: boolean) => {
    setPiiRedaction(checked);
    setSavingPii(true);
    try {
      await updatePiiSettings(checked);
      refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPii(false);
    }
  };

  const handleSaveFallback = async (newConfig: { [key: string]: string[] }) => {
    setSavingFallback(true);
    try {
      await updateFallbackConfig(newConfig);
      refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingFallback(false);
    }
  };

  const handleAddFallbackModel = (primary: string) => {
    const fallbackInput = fallbackInputs[primary]?.trim();
    if (!fallbackInput) return;

    const currentList = fallbackConfig[primary] || [];
    if (currentList.includes(fallbackInput)) return;

    const updated = {
      ...fallbackConfig,
      [primary]: [...currentList, fallbackInput],
    };

    setFallbackConfig(updated);
    handleSaveFallback(updated);

    // Reset input for that primary
    setFallbackInputs({
      ...fallbackInputs,
      [primary]: '',
    });
  };

  const handleRemoveFallbackModel = (primary: string, idx: number) => {
    const list = [...(fallbackConfig[primary] || [])];
    list.splice(idx, 1);

    const updated = {
      ...fallbackConfig,
    };

    if (list.length === 0) {
      delete updated[primary];
    } else {
      updated[primary] = list;
    }

    setFallbackConfig(updated);
    handleSaveFallback(updated);
  };

  const handleAddPrimary = () => {
    const primary = newPrimary.trim();
    if (!primary || fallbackConfig[primary]) return;

    const updated = {
      ...fallbackConfig,
      [primary]: [],
    };
    setFallbackConfig(updated);
    setNewPrimary('');
  };

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Header */}
        <div>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Gateway Settings
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Configure team budgets, fallback routing models, and PII protection preferences.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading settings...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Row: Budget and PII */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              {/* Budget Control */}
              <GlassCard variant="default" padding="1.5rem">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: 'var(--primary-glow)' }}>
                    <Coins size={18} />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Spend Limit Policy
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Set your team's total monthly dollar quota.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
                  <GlassInput
                    label="Monthly Cap (USD)"
                    type="number"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(Number(e.target.value))}
                    containerStyle={{ flex: 1, margin: 0 }}
                  />
                  <GlassButton variant="primary" onClick={handleUpdateBudget} loading={savingBudget} style={{ height: '40px' }}>
                    Save Policy
                  </GlassButton>
                </div>
              </GlassCard>

              {/* PII Redactor Toggle */}
              <GlassCard variant="default" padding="1.5rem" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: 'var(--success-glow)' }}>
                      <Shield size={18} />
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        PII Redactor
                      </span>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Scrub names, emails, card numbers, and credentials.
                      </span>
                    </div>
                  </div>

                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '1rem' }}>
                    When enabled, proxy inputs will be dynamically scanned, and identified sensitive tokens will be replaced with semantic labels like [EMAIL_1] before hitting LLM providers.
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Enable scrubbing engine
                  </span>
                  <input
                    type="checkbox"
                    checked={piiRedaction}
                    onChange={(e) => handleUpdatePii(e.target.checked)}
                    disabled={savingPii}
                    style={{
                      width: '42px',
                      height: '22px',
                      borderRadius: '11px',
                      appearance: 'none',
                      backgroundColor: piiRedaction ? 'var(--success-glow)' : 'var(--glass-border)',
                      position: 'relative',
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    className="toggle-checkbox"
                  />
                </div>
              </GlassCard>
            </div>

            {/* Model Fallback Config */}
            <GlassCard variant="default" padding="1.5rem">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: 'var(--accent-glow)' }}>
                  <Shuffle size={18} />
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Model Fallback Configurations
                  </span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Reroute failed provider API calls to secondary models in priority order.
                  </span>
                </div>
              </div>

              {savingFallback && (
                <GlassAlert variant="info" style={{ marginBottom: '1rem' }}>
                  Saving fallback modifications...
                </GlassAlert>
              )}

              {/* Add primary row */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'end', marginBottom: '1.5rem' }}>
                <GlassInput
                  label="Target Primary Model Name"
                  placeholder="e.g. gpt-4o"
                  value={newPrimary}
                  onChange={(e) => setNewPrimary(e.target.value)}
                  containerStyle={{ flex: 1, margin: 0 }}
                />
                <GlassButton variant="secondary" onClick={handleAddPrimary} style={{ height: '40px' }}>
                  Register Model
                </GlassButton>
              </div>

              {/* Config list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {Object.keys(fallbackConfig).length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    No fallback routing rules configured yet.
                  </div>
                ) : (
                  Object.keys(fallbackConfig).map((primary) => (
                    <div
                      key={primary}
                      style={{
                        padding: '1rem',
                        background: 'var(--glass-bg-dark)',
                        border: '1px solid var(--glass-border-light)',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {primary}
                        </span>
                        <GlassButton
                          variant="danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            const updated = { ...fallbackConfig };
                            delete updated[primary];
                            setFallbackConfig(updated);
                            handleSaveFallback(updated);
                          }}
                        >
                          Delete Rule
                        </GlassButton>
                      </div>

                      {/* Fallback chain */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fallbacks:</span>
                        {fallbackConfig[primary].map((fb, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.125rem 0.5rem',
                              background: 'var(--glass-bg)',
                              border: '1px solid var(--glass-border-light)',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                            }}
                          >
                            <span>{fb}</span>
                            <button
                              onClick={() => handleRemoveFallbackModel(primary, idx)}
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '0.125rem' }}
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add fallback model to primary chain */}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', marginTop: '0.25rem' }}>
                        <input
                          placeholder="e.g. claude-3-5-sonnet"
                          value={fallbackInputs[primary] || ''}
                          onChange={(e) => setFallbackInputs({ ...fallbackInputs, [primary]: e.target.value })}
                          style={{
                            flex: 1,
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border-light)',
                            borderRadius: '0.375rem',
                            padding: '0.375rem 0.75rem',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => handleAddFallbackModel(primary)}
                          style={{
                            padding: '0.375rem 0.75rem',
                            borderRadius: '0.375rem',
                            background: 'var(--primary-glow)',
                            border: 'none',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          Add Fallback
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
