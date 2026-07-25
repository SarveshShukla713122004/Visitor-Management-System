import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Search, ShieldAlert } from 'lucide-react';

export default function HODDashboard({ token, user, refreshTrigger }) {
  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Rejection Modal State
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Delegate HOD State
  const [hodsList, setHodsList] = useState([]);
  const [selectedDelegate, setSelectedDelegate] = useState(user.delegateHOD?._id || '');

  const fetchData = async () => {
    try {
      const [rRes, mRes, hRes] = await Promise.all([
        fetch(`http://localhost:5000/api/requests?status=${statusFilter}&search=${searchTerm}&page=${page}&limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:5000/api/analytics/dashboard', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:5000/api/users/hods', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
      ]);

      const rData = await rRes.json();
      const mData = await mRes.json();
      const hData = await hRes.json();

      if (rData.success) {
        setRequests(rData.requests);
        setTotalPages(rData.pages || 1);
      }
      if (mData.success) setMetrics(mData.metrics);
      if (hData.success) setHodsList(hData.hods.filter(h => h._id !== user.id));
    } catch (e) {
      console.error(e);
    } finally {}
  };

  useEffect(() => {
    fetchData();
  }, [token, refreshTrigger, statusFilter, searchTerm, page]);

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/requests/${id}/hod-approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        if (data.blacklistHit) {
          alert('⚠️ Request approved by HOD, but visitor hit BLACKLIST! Auto-flagged for Admin review.');
        } else {
          alert('✅ Visitor Request approved! Auto-forwarded to Security clearance queue.');
        }
        fetchData();
      } else {
        alert(data.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('Mandatory short reason required for rejection.');
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/requests/${rejectingId}/hod-reject`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const data = await res.json();
      if (data.success) {
        alert('❌ Request rejected. Reason sent to Employee.');
        setRejectingId(null);
        setRejectionReason('');
        fetchData();
      } else {
        alert(data.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSetDelegate = async (delegateId) => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/delegate', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegateHODId: delegateId || null }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedDelegate(delegateId);
        alert(delegateId ? 'Delegate HOD assigned successfully!' : 'Delegate HOD cleared.');
      } else {
        alert(data.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900">Head of Department Panel</h2>
            <span className="badge badge-purple text-xs font-bold">{user.department}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Review department visitor requests, approve or reject with mandatory reason, and assign delegates.</p>
        </div>

        {/* Delegate Picker */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 border border-slate-200 rounded-lg">
          <span className="text-[10px] font-bold uppercase text-slate-500">Leave Delegate:</span>
          <select
            value={selectedDelegate}
            onChange={(e) => handleSetDelegate(e.target.value)}
            className="text-xs font-bold bg-white border border-slate-300 rounded px-2 py-1 outline-none text-slate-700"
          >
            <option value="">No Delegate (Active)</option>
            {hodsList.map(h => (
              <option key={h._id} value={h._id}>{h.name} ({h.department})</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Pending Review</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{metrics?.pendingReview || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Approved This Week</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{metrics?.approvedThisWeek || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Rejected This Week</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{metrics?.rejectedThisWeek || 0}</div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-slate-900 text-base">Department Request Queue</h3>
            <span className="text-xs text-slate-400 font-normal">({requests.length} records)</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search visitor/phone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input pl-8 py-1.5 text-xs w-48"
              />
            </div>

            {/* Status Filter */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {['Pending', 'HOD Approved', 'HOD Rejected', 'Checked-In', 'all'].map(st => (
                <button
                  key={st}
                  onClick={() => { setStatusFilter(st); setPage(1); }}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${statusFilter === st ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {st === 'all' ? 'All' : st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600">
              <tr>
                <th className="px-4 py-3">Visitor Name</th>
                <th className="px-4 py-3">Company / Org</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Host Employee</th>
                <th className="px-4 py-3">Phone &amp; Aadhaar</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No requests found matching status '{statusFilter}'.
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-extrabold text-slate-900">{req.visitorName}</div>
                      <div className="text-[10px] text-slate-400">{req.requestType}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{req.company || 'Individual'}</td>
                    <td className="px-4 py-3">
                      <span className="badge badge-navy text-[10px]">{req.purpose}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{req.submittedBy?.name || 'N/A'}</div>
                      <div className="text-[10px] text-slate-400">{req.submittedBy?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                      <div>{req.phone}</div>
                      <div className="text-[10px] text-slate-400">{req.aadhaar || 'No ID'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        req.status === 'Pending' ? 'badge-amber' :
                        req.status === 'HOD Approved' ? 'badge-blue' :
                        req.status === 'HOD Rejected' ? 'badge-red' :
                        req.status === 'Checked-In' ? 'badge-green' : 'badge-slate'
                      }`}>
                        {req.status}
                      </span>
                      {req.rejectionReason && (
                        <div className="text-[10px] text-rose-600 mt-0.5 truncate max-w-xs">
                          Reason: {req.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApprove(req._id)}
                            className="btn btn-sm btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 py-1 text-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(req._id)}
                            className="btn btn-sm btn-danger py-1 text-xs"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">Processed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Rejection Reason Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-2xl border border-slate-200 animate-fade-in space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" /> Mandatory Rejection Reason
            </h3>
            <p className="text-xs text-slate-500">Provide a brief mandatory reason for rejecting this visitor request. This reason will be visible to the submitting Employee.</p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <textarea
                required
                rows={3}
                placeholder="e.g. Host unavailable, meeting rescheduled, insufficient visitor detail..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="input w-full text-xs"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger btn-sm">
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
