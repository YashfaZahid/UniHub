import { useEffect, useState, useRef } from 'react'

import { useParams, useNavigate, Link } from 'react-router-dom'

import { getProduct, startConversation, createOrder } from '../../api'

import AppLayout from '../components/AppLayout'

import { notifyNotificationsChanged } from '../utils/notificationEvents'

import ProductGallery from '../components/ProductGallery'

import './ProductPage.css'



export default function ProductPage() {

  const { id } = useParams()

  const navigate = useNavigate()

  const [product, setProduct] = useState(null)

  const [loading, setLoading] = useState(true)

  const [notes, setNotes] = useState('')

  const [orderLoading, setOrderLoading] = useState(false)

  const [messageLoading, setMessageLoading] = useState(false)

  const [successMessage, setSuccessMessage] = useState('')

  const [errorMessage, setErrorMessage] = useState('')

  const orderInFlight = useRef(false)



  const userId = localStorage.getItem('user_id')



  useEffect(() => {

    setLoading(true)

    setErrorMessage('')

    getProduct(id)

      .then(setProduct)

      .catch(() => setErrorMessage('Unable to load product.'))

      .finally(() => setLoading(false))

  }, [id])



  const shop = product?.shops

  const shopId = product?.shop_id || shop?.id

  const ownerId = shop?.owner_id

  const isOwner = Boolean(ownerId && userId && String(userId) === String(ownerId))

  const showMarketplaceActions = product && !isOwner



  const requireAuth = (actionLabel = 'continue') => {

    if (!userId) {

      setErrorMessage(`Please log in to ${actionLabel}.`)

      navigate('/login')

      return false

    }

    return true

  }



  const handleMessage = async () => {

    setErrorMessage('')

    setSuccessMessage('')

    if (!requireAuth('message the seller')) return



    setMessageLoading(true)

    try {

      const conv = await startConversation({

        product_id: id,

        shop_id: shopId,

      })

      if (!conv?.id) {

        throw new Error('No conversation returned')

      }

      navigate(`/messages?conversation=${conv.id}`)

    } catch (err) {

      const msg =

        err.response?.data?.error ||

        err.message ||

        'Unable to start conversation. Please try again.'

      setErrorMessage(msg)

      if (err.response?.status === 401) {

        navigate('/login')

      }

    } finally {

      setMessageLoading(false)

    }

  }



  const handleOrder = async () => {

    setErrorMessage('')

    setSuccessMessage('')

    if (!requireAuth('place an order')) return

    if (orderInFlight.current) return



    orderInFlight.current = true

    setOrderLoading(true)

    try {

      const order = await createOrder({

        product_id: id,

        notes,

        quantity: 1,

      })

      if (!order?.id) {

        throw new Error('Order was not created')

      }

      setSuccessMessage('Order placed successfully.')

      notifyNotificationsChanged()

      setTimeout(() => {

        navigate('/orders', { state: { highlightOrderId: order.id } })

      }, 800)

    } catch (err) {

      if (err.response?.status === 401) {

        setErrorMessage('Please log in before placing an order.')

        navigate('/login')

      } else {

        setErrorMessage(

          err.response?.data?.error || 'Unable to create order. Please try again.'

        )

      }

    } finally {

      setOrderLoading(false)

      orderInFlight.current = false

    }

  }



  if (loading) {

    return (

      <AppLayout>

        <div className="product-page">

          <p className="text-muted">Loading product…</p>

        </div>

      </AppLayout>

    )

  }



  if (!product) {

    return (

      <AppLayout>

        <div className="product-page product-page-error">

          <p>{errorMessage || 'Product not found.'}</p>

        </div>

      </AppLayout>

    )

  }



  return (

    <AppLayout>

      <div className="product-page">

        <button type="button" className="btn btn-ghost back-btn" onClick={() => navigate(-1)}>

          ← Back

        </button>



        {successMessage && (

          <p className="alert alert-success product-feedback" role="status">

            {successMessage}

          </p>

        )}

        {errorMessage && (

          <p className="alert alert-error product-feedback" role="alert">

            {errorMessage}

          </p>

        )}



        <div className="product-page-grid">

          <ProductGallery images={product.product_images} />

          <div className="product-page-info">

            <h1>{product.title}</h1>

            {product.price_or_range && (

              <p className="product-price-lg">{product.price_or_range}</p>

            )}

            <p>{product.description || 'No description.'}</p>

            {shop && (

              <Link to={`/shop/${shop.id}`} className="product-shop-link">

                View shop: {shop.title}

              </Link>

            )}



            {showMarketplaceActions && (

              <div className="product-page-actions marketplace-actions">

                <button

                  type="button"

                  className="marketplace-btn"

                  onClick={handleMessage}

                  disabled={messageLoading || orderLoading}

                >

                  {messageLoading ? 'Opening chat…' : 'Message Seller'}

                </button>

                <textarea

                  className="textarea product-notes"

                  placeholder="Order notes (optional)"

                  value={notes}

                  onChange={(e) => setNotes(e.target.value)}

                  rows={2}

                  disabled={orderLoading}

                />

                <button

                  type="button"

                  className="marketplace-btn"

                  onClick={handleOrder}

                  disabled={orderLoading || messageLoading}

                >

                  {orderLoading ? 'Placing order…' : 'Place Order'}

                </button>

              </div>

            )}



            {isOwner && (

              <p className="text-muted product-owner-note">

                This is your listing. Buyers will see Message Seller and Place Order here.

              </p>

            )}

          </div>

        </div>

      </div>

    </AppLayout>

  )

}

