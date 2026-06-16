import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Key, Shield } from 'lucide-react';
import GlassCard from '../components/glass/GlassCard';
import GlassInput from '../components/glass/GlassInput';
import GlassButton from '../components/glass/GlassButton';
import GlassAlert from '../components/glass/GlassAlert';

export default function LoginPage() {
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Please enter a valid Supabase JWT token.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Decode the token locally just to check if it's structured like a JWT
      const parts = tokenInput.split('.');
      if (parts.length !== 3) {
        throw new Error('Token is not a valid 3-part JWT structure.');
      }

      const payload = JSON.parse(atob(parts[1]));
      // Avoid using client-writable user_metadata to prevent BOLA escalation
      const teamId = payload.app_metadata?.team_id || payload.sub;

      if (!teamId) {
        throw new Error('No User ID or Team ID claim found in token payload.');
      }

      // Store in localStorage
      localStorage.setItem('llm-gateway-token', tokenInput.trim());
      localStorage.setItem('llm-gateway-team-id', teamId);

      // Navigate to dashboard
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid JWT token. Please make sure it is a valid Supabase-issued token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 50%, #1a1230 0%, #0a0813 100%)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Background Mesh Gradient Orbs */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0) 70%)',
          top: '-10%',
          left: '-10%',
          filter: 'blur(80px)',
          animation: 'pulse 8s infinite alternate',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, rgba(236, 72, 153, 0) 70%)',
          bottom: '-10%',
          right: '-10%',
          filter: 'blur(80px)',
          animation: 'pulse 10s infinite alternate-reverse',
        }}
      />

      <GlassCard
        variant="default"
        glow
        padding="2.5rem"
        style={{
          width: '420px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, var(--primary-glow), var(--accent-glow))',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)',
            }}
          >
            <Terminal size={24} style={{ color: '#fff' }} />
          </div>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            LLM Gateway
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
            Enterprise LLM Router & Logs Dashboard
          </p>
        </div>

        {error && (
          <GlassAlert variant="error" style={{ marginBottom: '1.25rem' }}>
            {error}
          </GlassAlert>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <GlassInput
            label="Dashboard Access JWT"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            icon={<Key size={16} />}
            required
          />

          <GlassButton type="submit" variant="primary" loading={loading} style={{ marginTop: '0.5rem' }}>
            Connect Session
          </GlassButton>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--glass-border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <Shield size={14} style={{ color: 'var(--text-muted)', marginTop: '2px' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Paste your Supabase auth JWT token. The gateway checks this token against its configured JWT secret to grant dashboard access.
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
