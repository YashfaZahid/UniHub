import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api'
import AppLayout from '../components/AppLayout'
import { notifyNotificationsChanged } from '../utils/notificationEvents'
import './NotificationsPage.css'

export default function NotificationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = () => {
    getNotifications()
      .then(setItems)
      .finally(() => {
        setLoading(false)
        notifyNotificationsChanged()
      })
  }

  useEffect(() => {
    load()
  }, [])

  const handleRead = async (n) => {
    if (!n.read) await markNotificationRead(n.id)
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
    )
    notifyNotificationsChanged()
    const data = n.data || {}
    const ref = n.reference_id || data.reference_id || data.order_id
    if (data.conversation_id) navigate(`/messages?conversation=${data.conversation_id}`)
    else if (ref) navigate(`/orders?highlight=${ref}`)
  }

  const handleReadAll = async () => {
    await markAllNotificationsRead()
    setItems((prev) => prev.map((x) => ({ ...x, read: true })))
    notifyNotificationsChanged()
  }

  return (
    <AppLayout>
      <div className="notifications-page">
        <div className="notifications-header">
          <h1>Notifications</h1>
          <button type="button" className="btn btn-secondary" onClick={handleReadAll}>
            Mark all read
          </button>
        </div>
        {loading && <p>Loading…</p>}
        {!loading && items.length === 0 && (
          <div className="notifications-empty">
            <p>No notifications yet</p>
          </div>
        )}
        <ul className="notifications-list">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={`notification-item ${n.read ? 'read' : 'unread'}`}
                onClick={() => handleRead(n)}
              >
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <time>{new Date(n.created_at).toLocaleString()}</time>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AppLayout>
  )
}
