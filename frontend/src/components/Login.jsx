import React, { useState } from 'react';
import { Building2, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { MeconLogo } from './MeconLogo';

const DEMO_ACCOUNTS = [
  { name: 'System Admin',     email: 'admin@mecon.co.in',          password: 'Password123', role: 'Admin' },
  { name: 'Dr. Roy (HOD)',    email: 'hod.metallurgy@mecon.co.in', password: 'Password123', role: 'HOD' },
  { name: 'Rajesh (Employee)',email: 'employee@mecon.co.in',       password: 'Password123', role: 'Employee' },
  { name: 'Vikram (Security)',email: 'security@mecon.co.in',       password: 'Password123', role: 'Security' },
];

const FEATURES = [
  'Role-based 4-stage approval workflow (Employee → HOD → Security → Pass)',
  'Instant gate pass PDF generation with QR code validation',
  'Automated security watchlist & blacklist screening',
];

const STATS = [
  { value: '4',    label: 'Strict Security Roles' },
  { value: '100%', label: 'HOD Department Scoping' },
  { value: '24/7', label: 'Audit Trail Tracking' },
];

export default function Login({ onLoginSuccess }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [loading, setLoading]   = useState(false);

  const doLogin = async (loginEmail, loginPassword) => {
    setError(''); setForgotMsg(''); setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.token, data.user);
      } else {
        setError(data.message || 'Authentication failed. Please check your credentials.');
      }
    } catch {
      setError('Unable to connect to the authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setForgotMsg(data.message);
    } catch {
      setError('Failed to process request.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* LEFT: Branding Panel */}
      <div
        className="md:w-[52%] relative flex flex-col p-10 md:p-14 overflow-hidden"
        style={{ background: 'linear-gradient(145deg,#060f1a 0%,#0b1b2b 45%,#112236 100%)', minHeight: '100vh' }}
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(68,123,163,0.2) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(26,58,95,0.4) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex flex-col justify-between h-full space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3.5">
            <MeconLogo className="h-11 w-11" />
            <div>
              <div className="text-white font-black text-sm tracking-widest uppercase">MECON LIMITED</div>
              <div className="flex items-center gap-1 mt-0.5" style={{ color: '#447ba3', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                <Building2 className="h-2.5 w-2.5" />
                MINISTRY OF STEEL · GOVT. OF INDIA
              </div>
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h2 className="font-black leading-none text-white" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', letterSpacing: '-0.02em' }}>
              Visitor Management<br />
              <span style={{ color: '#5a9ec9' }}>&amp; Gate Access Control</span>
            </h2>
            <p style={{ color: '#7ea9c4', fontSize: '0.9rem', lineHeight: '1.75', maxWidth: '36ch' }}>
              Enterprise 4-role security system for MECON Ranchi HQ — strict role enforcement, HOD delegation, and live gate clearance.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span style={{ color: '#b0cfe0', fontSize: '0.85rem', fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {STATS.map((s, i) => (
              <div key={i}>
                <div className="font-black text-white" style={{ fontSize: '1.6rem', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: '#4a7a9b', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.3rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Sign-in Card */}
      <div className="md:w-[48%] flex items-center justify-center p-6 md:p-12 bg-slate-100">
        <div className="w-full max-w-md space-y-6 bg-white p-8 md:p-10 rounded-2xl animate-fade-in relative overflow-hidden shadow-xl border border-slate-200">
          
          <div>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In to MECON VMS</h3>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg text-xs font-medium bg-rose-50 border border-rose-200 text-rose-700">
              {error}
            </div>
          )}

          {forgotMsg && (
            <div className="px-4 py-3 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-800">
              {forgotMsg}
            </div>
          )}

          <form className="space-y-4" onSubmit={e => { e.preventDefault(); doLogin(email, password); }}>
            <div className="space-y-3.5">
              <div>
                <label className="block mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Email Address
                </label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="name@mecon.co.in" className="input"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] font-bold text-sky-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'} required value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" className="input pr-10"
                  />
                  <button
                    type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full mt-2">
              {loading ? 'Authenticating...' : (
                <>Access Portal <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="pt-4 border-t border-slate-100">
            <div className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">
              Quick 4-Role Demo Login
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.role} type="button" onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    doLogin(acc.email, acc.password);
                  }}
                  className="px-2.5 py-2 rounded-xl text-left border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all text-xs"
                >
                  <div className="font-bold text-slate-800">{acc.role}</div>
                  <div className="text-[10px] text-slate-500 truncate">{acc.name}</div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
