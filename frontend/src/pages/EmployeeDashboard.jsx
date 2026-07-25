import React, { useState, useEffect } from 'react';
import { Clock, UserPlus, Search, CheckCircle2, AlertCircle } from 'lucide-react';

const PURPOSES = [
  'Vendor/Contractor Meeting',
  'Client Visit',
  'Interview',
  'Official/Government Visit',
  'Delivery',
  'Other'
];

export default function EmployeeDashboard({ token, user, refreshTrigger }) {
  const [activeTab, setActiveTab] = useState('my-requests'); // 'my-requests' | 'new'
  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [visitorName, setVisitorName] = useState('');
  const [company, setCompany]         = useState('');
  const [purpose, setPurpose]         = useState(PURPOSES[0]);
  const [phone, setPhone]             = useState('');
  const [aadhaar, setAadhaar]         = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [requestType, setRequestType] = useState('single-visit');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');

  const [formError, setFormError]     = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoFilled, setAutoFilled]   = useState(false);

  const fetchData = async () => {
    try {
      const [rRes, mRes] = await Promise.all([
        fetch(`http://localhost:5000/api/requests?search=${searchTerm}&page=1&limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:5000/api/analytics/dashboard', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
      ]);

      const rData = await rRes.json();
      const mData = await mRes.json();

      if (rData.success) {
        setRequests(rData.requests);
      }
      if (mData.success) setMetrics(mData.metrics);
    } catch (e) {
      console.error(e);
    } finally {
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, refreshTrigger, searchTerm]);

  // Phone Autofill Lookup
  const handlePhoneBlur = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) return;

    try {
      const res = await fetch(`http://localhost:5000/api/requests/autofill?phone=${cleanPhone}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.visitor) {
        setVisitorName(data.visitor.visitorName || '');
        setCompany(data.visitor.company || '');
        if (data.visitor.aadhaar && data.visitor.aadhaar !== '****') {
          // Don't overwrite aadhaar if masked
        }
        setAutoFilled(true);
      }
    } catch (e) { console.error(e); }
  };

  // Image Upload Handler
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setFormError('Photo must be JPG or PNG format.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFormError('Photo size must be under 2MB.');
      return;
    }

    setFormError('');
    const reader = new FileReader();
    reader.onloadend = () => setPhotoBase64(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Frontend Validations
    if (!visitorName.trim()) { setFormError('Visitor Name is required.'); return; }
    const cleanPhone = phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setFormError('Phone must be a valid 10-digit Indian mobile number.');
      return;
    }

    if (aadhaar) {
      const cleanAadhaar = aadhaar.replace(/\D/g, '');
      if (cleanAadhaar.length !== 12) {
        setFormError('Aadhaar must be exactly 12 digits.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:5000/api/requests', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorName, company, purpose, phone: cleanPhone, aadhaar, photoBase64,
          requestType, startDate, endDate
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('✅ Visitor Request submitted successfully! Sent to HOD for approval.');
        // Reset
        setVisitorName(''); setCompany(''); setPhone(''); setAadhaar(''); setPhotoBase64('');
        setAutoFilled(false);
        setActiveTab('my-requests');
        fetchData();
      } else {
        setFormError(data.message || 'Failed to submit request.');
      }
    } catch {
      setFormError('Network error while submitting request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Host Employee Portal</h2>
          <p className="text-xs text-slate-500 mt-1">Submit visitor approval requests to your HOD and track live request statuses.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('my-requests')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'my-requests' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Clock className="h-4 w-4" /> My Submissions
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'new' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <UserPlus className="h-4 w-4" /> Submit Visitor Request
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">My Pending Requests</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{metrics?.myPending || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">My Approved Today</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{metrics?.myApprovedToday || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Currently On Campus</div>
          <div className="text-2xl font-black text-teal-600 mt-1">{metrics?.myCheckedIn || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-slate-800" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total History</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics?.myTotal || 0}</div>
        </div>
      </div>

      {/* TAB 1: MY SUBMISSIONS TABLE */}
      {activeTab === 'my-requests' && (
        <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-extrabold text-slate-900 text-base">My Submitted Requests</h3>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search visitor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input pl-8 py-1.5 text-xs w-48"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600">
                <tr>
                  <th className="px-4 py-3">Visitor Name</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Phone &amp; Aadhaar</th>
                  <th className="px-4 py-3">Live Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No visitor requests submitted yet.
                    </td>
                  </tr>
                ) : (
                  requests.map(req => (
                    <tr key={req._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-extrabold text-slate-900">{req.visitorName}</td>
                      <td className="px-4 py-3 text-slate-600">{req.company || 'Individual'}</td>
                      <td className="px-4 py-3">
                        <span className="badge badge-navy text-[10px]">{req.purpose}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">
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
                        {req.status === 'HOD Rejected' && req.rejectionReason && (
                          <div className="text-[10px] font-semibold text-rose-600 mt-0.5">
                            Reason: {req.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {new Date(req.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: NEW REQUEST FORM */}
      {activeTab === 'new' && (
        <div className="card p-8 bg-white border border-slate-200 rounded-xl shadow-sm max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Submit New Visitor Request</h3>
            <p className="text-xs text-slate-500 mt-1">This request will be routed directly to your HOD ({user.department}) for approval.</p>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {formError}
            </div>
          )}

          {autoFilled && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs font-semibold text-sky-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-sky-600" /> Auto-filled details from past visitor record!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Visitor Phone Number * (Auto-fill trigger)
                </label>
                <input
                  type="text"
                  required
                  placeholder="10-digit Indian mobile e.g. 9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onBlur={handlePhoneBlur}
                  className="input"
                />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Visitor Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={visitorName}
                  onChange={e => setVisitorName(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Company / Organization
                </label>
                <input
                  type="text"
                  placeholder="Organization / Company Name"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Purpose of Visit *
                </label>
                <select
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="input font-semibold"
                >
                  {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Aadhaar Number (12 Digits)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="12-digit Aadhaar (Masked on read)"
                  value={aadhaar}
                  onChange={e => setAadhaar(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Request Pass Type
                </label>
                <select
                  value={requestType}
                  onChange={e => setRequestType(e.target.value)}
                  className="input font-semibold"
                >
                  <option value="single-visit">Single-Visit Pass</option>
                  <option value="multi-day-contractor">Multi-Day Contractor Pass</option>
                </select>
              </div>
            </div>

            {/* Multi-day contractor dates */}
            {requestType === 'multi-day-contractor' && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <label className="block mb-1 text-[10px] font-bold uppercase text-slate-600">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input text-xs" />
                </div>
                <div>
                  <label className="block mb-1 text-[10px] font-bold uppercase text-slate-600">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input text-xs" />
                </div>
              </div>
            )}

            {/* Photo Upload */}
            <div>
              <label className="block mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Visitor Photo (JPG/PNG max 2MB)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleImageUpload}
                  className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
                {photoBase64 && (
                  <img src={photoBase64} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-slate-300" />
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary btn-lg w-full"
              >
                {isSubmitting ? 'Submitting Request...' : 'Submit Visitor Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
