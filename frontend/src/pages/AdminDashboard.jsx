import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, UserPlus, BarChart3, PieChart as PieIcon, Activity, Sparkles } from 'lucide-react';

const COLORS = ['#1a3a5f', '#447ba3', '#689bc2', '#9bbed6', '#c5d9e8', '#284e6c', '#336185', '#0b1b2b'];

export default function AdminDashboard({ token, refreshTrigger }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'analytics' | 'users' | 'blacklist' | 'audit'
  const [metrics, setMetrics] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [flaggedRequests, setFlaggedRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [mlData, setMlData] = useState(null);
  const [loading, setLoading] = useState(true);

  // New User Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uName, setUName]         = useState('');
  const [uEmail, setUEmail]       = useState('');
  const [uPassword] = useState('Password123');
  const [uRole, setURole]         = useState('Employee');
  const [uDept, setUDept]         = useState('Metallurgy & Steel Process');
  const [uPhone, setUPhone]       = useState('');
  const [uErr, setUErr]           = useState('');
  const [uWarn, setUWarn]         = useState('');

  // New Blacklist Entry Form State
  const [bName, setBName]     = useState('');
  const [bPhone, setBPhone]   = useState('');
  const [bAadhaar, setBAadhaar] = useState('');
  const [bReason, setBReason] = useState('');
  const [bSeverity, setBSeverity] = useState('Medium');

  const fetchData = async () => {
    try {
      const [mRes, uRes, bRes, fRes, aRes, mlRes] = await Promise.all([
        fetch('http://localhost:5000/api/analytics/dashboard', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/users', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/blacklist', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/blacklist/flagged', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/audit', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/ml/forecast', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      const mData = await mRes.json();
      const uData = await uRes.json();
      const bData = await bRes.json();
      const fData = await fRes.json();
      const aData = await aRes.json();
      const mlDataRes = await mlRes.json();

      if (mData.success) setMetrics(mData.metrics);
      if (uData.success) setUsersList(uData.users);
      if (bData.success) setBlacklist(bData.blacklist);
      if (fData.success) setFlaggedRequests(fData.requests);
      if (aData.success) setAuditLogs(aData.logs);
      if (mlDataRes.success) setMlData(mlDataRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, refreshTrigger]);

  // Create User Handler
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUErr(''); setUWarn('');
    try {
      const res = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: uName, email: uEmail, password: uPassword, role: uRole, department: uDept, phone: uPhone }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.warning) setUWarn(data.warning);
        alert('✅ Account created successfully!');
        setShowCreateModal(false);
        setUName(''); setUEmail(''); setUPhone('');
        fetchData();
      } else {
        setUErr(data.message || 'Failed to create user.');
      }
    } catch { setUErr('Error connecting to server.'); }
  };

  // Toggle User Active Status
  const handleToggleActive = async (userObj) => {
    const action = userObj.active ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} ${userObj.name}?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/users/${userObj._id}/${action}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        alert(`Account ${action}d.`);
        fetchData();
      } else { alert(data.message); }
    } catch (e) { console.error(e); }
  };

  // Blacklist Add
  const handleAddBlacklist = async (e) => {
    e.preventDefault();
    if (!bName.trim() || !bReason.trim()) return;
    try {
      const res = await fetch('http://localhost:5000/api/blacklist', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bName, phone: bPhone, aadhaar: bAadhaar, reason: bReason, severity: bSeverity }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Entry added to blacklist.');
        setBName(''); setBPhone(''); setBAadhaar(''); setBReason('');
        fetchData();
      } else { alert(data.message); }
    } catch (e) { console.error(e); }
  };

  // Admin Flag Resolution
  const handleResolveFlag = async (id, action) => {
    const note = prompt(`Enter resolution note for ${action.toUpperCase()}:`);
    try {
      const res = await fetch(`http://localhost:5000/api/requests/${id}/admin-override`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Flag resolved with action: ${action}`);
        fetchData();
      } else { alert(data.message); }
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Admin Control Panel...</div>;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Admin Control Panel</h2>
          <p className="text-xs text-slate-500 mt-1">Provision accounts, manage department HODs, view ML analytics, manage blacklist, and inspect audit log.</p>
        </div>

        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl">
          {['overview', 'analytics', 'users', 'blacklist', 'audit'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${activeTab === tab ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {tab === 'users' ? `Users (${usersList.length})` : tab === 'blacklist' ? `Blacklist (${blacklist.length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-slate-800" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Active Users</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics?.totalUsers || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Pending Requests</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{metrics?.pendingRequests || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Approved Today</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{metrics?.approvedToday || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Currently Checked-In</div>
          <div className="text-2xl font-black text-teal-600 mt-1">{metrics?.currentlyCheckedIn || 0}</div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Weekly ML Intelligence Insight Banner */}
          {mlData?.weeklyInsight && (
            <div className="p-5 bg-gradient-to-r from-sky-900 to-indigo-900 text-white rounded-xl shadow-lg space-y-2 relative overflow-hidden">
              <div className="flex items-center gap-2 text-sky-300 font-extrabold text-xs uppercase tracking-wider">
                <Sparkles className="h-4 w-4" /> Auto-Generated Weekly Intelligence Insights
              </div>
              <p className="text-sm font-medium leading-relaxed">{mlData.weeklyInsight}</p>
            </div>
          )}

          {/* Blacklist Flagged Requests Needing Admin Attention */}
          {flaggedRequests.length > 0 && (
            <div className="card p-6 bg-rose-50 border border-rose-200 rounded-xl space-y-4">
              <h3 className="text-base font-extrabold text-rose-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" /> Blacklist Flagged Requests Needing Admin Review ({flaggedRequests.length})
              </h3>
              <div className="space-y-3">
                {flaggedRequests.map(req => (
                  <div key={req._id} className="p-4 bg-white border border-rose-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">{req.visitorName} ({req.company || 'N/A'})</div>
                      <div className="text-xs text-rose-700 mt-0.5">Flag Reason: {req.blacklistReason}</div>
                      <div className="text-[10px] text-slate-400">Department: {req.department} · Host: {req.submittedBy?.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleResolveFlag(req._id, 'clear-flag')} className="btn btn-sm btn-primary bg-emerald-600 border-emerald-600 text-xs">
                        Clear Flag &amp; Approve
                      </button>
                      <button onClick={() => handleResolveFlag(req._id, 'reject')} className="btn btn-sm btn-danger text-xs">
                        Reject Request
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Department-HOD Safeguard Status Table */}
          <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Department-HOD Mapping Safeguards</h3>
            <p className="text-xs text-slate-500">The system strictly enforces maximum one HOD per department and warns if an employee belongs to a department with no HOD.</p>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Department Name</th>
                    <th className="px-4 py-3">Assigned HOD</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.filter(u => u.role === 'HOD').map(h => (
                    <tr key={h._id}>
                      <td className="px-4 py-3 font-bold text-slate-900">{h.department}</td>
                      <td className="px-4 py-3 text-slate-700 font-semibold">{h.name} ({h.email})</td>
                      <td className="px-4 py-3">
                        <span className="badge badge-green">HOD Assigned</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ML & ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Footfall Trend */}
            <div className="card p-5 bg-white border border-slate-200 rounded-xl lg:col-span-2 space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-600" /> 14-Day Campus Footfall Trend
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics?.dailyCounts || []}>
                    <defs>
                      <linearGradient id="footfallGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1a3a5f" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#1a3a5f" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#0b1b2b', color: '#fff', borderRadius: '8px', fontSize: 11 }} />
                    <Area type="monotone" dataKey="count" stroke="#1a3a5f" strokeWidth={2.5} fillOpacity={1} fill="url(#footfallGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Purpose Mix */}
            <div className="card p-5 bg-white border border-slate-200 rounded-xl space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-emerald-600" /> Purpose Breakdown
              </h3>
              <div className="h-64 flex items-center justify-center">
                {metrics?.purposeDistribution?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.purposeDistribution}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                        paddingAngle={3} dataKey="count" nameKey="purpose"
                      >
                        {metrics.purposeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-slate-400">No purpose data available.</div>
                )}
              </div>
            </div>
          </div>

          {/* HOD Bottleneck Detection */}
          <div className="card p-6 bg-white border border-slate-200 rounded-xl space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-amber-600" /> Process Bottleneck Detection (Avg HOD Approval Times)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">HOD Name</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Processed Count</th>
                    <th className="px-4 py-3">Avg Approval Time</th>
                    <th className="px-4 py-3">Bottleneck Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics?.hodBottleneck?.map(hod => (
                    <tr key={hod.hod}>
                      <td className="px-4 py-3 font-bold text-slate-900">{hod.hod}</td>
                      <td className="px-4 py-3 text-slate-600">{hod.department}</td>
                      <td className="px-4 py-3">{hod.totalProcessed}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{hod.avgApprovalMins} mins</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${hod.avgApprovalMins > 60 ? 'badge-red' : 'badge-green'}`}>
                          {hod.avgApprovalMins > 60 ? 'Delayed Process' : 'Optimal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rejection Rate by Purpose */}
          <div className="card p-6 bg-white border border-slate-200 rounded-xl space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Rejection Rate by Visit Purpose</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {metrics?.rejectionByPurpose?.map(item => (
                <div key={item.purpose} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-slate-800">{item.purpose}</div>
                  <div className="text-xl font-black text-rose-600">{item.rejectionRate}% Rejection</div>
                  <div className="text-[10px] text-slate-500">{item.rejected} rejected out of {item.total} total</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USERS DIRECTORY & PROVISIONING */}
      {activeTab === 'users' && (
        <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">Master User Accounts ({usersList.length})</h3>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
              <UserPlus className="h-4 w-4" /> Provision New User
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map(u => (
                  <tr key={u._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        u.role === 'Admin' ? 'badge-red' :
                        u.role === 'HOD' ? 'badge-purple' :
                        u.role === 'Security' ? 'badge-amber' : 'badge-green'
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.department || 'HQ'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.active ? 'badge-green' : 'badge-slate'}`}>
                        {u.active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'Admin' && (
                        <button onClick={() => handleToggleActive(u)} className="btn btn-ghost btn-sm text-xs py-0.5">
                          {u.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BLACKLIST MANAGEMENT */}
      {activeTab === 'blacklist' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6 bg-white border border-slate-200 rounded-xl space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Add Blacklist Entry</h3>
            <form onSubmit={handleAddBlacklist} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Full Name *</label>
                <input required type="text" value={bName} onChange={e => setBName(e.target.value)} className="input text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Phone Number</label>
                <input type="text" value={bPhone} onChange={e => setBPhone(e.target.value)} className="input text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">12-Digit Aadhaar</label>
                <input type="text" maxLength={12} value={bAadhaar} onChange={e => setBAadhaar(e.target.value)} className="input text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Reason *</label>
                <textarea required rows={2} value={bReason} onChange={e => setBReason(e.target.value)} className="input text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Severity</label>
                <select value={bSeverity} onChange={e => setBSeverity(e.target.value)} className="input text-xs font-bold">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <button type="submit" className="btn btn-danger btn-sm w-full">Add to Blacklist</button>
            </form>
          </div>

          <div className="card p-6 bg-white border border-slate-200 rounded-xl lg:col-span-2 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Active Blacklist Directory</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone / Aadhaar</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {blacklist.map(b => (
                    <tr key={b._id}>
                      <td className="px-4 py-3 font-bold text-slate-900">{b.name}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                        <div>{b.phone || 'No phone'}</div>
                        <div className="text-[10px] text-slate-400">{b.aadhaar ? `XXXX-XXXX-${b.aadhaar.slice(-4)}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{b.reason}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${b.severity === 'High' ? 'badge-red' : 'badge-amber'}`}>{b.severity}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-slate-900">System-Wide Audit Trail</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map(log => (
                  <tr key={log._id}>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">{log.actor?.name || 'System'}</td>
                    <td className="px-4 py-3"><span className="badge badge-navy text-[10px]">{log.action}</span></td>
                    <td className="px-4 py-3 text-slate-600">{log.targetType}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{JSON.stringify(log.details || {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provision User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-2xl shadow-2xl border border-slate-200 animate-fade-in space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Provision System User Account</h3>

            {uErr && <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">{uErr}</div>}
            {uWarn && <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-semibold">{uWarn}</div>}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Full Name *</label>
                <input required type="text" value={uName} onChange={e => setUName(e.target.value)} className="input text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Email Address *</label>
                  <input required type="email" value={uEmail} onChange={e => setUEmail(e.target.value)} className="input text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Role *</label>
                  <select value={uRole} onChange={e => setURole(e.target.value)} className="input text-xs font-bold">
                    <option value="Employee">Employee</option>
                    <option value="HOD">HOD</option>
                    <option value="Security">Security</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Department *</label>
                  <input required type="text" value={uDept} onChange={e => setUDept(e.target.value)} className="input text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Phone</label>
                  <input type="text" value={uPhone} onChange={e => setUPhone(e.target.value)} className="input text-xs" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
