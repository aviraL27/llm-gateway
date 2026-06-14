import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { getKeys, createKey, deleteKey } from '../services/api';
import PageTransition from '../components/layout/PageTransition';
import GlassTable from '../components/glass/GlassTable';
import GlassCard from '../components/glass/GlassCard';
import GlassButton from '../components/glass/GlassButton';
import GlassInput from '../components/glass/GlassInput';
import GlassModal from '../components/glass/GlassModal';
import GlassBadge from '../components/glass/GlassBadge';
import GlassAlert from '../components/glass/GlassAlert';
import { Copy, Plus, Trash2 } from 'lucide-react';
import type { ApiKey } from '../types';

export default function ApiKeysPage() {
  const { data: keys, loading, refetch } = useApi(getKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setCreating(true);
    try {
      const res = await createKey(newKeyName);
      setCreatedKey(res);
      setNewKeyName('');
      refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivatingId) return;

    try {
      await deleteKey(deactivatingId);
      setDeactivatingId(null);
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = () => {
    if (!createdKey?.key) return;
    navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const columns = [
    {
      header: 'Name',
      accessor: (row: ApiKey) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</span>
      ),
    },
    {
      header: 'Key Identifier',
      accessor: (row: ApiKey) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          lgw_live_...{row.id.substring(0, 8)}
        </span>
      ),
    },
    {
      header: 'Created At',
      accessor: (row: ApiKey) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Last Used',
      accessor: (row: ApiKey) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {row.last_used_at ? new Date(row.last_used_at).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (row: ApiKey) => (
        <GlassBadge variant={row.is_active ? 'success' : 'neutral'}>
          {row.is_active ? 'Active' : 'Deactivated'}
        </GlassBadge>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: ApiKey) =>
        row.is_active ? (
          <GlassButton
            variant="danger"
            onClick={() => setDeactivatingId(row.id)}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Trash2 size={12} />
            Revoke
          </GlassButton>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Revoked</span>
        ),
    },
  ];

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header */}
        <div>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            API Keys Management
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Generate and revoke access credentials for your client LLM requests.
          </p>
        </div>

        {/* Create Form */}
        <GlassCard variant="inset" padding="1.25rem">
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
            <GlassInput
              label="Generate New Key"
              placeholder="e.g. Production Web Client"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              containerStyle={{ flex: 1, margin: 0 }}
              required
            />
            <GlassButton type="submit" variant="primary" loading={creating} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '40px' }}>
              <Plus size={16} />
              Generate Key
            </GlassButton>
          </form>
        </GlassCard>

        {/* Keys Table */}
        <GlassTable columns={columns} data={keys || []} loading={loading} />

        {/* Created Key Modal */}
        <GlassModal open={!!createdKey} onClose={() => setCreatedKey(null)} title="API Key Generated Successfully" width="480px">
          {createdKey && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <GlassAlert variant="warning" title="Security Requirement">
                Save this key now. For security reasons, it cannot be displayed again. If lost, you must generate a new one.
              </GlassAlert>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {createdKey.name}
                </span>
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--glass-bg-dark)',
                    border: '1px solid var(--glass-border-light)',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem',
                      color: 'var(--text-primary)',
                      wordBreak: 'break-all',
                      paddingRight: '1rem',
                    }}
                  >
                    {createdKey.key}
                  </span>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copied ? '#10b981' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.25rem',
                    }}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <GlassButton variant="secondary" onClick={() => setCreatedKey(null)}>
                  Close
                </GlassButton>
              </div>
            </div>
          )}
        </GlassModal>

        {/* Revoke Key Modal */}
        <GlassModal open={!!deactivatingId} onClose={() => setDeactivatingId(null)} title="Revoke API Key" width="400px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Are you sure you want to deactivate this API key? This action is permanent. Any clients using this key will immediately fail with a 401 Unauthorized status code.
            </span>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <GlassButton variant="secondary" onClick={() => setDeactivatingId(null)}>
                Cancel
              </GlassButton>
              <GlassButton variant="danger" onClick={handleDeactivate}>
                Confirm Revocation
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      </div>
    </PageTransition>
  );
}
