import { useEffect, useState, useRef, useCallback } from 'react'

import { useSearchParams, useNavigate } from 'react-router-dom'

import { supabase } from '../supabaseClient'

import {

  getConversations,

  getMessages,

  sendMessage,

  markConversationRead,

} from '../../api'

import { getMessageText } from '../utils/messages'

import { getProfileImageUrl, handleImageError, AVATAR_PLACEHOLDER } from '../utils/images'

import AppLayout from '../components/AppLayout'

import { notifyNotificationsChanged } from '../utils/notificationEvents'

import './MessagesPage.css'



function formatTime(iso) {

  if (!iso) return ''

  return new Date(iso).toLocaleString(undefined, {

    month: 'short',

    day: 'numeric',

    hour: '2-digit',

    minute: '2-digit',

  })

}



export default function MessagesPage() {

  const [searchParams, setSearchParams] = useSearchParams()

  const navigate = useNavigate()

  const conversationParam = searchParams.get('conversation')



  const [conversations, setConversations] = useState([])

  const [activeId, setActiveId] = useState(conversationParam)

  const [messages, setMessages] = useState([])

  const [draft, setDraft] = useState('')

  const [loading, setLoading] = useState(true)

  const [sending, setSending] = useState(false)

  const [sendError, setSendError] = useState('')

  const bottomRef = useRef(null)

  const inputRef = useRef(null)

  const userId = localStorage.getItem('user_id')



  const selectConversation = useCallback(

    (id) => {

      setActiveId(id)

      setSendError('')

      if (id) {

        setSearchParams({ conversation: id })

      } else {

        setSearchParams({})

      }

    },

    [setSearchParams]

  )



  useEffect(() => {

    if (conversationParam) {

      setActiveId(conversationParam)

    }

  }, [conversationParam])



  const loadConversations = useCallback(() => {

    return getConversations().then((rows) => {

      setConversations(rows || [])

      return rows

    })

  }, [])



  useEffect(() => {

    if (!userId) {

      setLoading(false)

      navigate('/login')

      return

    }

    loadConversations().finally(() => setLoading(false))

  }, [userId, navigate, loadConversations])



  useEffect(() => {

    if (!activeId) {

      setMessages([])

      return

    }

    setSendError('')

    getMessages(activeId)

      .then(setMessages)

      .catch(() => setSendError('Unable to load messages.'))

    markConversationRead(activeId)

      .then(() => loadConversations())

      .catch(() => {})

  }, [activeId, loadConversations])



  useEffect(() => {

    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  }, [messages])



  useEffect(() => {

    if (!activeId) return

    const channel = supabase

      .channel(`messages:${activeId}`)

      .on(

        'postgres_changes',

        {

          event: 'INSERT',

          schema: 'public',

          table: 'messages',

          filter: `conversation_id=eq.${activeId}`,

        },

        (payload) => {

          const row = payload.new

          const normalized = {

            ...row,

            content: row.content || row.body || '',

            body: row.content || row.body || '',

          }

          setMessages((prev) => {

            if (prev.some((m) => m.id === normalized.id)) return prev

            return [...prev, normalized]

          })

          loadConversations()

        }

      )

      .subscribe()

    return () => {

      supabase.removeChannel(channel)

    }

  }, [activeId, loadConversations])



  const sendCurrentMessage = async () => {

    const text = draft.trim()

    if (!text || !activeId || sending) return



    if (!userId) {

      navigate('/login')

      return

    }



    setSending(true)

    setSendError('')

    try {

      const msg = await sendMessage(activeId, text)

      setMessages((prev) => {

        if (prev.some((m) => m.id === msg.id)) return prev

        return [...prev, msg]

      })

      setDraft('')

      inputRef.current?.focus()

      await loadConversations()

      notifyNotificationsChanged()

    } catch (err) {

      const msg =

        err.response?.data?.error ||

        'Unable to send message. Please try again.'

      setSendError(msg)

      if (err.response?.status === 401) {

        navigate('/login')

      }

    } finally {

      setSending(false)

    }

  }



  const handleSubmit = (e) => {

    e.preventDefault()

    sendCurrentMessage()

  }



  const handleKeyDown = (e) => {

    if (e.key === 'Enter' && !e.shiftKey) {

      e.preventDefault()

      sendCurrentMessage()

    }

  }



  const activeConv = conversations.find((c) => c.id === activeId)

  const activeName = activeConv?.other_user?.name ?? 'Chat'



  return (

    <AppLayout>

      <div className="messages-page">

        <aside className="conversations-list">

          <h2>Messages</h2>

          {loading && <p className="text-muted">Loading…</p>}

          {!loading && conversations.length === 0 && (

            <p className="text-muted">No conversations yet</p>

          )}

          {conversations.map((c) => {

            const other = c.other_user

            const hasUnread = (c.unread_count ?? 0) > 0

            return (

              <button

                key={c.id}

                type="button"

                className={`conv-item ${c.id === activeId ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}

                onClick={() => selectConversation(c.id)}

              >

                <img

                  src={getProfileImageUrl(other)}

                  alt=""

                  className="conv-avatar avatar avatar-md"

                  onError={(e) => handleImageError(e, AVATAR_PLACEHOLDER)}

                />

                <span className="conv-user-name">{other?.name ?? 'User'}</span>

                {hasUnread && (

                  <span className="conv-unread-dot" aria-label="Unread messages" />

                )}

              </button>

            )

          })}

        </aside>



        <section className="chat-window">

          {!activeId ? (

            <p className="chat-placeholder">Select a conversation</p>

          ) : (

            <>

              <header className="chat-header">

                <img

                  src={getProfileImageUrl(activeConv?.other_user)}

                  alt=""

                  className="chat-header-avatar avatar avatar-sm"

                  onError={(e) => handleImageError(e, AVATAR_PLACEHOLDER)}

                />

                <span>{activeName}</span>

              </header>

              {sendError && (

                <p className="chat-error alert alert-error" role="alert">

                  {sendError}

                </p>

              )}

              <div className="chat-messages">

                {messages.map((m, i) => {

                  const isMine = String(m.sender_id) === String(userId)

                  const prev = messages[i - 1]

                  const sameSender = prev && prev.sender_id === m.sender_id

                  return (

                    <div

                      key={m.id}

                      className={`chat-bubble ${isMine ? 'mine' : 'theirs'} ${sameSender ? 'grouped' : ''}`}

                    >

                      <p>{getMessageText(m)}</p>

                      <time>{formatTime(m.created_at)}</time>

                    </div>

                  )

                })}

                <div ref={bottomRef} />

              </div>

              <form className="chat-input" onSubmit={handleSubmit}>

                <textarea

                  ref={inputRef}

                  className="textarea chat-textarea"

                  value={draft}

                  onChange={(e) => setDraft(e.target.value)}

                  onKeyDown={handleKeyDown}

                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"

                  rows={2}

                  disabled={sending}

                  aria-label="Message"

                />

                <button

                  type="submit"

                  className="marketplace-btn chat-send-btn"

                  disabled={sending || !draft.trim()}

                >

                  {sending ? 'Sending…' : 'Send'}

                </button>

              </form>

            </>

          )}

        </section>

      </div>

    </AppLayout>

  )

}

