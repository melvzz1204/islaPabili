import { useMemo } from 'react';
import type { AdminData } from '../lib/adminData';
import { profileById } from '../lib/adminData';
import { num } from '../lib/currency';
import { formatDateTime } from '../lib/format';
import { Empty } from './ui';

/** Read-only rider ↔ customer thread for the admin console. */
export function ConversationThread({ data, orderId, limit = 100 }: { data: AdminData; orderId: string; limit?: number }) {
  const messages = useMemo(
    () =>
      data.orderMessages
        .filter((m) => m.order_id === orderId)
        .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
        .slice(0, limit),
    [data.orderMessages, orderId, limit],
  );

  if (messages.length === 0) {
    return <Empty icon="message" title="No messages" body="No rider–customer chat on this order." />;
  }

  return (
    <div className="conv">
      {messages.map((m) => {
        const sender = profileById(data.profiles, m.sender_id);
        const isRider = sender?.role === 'rider';
        return (
          <div key={m.id} className={`conv-msg${isRider ? ' conv-rider' : ''}`}>
            <div className="conv-meta">
              <strong>{sender?.full_name || sender?.username || '—'}</strong>
              <span className={`conv-role ${isRider ? 'rider' : 'customer'}`}>{isRider ? 'Rider' : 'Customer'}</span>
              <small>{formatDateTime(m.created_at)}</small>
            </div>
            <p className="conv-body">{m.body}</p>
          </div>
        );
      })}
      <p className="muted">Showing {num(messages.length)} messages · read-only, newest last.</p>
    </div>
  );
}
