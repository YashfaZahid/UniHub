export const NOTIFICATIONS_CHANGED = 'unihub:notifications-changed'

export function notifyNotificationsChanged() {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED))
}
