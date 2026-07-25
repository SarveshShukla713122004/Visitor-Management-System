import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, QrCode, Activity, FileDown, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export default function SecurityDashboard({ token, refreshTrigger }) {
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'checkedin'
  const [requests, setRequests] = useState([]);
  const [checkedInList, setCheckedInList] = useState([]);
  const [metrics, setMetrics] = useState(null);

  // Selected Request for Pass Generation Modal
  const [selectedPass, setSelectedPass] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const fetchData = async () => {
    try {
      const [rRes, cRes, mRes] = await Promise.all([
        fetch('http://localhost:5000/api/requests?status=HOD Approved', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:5000/api/requests/checked-in', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:5000/api/analytics/dashboard', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
      ]);

      const rData = await rRes.json();
      const cData = await cRes.json();
      const mData = await mRes.json();

      if (rData.success) setRequests(rData.requests);
      if (cData.success) setCheckedInList(cData.requests);
      if (mData.success) setMetrics(mData.metrics);
    } catch (e) {
      console.error(e);
    } finally {}
  };

  useEffect(() => {
    fetchData();
  }, [token, refreshTrigger]);

  // Open Gate Pass Modal & Generate QR
  const handleOpenPassModal = async (reqObj) => {
    setSelectedPass(reqObj);
    try {
      const qrUrl = await QRCode.toDataURL(reqObj.gatePassId || reqObj._id, { margin: 1 });
      setQrDataUrl(qrUrl);
    } catch (e) { console.error(e); }
  };

  // Perform Check-In
  const handleCheckIn = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/requests/${id}/checkin`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        alert('🟢 Physical ID Verified! Visitor Checked In successfully.');
        setSelectedPass(null);
        fetchData();
      } else { alert(data.message); }
    } catch (e) { console.error(e); }
  };

  // Perform Check-Out
  const handleCheckOut = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/requests/${id}/checkout`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        alert('⚪ Visitor Checked Out. Gate pass closed.');
        fetchData();
      } else { alert(data.message); }
    } catch (e) { console.error(e); }
  };

  // Download PDF Gate Pass
  const downloadPDFPass = () => {
    if (!selectedPass) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });

    // Header Background
    doc.setFillColor(11, 27, 43); // MECON Navy
    doc.rect(0, 0, 100, 24, 'F');

    // MECON Header
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('MECON LIMITED', 50, 10, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('GOVT. OF INDIA ENTERPRISE · RANCHI HQ', 50, 15, { align: 'center' });
    doc.text('OFFICIAL VISITOR GATE PASS', 50, 20, { align: 'center' });

    // Gate Pass ID
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`PASS ID: ${selectedPass.gatePassId || 'MEC-PASS'}`, 10, 32);

    // Visitor Photo or Box
    if (selectedPass.photoBase64) {
      try {
        doc.addImage(selectedPass.photoBase64, 'JPEG', 68, 30, 22, 26);
      } catch {
        doc.rect(68, 30, 22, 26);
      }
    } else {
      doc.setDrawColor(200, 200, 200);
      doc.rect(68, 30, 22, 26);
      doc.setFontSize(6);
      doc.text('NO PHOTO', 79, 44, { align: 'center' });
    }

    // Details
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Visitor Name:', 10, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedPass.visitorName, 32, 40);

    doc.setFont('helvetica', 'bold');
    doc.text('Organization:', 10, 46);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedPass.company || 'Individual', 32, 46);

    doc.setFont('helvetica', 'bold');
    doc.text('Host Employee:', 10, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedPass.submittedBy?.name || 'MECON Staff', 32, 52);

    doc.setFont('helvetica', 'bold');
    doc.text('Department:', 10, 58);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedPass.department, 32, 58);

    doc.setFont('helvetica', 'bold');
    doc.text('Purpose:', 10, 64);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedPass.purpose, 32, 64);

    doc.setFont('helvetica', 'bold');
    doc.text('Valid Date:', 10, 70);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(selectedPass.visitDate || selectedPass.createdAt).toLocaleDateString('en-IN'), 32, 70);

    // QR Code
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', 35, 78, 30, 30);
    }

    // Expiry Notice
    doc.setFontSize(7);
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.text('PASS EXPIRES AT END OF DAY (23:59 IST)', 50, 115, { align: 'center' });
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Must be surrendered at Security exit check-out desk.', 50, 120, { align: 'center' });

    doc.save(`MECON_GatePass_${selectedPass.gatePassId || 'VMS'}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Security Gate Clearance Desk</h2>
          <p className="text-xs text-slate-500 mt-1">Verify HOD-approved visitors, perform physical ID verification, generate gate pass PDFs, and process exit check-outs.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'queue' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Clock className="h-4 w-4" /> Approved Queue ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('checkedin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'checkedin' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Activity className="h-4 w-4" /> Live Currently Checked-In ({checkedInList.length})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">HOD Approved Queue</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{metrics?.approvedQueue || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Currently Checked-In</div>
          <div className="text-2xl font-black text-teal-600 mt-1">{metrics?.currentlyCheckedIn || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Check-Ins Today</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{metrics?.todayCheckIns || 0}</div>
        </div>
        <div className="card card-hover stat-card bg-white border border-slate-200 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Blacklist Flagged</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{metrics?.blacklistFlagged || 0}</div>
        </div>
      </div>

      {/* TAB 1: APPROVED QUEUE */}
      {activeTab === 'queue' && (
        <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base">HOD-Approved Clearance Queue</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600">
                <tr>
                  <th className="px-4 py-3">Visitor Name</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Department &amp; Host</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Screening</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No HOD-approved visitors currently waiting in queue.
                    </td>
                  </tr>
                ) : (
                  requests.map(req => (
                    <tr key={req._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-extrabold text-slate-900">{req.visitorName}</td>
                      <td className="px-4 py-3 text-slate-600">{req.company || 'Individual'}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{req.department}</div>
                        <div className="text-[10px] text-slate-400">Host: {req.submittedBy?.name}</div>
                      </td>
                      <td className="px-4 py-3"><span className="badge badge-navy text-[10px]">{req.purpose}</span></td>
                      <td className="px-4 py-3">
                        {req.blacklistFlag ? (
                          <span className="badge badge-red flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Blacklist Flagged
                          </span>
                        ) : (
                          <span className="badge badge-green flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Clear
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenPassModal(req)}
                          className="btn btn-primary btn-sm text-xs py-1"
                        >
                          <QrCode className="h-3.5 w-3.5" /> Verify &amp; Generate Pass
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE CURRENTLY CHECKED-IN LIST */}
      {activeTab === 'checkedin' && (
        <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-base">Live Currently Checked-In Visitors ({checkedInList.length})</h3>
            <span className="text-xs text-slate-400 font-normal">Real-time Socket.io Sync Active</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600">
                <tr>
                  <th className="px-4 py-3">Gate Pass ID</th>
                  <th className="px-4 py-3">Visitor Name</th>
                  <th className="px-4 py-3">Department &amp; Host</th>
                  <th className="px-4 py-3">Check-In Time</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checkedInList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No visitors currently on campus.
                    </td>
                  </tr>
                ) : (
                  checkedInList.map(req => (
                    <tr key={req._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-sky-700">{req.gatePassId || 'PASS'}</td>
                      <td className="px-4 py-3 font-extrabold text-slate-900">{req.visitorName}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{req.department}</div>
                        <div className="text-[10px] text-slate-400">Host: {req.submittedBy?.name}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                        {new Date(req.checkInTime).toLocaleTimeString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleCheckOut(req._id)}
                          className="btn btn-secondary btn-sm text-xs py-1"
                        >
                          Check Out Exit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gate Pass Modal */}
      {selectedPass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-2xl border border-slate-200 animate-fade-in space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Gate Pass Clearance Modal</h3>
                <p className="text-[11px] text-slate-400">Verify physical identity documents before granting clearance.</p>
              </div>
              <button onClick={() => setSelectedPass(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">×</button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-slate-900 text-base">{selectedPass.visitorName}</div>
                  <div className="text-xs text-slate-500">{selectedPass.company || 'Individual'}</div>
                </div>
                {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-16 h-16 rounded border bg-white p-1" />}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                <div><span className="font-bold text-slate-500">Phone:</span> {selectedPass.phone}</div>
                <div><span className="font-bold text-slate-500">Aadhaar:</span> {selectedPass.aadhaar || 'N/A'}</div>
                <div><span className="font-bold text-slate-500">Dept:</span> {selectedPass.department}</div>
                <div><span className="font-bold text-slate-500">Host:</span> {selectedPass.submittedBy?.name}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button onClick={downloadPDFPass} className="btn btn-secondary btn-lg w-full flex items-center justify-center gap-2">
                <FileDown className="h-4 w-4" /> Download Official Gate Pass (PDF)
              </button>
              <button onClick={() => handleCheckIn(selectedPass._id)} className="btn btn-primary btn-lg w-full">
                Verify Physical ID &amp; Confirm Check-In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
