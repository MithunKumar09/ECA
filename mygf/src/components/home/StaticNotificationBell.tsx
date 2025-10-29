// Static Notification Bell for HTML pages
// This component can be mounted independently into static HTML pages
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bell } from 'lucide-react';

// Simple notification state management (no context needed for static pages)
let notificationItems: any[] = [];
let unreadCount = 0;
let listeners: (() => void)[] = [];

function getUnreadCount() {
  return notificationItems.filter(it => !it.readAt).length;
}

function fetchNotifications() {
  fetch('/api/notifications/list?unreadOnly=true&limit=20', {
    credentials: 'include',
  })
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        notificationItems = data;
        unreadCount = getUnreadCount();
        listeners.forEach(fn => fn());
      }
    })
    .catch(err => console.error('Failed to fetch notifications:', err));
}

function markRead(id: string) {
  fetch(`/api/notifications/${id}/read`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(() => {
      notificationItems = notificationItems.map(it => 
        it._id === id ? { ...it, readAt: new Date().toISOString() } : it
      );
      unreadCount = getUnreadCount();
      listeners.forEach(fn => fn());
    })
    .catch(err => console.error('Failed to mark read:', err));
}

function dismissNotification(id: string) {
  fetch(`/api/notifications/${id}/dismiss`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(() => {
      notificationItems = notificationItems.filter(it => it._id !== id);
      unreadCount = getUnreadCount();
      listeners.forEach(fn => fn());
    })
    .catch(err => console.error('Failed to dismiss:', err));
}

export default function StaticNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const update = () => {
      setItems([...notificationItems]);
      setUnread(unreadCount);
    };

    listeners.push(update);
    update();
    fetchNotifications();

    // Poll for updates every minute
    const interval = setInterval(fetchNotifications, 60000);

    return () => {
      listeners = listeners.filter(l => l !== update);
      clearInterval(interval);
    };
  }, []);

  const handleClick = (id: string, item: any) => {
    markRead(id);
    if (item?.data?.courseId) {
      window.location.href = `/courses/${item.data.courseId}`;
    } else if (item?.type === 'certificate_available' && item?.data?.progressId) {
      window.location.href = `/courses/${item.data.courseId || ''}`;
    }
    setOpen(false);
  };

  return (
    <div className="notification-bell-wrapper">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative rounded-full border border-gray-300 bg-white p-3 shadow-md hover:bg-gray-50 active:bg-gray-100 transition-all"
        style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          zIndex: 9998,
          animation: unread > 0 ? 'pulse 2s infinite' : 'none',
        }}
        title="Notifications"
      >
        <Bell size={20} color="#333" />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              display: 'inline-flex',
              height: '20px',
              minWidth: '20px',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '10px',
              fontWeight: 'bold',
              padding: '0 4px',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9996,
            }}
            onClick={() => setOpen(false)}
          />
          <div
            className="notifications-dropdown"
            style={{
              position: 'fixed',
              bottom: '150px',
              right: '20px',
              width: '320px',
              maxWidth: 'calc(100vw - 40px)',
              maxHeight: '400px',
              borderRadius: '16px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              zIndex: 9999,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                overflowY: 'auto',
                padding: '8px',
              }}
            >
              {items.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                  No new reminders
                </div>
              ) : (
                items.map((it) => (
                  <div
                    key={it._id}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                          {it.title}
                        </div>
                        <div style={{ fontSize: '14px', color: '#4b5563', marginBottom: '8px' }}>
                          {it.body}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleClick(it._id, it)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              padding: '4px 8px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              background: 'white',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                          >
                            Open
                          </button>
                          <button
                            onClick={() => { dismissNotification(it._id); setOpen(false); }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              padding: '4px 8px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              background: 'white',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                      {!it.readAt && (
                        <span
                          style={{
                            marginTop: '2px',
                            height: '8px',
                            width: '8px',
                            borderRadius: '4px',
                            backgroundColor: '#3b82f6',
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

// Auto-mount function for static HTML pages
export function mountStaticNotificationBell(elementId: string = 'notification-bell-root') {
  let container = document.getElementById(elementId);
  if (!container) {
    container = document.createElement('div');
    container.id = elementId;
    document.body.appendChild(container);
  }

  const root = createRoot(container);
  root.render(<StaticNotificationBell />);

  return () => root.unmount();
}
