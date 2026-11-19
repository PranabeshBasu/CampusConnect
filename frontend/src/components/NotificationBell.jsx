import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.js';
import { formatDateTime } from '../lib/format.js';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unreadCount: 0, items: [] });
  const ref = useRef(null);

  const load = useCallback(() => {
    listNotifications()
      .then((res) => setData(res || { unreadCount: 0, items: [] }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function handleClickItem(item) {
    if (!item.read) {
      await markNotificationRead(item.id).catch(() => {});
      load();
    }
    setOpen(false);
    if (item.link) navigate(item.link);
  }

  async function handleMarkAll() {
    await markAllNotificationsRead().catch(() => {});
    load();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn-ghost relative p-2"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => {
          if (!open) load();
          setOpen((v) => !v);
        }}
      >
        <Bell size={16} aria-hidden="true" />
        {data.unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pri px-1 text-[10px] font-bold text-onpri">
            {data.unreadCount > 9 ? '9+' : data.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-line bg-surf p-3 shadow-2xl">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="text-sm font-bold text-ink">Notifications</span>
            {data.unreadCount > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-pri hover:underline"
                onClick={handleMarkAll}
              >
                <CheckCheck size={13} aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>

          {data.items.length === 0 ? (
            <p className="py-6 text-center text-xs text-mute">No notifications yet.</p>
          ) : (
            <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClickItem(n)}
                    className={`w-full rounded-lg px-2 py-2.5 text-left transition hover:bg-bg ${
                      n.read ? 'opacity-70' : 'font-medium'
                    }`}
                  >
                    <p className="text-xs font-bold text-ink">{n.title}</p>
                    <p className="mt-0.5 text-xs text-mute">{n.message}</p>
                    <p className="mt-1 text-[10px] text-mute">{formatDateTime(n.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}