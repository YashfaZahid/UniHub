import { useCallback, useEffect, useState } from 'react'

import { Link } from 'react-router-dom'

import { getOrders, updateOrderStatus, formatApiError } from '../../api'

import { notifyNotificationsChanged } from '../utils/notificationEvents'

import AppLayout from '../components/AppLayout'

import './OrdersPage.css'



const BADGE_CLASS = {

  pending: 'status-pending',

  accepted: 'status-accepted',

  rejected: 'status-rejected',

  preparing: 'status-preparing',

  shipped: 'status-shipped',

  completed: 'status-completed',

  cancelled: 'status-cancelled',

}



const SELLER_ACTIONS = {

  pending: [

    { status: 'accepted', label: 'Accept' },

    { status: 'rejected', label: 'Reject' },

  ],

  accepted: [{ status: 'preparing', label: 'Mark preparing' }],

  preparing: [{ status: 'shipped', label: 'Mark shipped' }],

  shipped: [{ status: 'completed', label: 'Mark completed' }],

}



function dedupeOrders(rows) {

  const seen = new Set()

  return (rows || []).filter((order) => {

    if (!order?.id || seen.has(order.id)) return false

    seen.add(order.id)

    return true

  })

}



function OrderCard({ order, role, onStatus, updatingId }) {

  const busy = updatingId === order.id

  return (

    <li className="order-card">

      <div className="order-card-head">

        <span className={`status-badge ${BADGE_CLASS[order.status] ?? ''}`}>

          {order.status}

        </span>

        <time>{new Date(order.created_at).toLocaleDateString()}</time>

      </div>

      <p>

        <strong>{order.products?.title ?? 'Product'}</strong>

      </p>

      <p className="order-meta">

        Unit: {order.unit_price != null ? `Rs. ${Number(order.unit_price).toFixed(2)}` : '—'}
        {' · '}
        Qty: {order.quantity ?? 1}
        {' · '}
        Total: {order.total_price != null ? `Rs. ${Number(order.total_price).toFixed(2)}` : '—'}

      </p>

      {order.notes && <p className="order-notes">Notes: {order.notes}</p>}

      {order.product_id && (

        <Link to={`/product/${order.product_id}`}>View product</Link>

      )}

      <div className="order-actions">

        {role === 'buyer' && order.status === 'pending' && (

          <button

            type="button"

            disabled={busy}

            onClick={() => onStatus(order.id, 'cancelled')}

          >

            Cancel order

          </button>

        )}

        {role === 'seller' &&

          (SELLER_ACTIONS[order.status] ?? []).map((a) => (

            <button

              key={a.status}

              type="button"

              disabled={busy}

              onClick={() => onStatus(order.id, a.status)}

            >

              {busy ? 'Updating…' : a.label}

            </button>

          ))}

      </div>

    </li>

  )

}



export default function OrdersPage() {

  const [role, setRole] = useState('buyer')

  const [orders, setOrders] = useState([])

  const [loading, setLoading] = useState(true)

  const [updatingId, setUpdatingId] = useState(null)

  const [actionError, setActionError] = useState('')



  const load = useCallback(() => {

    setLoading(true)

    setActionError('')

    return getOrders(role)

      .then((rows) => setOrders(dedupeOrders(rows)))

      .catch((err) => {

        setActionError(err.response?.data?.error || 'Unable to load orders.')

      })

      .finally(() => setLoading(false))

  }, [role])



  useEffect(() => {

    load()

  }, [load])



  const handleStatus = async (orderId, status) => {
    if (!orderId) {
      setActionError('Invalid order id')
      return
    }

    setActionError('')
    setUpdatingId(orderId)
    const previous = orders
    setOrders((prev) =>
      dedupeOrders(
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      )
    )

    try {
      console.log('[ORDER STATUS] UI click', { orderId, status })
      const updated = await updateOrderStatus(orderId, status)
      console.log('[ORDER STATUS] UI success', updated)

      if (updated?.id) {
        setOrders((prev) =>
          dedupeOrders(
            prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o))
          )
        )
      } else {
        await load()
      }

      notifyNotificationsChanged()
    } catch (err) {
      setOrders(previous)
      setActionError(formatApiError(err, 'Unable to update order status'))
    } finally {
      setUpdatingId(null)
    }
  }



  const pendingOrders =

    role === 'seller' ? orders.filter((o) => o.status === 'pending') : []

  const otherOrders =

    role === 'seller'

      ? orders.filter((o) => o.status !== 'pending')

      : orders



  const renderList = (list) => (

    <ul className="orders-list">

      {list.map((order) => (

        <OrderCard

          key={order.id}

          order={order}

          role={role}

          onStatus={handleStatus}

          updatingId={updatingId}

        />

      ))}

    </ul>

  )



  return (

    <AppLayout>

      <div className="orders-page">

        <h1>Orders</h1>

        <div className="orders-tabs">

          <button

            type="button"

            className={role === 'buyer' ? 'active' : ''}

            onClick={() => setRole('buyer')}

          >

            My purchases

          </button>

          <button

            type="button"

            className={role === 'seller' ? 'active' : ''}

            onClick={() => setRole('seller')}

          >

            Sales

          </button>

        </div>



        {actionError && (

          <p className="orders-error alert alert-error" role="alert">

            {actionError}

          </p>

        )}



        {loading && <p>Loading orders…</p>}



        {!loading && orders.length === 0 && (

          <div className="orders-empty">

            <p>No orders yet</p>

          </div>

        )}



        {!loading && role === 'seller' && orders.length > 0 && (

          <>

            <section className="orders-section">

              <h2 className="orders-section-title">Pending orders</h2>

              {pendingOrders.length === 0 ? (

                <p className="orders-section-empty text-muted">No pending orders</p>

              ) : (

                renderList(pendingOrders)

              )}

            </section>

            <section className="orders-section">

              <h2 className="orders-section-title">Other orders</h2>

              {otherOrders.length === 0 ? (

                <p className="orders-section-empty text-muted">No other orders</p>

              ) : (

                renderList(otherOrders)

              )}

            </section>

          </>

        )}



        {!loading && role === 'buyer' && orders.length > 0 && renderList(orders)}

      </div>

    </AppLayout>

  )

}

