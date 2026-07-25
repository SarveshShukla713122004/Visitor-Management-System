import React, { useState } from 'react';
import { Bell, AlertTriangle, Info, Clock, UserCheck } from 'lucide-react';

export default function NotificationBell({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [token]);

  const markAllRead = async () => {
    try {
      await fetch('http://localhost:5000/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) { console.error(e); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
        className="btn btn-ghost btn-icon relative text-slate-600 hover:text-slate-900"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-fade-in">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications & Alerts</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-sky-600 hover:underline font-semibold">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No notifications.</div>
            ) : (
              notifications.map(n => (
                <div key={n._id} className={`p-3 text-xs transition-colors ${!n.read ? 'bg-sky-50/50 font-medium' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex-shrink-0">
                      {n.priority === 'urgent' ? <AlertTriangle className="h-4 w-4 text-rose-500" /> :
                       n.type === 'approval_request' ? <Clock className="h-4 w-4 text-amber-500" /> :
                       n.type === 'checkin' ? <UserCheck className="h-4 w-4 text-emerald-500" /> :
                       <Info className="h-4 w-4 text-sky-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{n.title}</div>
                      <div className="text-slate-600 mt-0.5 leading-relaxed">{n.body}</div>
                      <div className="text-[9px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleTimeString()}</div>

                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
