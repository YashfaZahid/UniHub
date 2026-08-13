import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getShopInsights, formatApiError } from '../../api'
import AppLayout from '../components/AppLayout'
import './ShopInsightsPage.css'

const STATUS_META = {
  pending: { label: 'Pending', color: '#c4a35a', emoji: '⏳' },
  accepted: { label: 'Accepted', color: '#5a8f62', emoji: '✅' },
  preparing: { label: 'Preparing', color: '#8b6bb5', emoji: '🧺' },
  shipped: { label: 'Shipped', color: '#4a7c9b', emoji: '📦' },
  completed: { label: 'Completed', color: '#7b1e3a', emoji: '🎉' },
  rejected: { label: 'Rejected', color: '#a84a5a', emoji: '✕' },
  cancelled: { label: 'Cancelled', color: '#9a8f82', emoji: '—' },
}

function money(value) {
  const n = Number(value || 0)
  return `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function DonutChart({ slices }) {
  const size = 196
  const thickness = 26
  const radius = (size - thickness) / 2
  const cx = size / 2
  const circ = 2 * Math.PI * radius
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  let offset = 0

  if (!total) {
    return (
      <svg className="insights-donut" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={cx} cy={cx} r={radius} fill="none" stroke="#efe8dc" strokeWidth={thickness} />
        <text x={cx} y={cx - 4} textAnchor="middle" className="donut-center-value">0</text>
        <text x={cx} y={cx + 16} textAnchor="middle" className="donut-center-label">orders</text>
      </svg>
    )
  }

  return (
    <svg className="insights-donut" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Order status breakdown">
      <circle cx={cx} cy={cx} r={radius} fill="none" stroke="#f5efe6" strokeWidth={thickness} />
      {slices.map((slice) => {
        const len = (slice.value / total) * circ
        const dash = `${len} ${circ - len}`
        const el = (
          <circle
            key={slice.key}
            cx={cx}
            cy={cx}
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={thickness}
            strokeDasharray={dash}
            strokeDashoffset={-offset}
            strokeLinecap={slices.length === 1 ? 'round' : 'butt'}
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        )
        offset += len
        return el
      })}
      <text x={cx} y={cx - 4} textAnchor="middle" className="donut-center-value">{total}</text>
      <text x={cx} y={cx + 16} textAnchor="middle" className="donut-center-label">orders</text>
    </svg>
  )
}

function SalesChart({ points }) {
  const width = 560
  const height = 180
  const pad = { top: 16, right: 12, bottom: 28, left: 8 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  if (!points.length) return null
  const maxRev = Math.max(...points.map((p) => p.revenue), 1)
  const maxOrd = Math.max(...points.map((p) => p.orders), 1)
  const n = Math.max(points.length - 1, 1)

  const coords = points.map((p, i) => {
    const x = pad.left + (i / n) * innerW
    const y = pad.top + innerH - (p.revenue / maxRev) * innerH
    return { x, y, ...p }
  })

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const area = `${line} L ${coords.at(-1)?.x ?? pad.left} ${pad.top + innerH} L ${pad.left} ${pad.top + innerH} Z`
  const barW = Math.max(innerW / points.length - 4, 4)

  return (
    <svg className="insights-sales-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales over time">
      <defs>
        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7b1e3a" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7b1e3a" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {coords.map((c) => {
        const h = Math.max((c.orders / maxOrd) * innerH * 0.45, c.orders ? 6 : 0)
        return (
          <rect
            key={`bar-${c.date}`}
            x={c.x - barW / 2}
            y={pad.top + innerH - h}
            width={barW}
            height={h}
            rx="4"
            fill="#e8dccb"
          />
        )
      })}
      <path d={area} fill="url(#salesFill)" />
      <path d={line} fill="none" stroke="#7b1e3a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.filter((_, i) => i === 0 || i === coords.length - 1 || i === Math.floor(coords.length / 2)).map((c) => (
        <g key={`label-${c.date}`}>
          <circle cx={c.x} cy={c.y} r="4" fill="#fff" stroke="#7b1e3a" strokeWidth="2" />
          <text x={c.x} y={height - 8} textAnchor="middle" className="sales-axis-label">
            {new Date(`${c.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function ShopInsightsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState(14)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const insights = await getShopInsights(id)
        if (!cancelled) setData(insights)
      } catch (err) {
        if (cancelled) return
        if (err.response?.status === 401) {
          navigate('/login')
          return
        }
        if (err.response?.status === 403) {
          navigate(`/shop/${id}`)
          return
        }
        setError(formatApiError(err, 'Unable to load shop insights'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, navigate])

  const summary = data?.summary
  const slices = useMemo(() => (
    (data?.status_breakdown || []).map((row) => ({
      key: row.status,
      value: row.count,
      color: STATUS_META[row.status]?.color || '#c4a35a',
      label: STATUS_META[row.status]?.label || row.status,
    }))
  ), [data])

  const chartPoints = useMemo(() => {
    const days = data?.sales_by_day || []
    return days.slice(-range)
  }, [data, range])

  const maxUnits = Math.max(...(data?.top_products || []).map((p) => p.units), 1)

  return (
    <AppLayout>
      <div className="insights-page">
        <header className="insights-header">
          <button type="button" className="btn btn-ghost shop-page-back" onClick={() => navigate(`/shop/${id}`)}>
            ← Back to shop
          </button>
          <div className="insights-title-block">
            <p className="insights-kicker">Shop insights</p>
            <h1>{data?.shop?.title || 'Your shop'}</h1>
            <p className="insights-subtitle">A cozy look at sales, bestsellers, and how orders are flowing.</p>
          </div>
        </header>

        {loading && (
          <div className="insights-loading">
            <div className="insights-sparkle" aria-hidden="true">✦</div>
            <p>Gathering your shop stats…</p>
          </div>
        )}

        {error && (
          <p className="alert alert-error insights-error" role="alert">{error}</p>
        )}

        {!loading && data && (
          <>
            <section className="insights-kpis" aria-label="Summary">
              <article className="kpi-card kpi-revenue">
                <span className="kpi-emoji" aria-hidden="true">💰</span>
                <p className="kpi-label">Completed sales</p>
                <p className="kpi-value">{money(summary.revenue)}</p>
                <p className="kpi-hint">{summary.completed_orders} finished order{summary.completed_orders === 1 ? '' : 's'}</p>
              </article>
              <article className="kpi-card kpi-orders">
                <span className="kpi-emoji" aria-hidden="true">🛍️</span>
                <p className="kpi-label">Total orders</p>
                <p className="kpi-value">{summary.total_orders}</p>
                <p className="kpi-hint">{summary.pending_orders} waiting for you</p>
              </article>
              <article className="kpi-card kpi-units">
                <span className="kpi-emoji" aria-hidden="true">🧁</span>
                <p className="kpi-label">Items ordered</p>
                <p className="kpi-value">{summary.units_sold}</p>
                <p className="kpi-hint">Across {summary.listed_products} listed product{summary.listed_products === 1 ? '' : 's'}</p>
              </article>
              <article className="kpi-card kpi-aov">
                <span className="kpi-emoji" aria-hidden="true">✨</span>
                <p className="kpi-label">Avg. completed order</p>
                <p className="kpi-value">{money(summary.average_order_value)}</p>
                <p className="kpi-hint">{summary.completion_rate}% completion rate</p>
              </article>
            </section>

            {summary.pipeline_value > 0 && (
              <p className="insights-pipeline">
                <span aria-hidden="true">🚚</span>
                {money(summary.pipeline_value)} is currently in progress (accepted, preparing, or shipped).
              </p>
            )}

            <div className="insights-grid">
              <section className="insights-card insights-chart-card">
                <div className="insights-card-head">
                  <div>
                    <h2>Sales over time</h2>
                    <p>Bars are order volume. The line is sales value.</p>
                  </div>
                  <div className="range-pills" role="group" aria-label="Date range">
                    {[7, 14, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={range === days ? 'active' : ''}
                        onClick={() => setRange(days)}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>
                {chartPoints.every((p) => p.orders === 0 && p.revenue === 0) ? (
                  <div className="insights-empty-chart">
                    <span aria-hidden="true">🌱</span>
                    <p>No sales in this window yet. Your next order will start the chart!</p>
                  </div>
                ) : (
                  <SalesChart points={chartPoints} />
                )}
              </section>

              <section className="insights-card insights-donut-card">
                <h2>Order mix</h2>
                <p>Where every order currently sits.</p>
                <div className="donut-wrap">
                  <DonutChart slices={slices} />
                  <ul className="donut-legend">
                    {(data.status_breakdown || []).map((row) => {
                      const meta = STATUS_META[row.status] || { label: row.status, emoji: '•', color: '#c4a35a' }
                      return (
                        <li key={row.status}>
                          <span className="legend-dot" style={{ background: meta.color }} />
                          <span>{meta.emoji} {meta.label}</span>
                          <strong>{row.count}</strong>
                        </li>
                      )
                    })}
                    {!data.status_breakdown?.length && <li className="text-muted">No orders yet</li>}
                  </ul>
                </div>
              </section>
            </div>

            <section className="insights-card insights-top-card">
              <div className="insights-card-head">
                <div>
                  <h2>Top selling products</h2>
                  <p>Ranked by items sold (cancelled and rejected orders are left out).</p>
                </div>
              </div>
              {(data.top_products || []).length === 0 ? (
                <div className="insights-empty-chart">
                  <span aria-hidden="true">🎀</span>
                  <p>No bestsellers yet. Once customers order, stars will show up here.</p>
                </div>
              ) : (
                <ol className="top-products-list">
                  {data.top_products.map((product, index) => (
                    <li key={product.product_id || product.title}>
                      <div className="top-rank" aria-hidden="true">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}</div>
                      <div className="top-body">
                        <div className="top-row">
                          {product.product_id ? (
                            <Link to={`/product/${product.product_id}`}>{product.title}</Link>
                          ) : (
                            <span>{product.title}</span>
                          )}
                          <span className="top-meta">{product.units} sold · {money(product.revenue)}</span>
                        </div>
                        <div className="top-bar-track">
                          <div
                            className="top-bar-fill"
                            style={{ '--bar': `${Math.max((product.units / maxUnits) * 100, 8)}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {(data.waiting_products || []).length > 0 && (
              <section className="insights-card insights-waiting-card">
                <h2>Still waiting for their moment</h2>
                <p>These listings have not sold yet — a little spotlight might help.</p>
                <div className="waiting-chips">
                  {data.waiting_products.map((product) => (
                    <Link key={product.product_id} to={`/product/${product.product_id}`} className="waiting-chip">
                      {product.title}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <p className="insights-footnote">
              Need to act on an order? Head to <Link to="/orders">Sales</Link> on the Orders page.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  )
}
