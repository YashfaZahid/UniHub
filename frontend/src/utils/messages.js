/** Text from API message row (`content` is canonical; `body` is legacy alias). */
export function getMessageText(message) {
  if (!message) return ''
  return (message.content || message.body || '').trim()
}
