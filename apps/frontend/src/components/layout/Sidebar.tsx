import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileCode,
  Key,
  Activity,
  Settings,
  LogOut,
  Terminal,
} from 'lucide-react';
import GatewayOrb from './GatewayOrb';

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('llm-gateway-token');
    localStorage.removeItem('llm-gateway-team-id');
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/logs', label: 'Request Logs', icon: FileCode },
    { to: '/keys', label: 'API Keys', icon: Key },
    { to: '/realtime', label: 'Live Stream', icon: Activity },
    { to: '/settings', label: 'Gateway Settings', icon: Settings },
  ];

  return (
    <aside
      style={{
        width: '260px',
        height: '100vh',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderRight: '1px solid var(--glass-border-light)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '4px 0 30px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Brand Logo & Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '2.5rem',
          padding: '0.5rem 0.25rem',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '0.5rem',
            background: 'linear-gradient(135deg, var(--primary-glow), var(--accent-glow))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px var(--glass-glow)',
          }}
        >
          <Terminal size={18} style={{ color: '#fff' }} />
        </div>
        <div>
          <h1
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            LLM Gateway
          </h1>
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              display: 'block',
              fontWeight: 500,
            }}
          >
            v1.0.0 (Enterprise)
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.875rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--glass-bg-active)' : 'transparent',
              border: isActive
                ? '1px solid var(--glass-border-light)'
                : '1px solid transparent',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s ease',
              boxShadow: isActive ? 'inset 0 0 10px var(--glass-glow)' : 'none',
            })}
            className="sidebar-link"
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer with Orb & Logout */}
      <div
        style={{
          borderTop: '1px solid var(--glass-border-light)',
          paddingTop: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <GatewayOrb />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Theme Node
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                Click to switch
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.875rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.1)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.1)';
          }}
        >
          <LogOut size={18} />
          <span>Disconnect</span>
        </button>
      </div>
    </aside>
  );
}
