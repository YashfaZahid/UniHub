import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUnreadNotificationCount } from '../../api'
import { supabase } from '../supabaseClient'
import { NOTIFICATIONS_CHANGED } from '../utils/notificationEvents'
import './NotificationBell.css'

const POLL_MS = 20000

export default function NotificationBell() {
  const [hasUnread, setHasUnread] = useState(false)

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('user_id')) {
      setHasUnread(false)
      return
    }
    try {
      const count = await getUnreadNotificationCount()
      setHasUnread(count > 0)
    } catch {
      setHasUnread(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    const interval = setInterval(refresh, POLL_MS)
    window.addEventListener(NOTIFICATIONS_CHANGED, onChange)
    window.addEventListener('focus', onChange)

    const userId = localStorage.getItem('user_id')
    let channel
    if (userId) {
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => refresh()
        )
        .subscribe()
    }

    return () => {
      clearInterval(interval)
      window.removeEventListener(NOTIFICATIONS_CHANGED, onChange)
      window.removeEventListener('focus', onChange)
      if (channel) supabase.removeChannel(channel)
    }
  }, [refresh])

  return (
    <Link to="/notifications" className="notification-bell" aria-label="Notifications">
      <span className="notification-bell-icon" aria-hidden="true">
        🔔
      </span>
      {hasUnread && <span className="notification-dot" aria-label="Unread notifications" />}
    </Link>
  )
}
