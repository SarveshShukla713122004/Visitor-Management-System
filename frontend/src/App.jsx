import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import NotificationBell from './components/NotificationBell';
import { MeconLogo } from './components/MeconLogo';
import { LayoutDashboard, LogOut, Menu } from 'lucide-react';
import io from 'socket.io-client';

import AdminDashboard from './pages/AdminDashboard';
import HODDashboard from './pages/HODDashboard';
import SecurityDashboard from './pages/GateDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';

const ROLE_STYLES = {
  'Admin':    { badge: 'bg-rose-600', dot: 'bg-rose-500', title: 'Admin Master Panel' },
  'HOD':      { badge: 'bg-purple-600', dot: 'bg-purple-500', title: 'HOD Department Desk' },
  'Security': { badge: 'bg-amber-600', dot: 'bg-amber-500', title: 'Gate Security Clearance' },
  'Employee': { badge: 'bg-emerald-600', dot: 'bg-emerald-500', title: 'Host Employee Portal' },
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLoginSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setToken(''); setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Socket.io initialization
  useEffect(() => {
    if (!token || !user) return;
    const newSocket = io('http://localhost:5000');
    newSocket.emit('join', user.id);

    newSocket.on('new_request', () => setRefreshTrigger(prev => prev + 1));
    newSocket.on('status_update', () => setRefreshTrigger(prev => prev + 1));
    newSocket.on('hod_approved', () => setRefreshTrigger(prev => prev + 1));
    newSocket.on('checkin_update', () => setRefreshTrigger(prev => prev + 1));
    newSocket.on('checkout_update', () => setRefreshTrigger(prev => prev + 1));

    return () => newSocket.close();
  }, [token, user?.id]);

  // Validate stored token on mount
  useEffect(() => {
    if (!token) return;
    fetch('http://localhost:5000/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (!data.success) handleLogout();
      })
      .catch(() => handleLogout());
  }, []);

  if (!token || !user) return <Login onLoginSuccess={handleLoginSuccess} />;

  const roleStyle = ROLE_STYLES[user.role] || { badge: 'bg-slate-600', dot: 'bg-slate-500', title: 'Portal' };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans">
      {/* Sidebar */}
      <aside
        style={{ background: '#0b1b2b', borderRight: '1px solid rgba(255,255,255,0.06)' }}
        className={`flex flex-col flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-60' : 'w-16'}`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 flex-shrink-0 border-b border-slate-800/60">
          <MeconLogo className="h-9 w-9" />
          {sidebarOpen && (
            <div className="min-w-0">
              <h2 className="font-black text-sm text-white tracking-wider">MECON VMS</h2>
              <p className="text-[9px] font-bold tracking-widest text-slate-500">4-ROLE SECURITY SYSTEM</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {sidebarOpen ? 'Dashboard' : '•••'}
          </div>

          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold bg-sky-900/40 text-sky-300 border border-sky-700/50">
            <LayoutDashboard className="h-4 w-4" />
            {sidebarOpen && <span>{user.role} Dashboard</span>}
          </button>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800/60 flex-shrink-0">
          <div className={`flex items-center gap-2.5 ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${roleStyle.dot}`}>
              {user.name.charAt(0)}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-200 truncate">{user.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{user.role} · {user.department || 'HQ'}</div>
              </div>
            )}
            {sidebarOpen && (
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <h1 className="font-bold text-slate-900 text-sm">{roleStyle.title}</h1>
              <p className="text-[10px] text-slate-400">MECON Limited · Ranchi Engineering Headquarters</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <NotificationBell token={token} />

            {/* Role Chip */}
            <div className={`px-3 py-1 rounded-full text-white text-[10px] font-extrabold ${roleStyle.badge}`}>
              {user.role}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {user.role === 'Admin' && <AdminDashboard token={token} user={user} refreshTrigger={refreshTrigger} />}
          {user.role === 'HOD' && <HODDashboard token={token} user={user} refreshTrigger={refreshTrigger} />}
          {user.role === 'Security' && <SecurityDashboard token={token} user={user} refreshTrigger={refreshTrigger} />}
          {user.role === 'Employee' && <EmployeeDashboard token={token} user={user} refreshTrigger={refreshTrigger} />}
        </main>
      </div>
    </div>
  );
}
