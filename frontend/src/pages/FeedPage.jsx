import { useEffect, useState, useCallback, useRef } from 'react'
import { fetchFeed } from '../../api'
import ShopCard from '../components/ShopCard'
import AppLayout from '../components/AppLayout'
import './FeedPage.css'

const PAGE_SIZE = 9

export default function FeedPage() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const loadMoreRef = useRef(null)

  const loadShops = useCallback(async (pageNum, reset) => {
    if (reset) setLoading(true)
    else setLoadingMore(true)

    try {
      const data = await fetchFeed({
        search,
        sort: sortBy,
        page: pageNum,
        pageSize: PAGE_SIZE,
      })
      setTotalCount(data.total ?? 0)
      setHasMore(data.has_more ?? false)
      setShops((prev) => (reset ? data.shops ?? [] : [...prev, ...(data.shops ?? [])]))
      setPage(pageNum)
    } catch (err) {
      console.error('Feed error:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [search, sortBy])

  useEffect(() => {
    loadShops(0, true)
  }, [loadShops])

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadShops(page + 1, false)
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, page, loadShops])

  const handleShare = async (shop) => {
    const url = `${window.location.origin}/shop/${shop.id}`
    if (navigator.share) {
      await navigator.share({ title: shop.title, url })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied to clipboard')
    }
  }

  return (
    <AppLayout>
      <div className="feed-wrapper">
        <header className="feed-header">
          <div className="feed-header-inner">
            <div className="feed-logo">
              <span className="logo-icon">✦</span>
              <span className="logo-text">UniHub</span>
            </div>
            <div className="feed-search-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="feed-search"
                placeholder="Search shops and keywords…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="search-clear" onClick={() => setSearch('')}>✕</button>
              )}
            </div>
          </div>
        </header>

        <main className="feed-main">
          <div className="filter-bar">
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
            </select>
          </div>

          {!loading && (
            <p className="results-count">
              {totalCount === 0
                ? 'No shops found'
                : `${totalCount} shop${totalCount !== 1 ? 's' : ''} found`}
            </p>
          )}

          {shops.length > 0 && (
            <div className="shop-grid">
              {shops.map((shop) => (
                <div key={shop.id} className="feed-card-wrap">
                  <ShopCard shop={shop} />
                  <button type="button" className="share-btn" onClick={() => handleShare(shop)}>
                    Share
                  </button>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="shop-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="feed-skeleton-card">
                  <div className="skeleton-img" />
                  <div className="skeleton-body">
                    <div className="skeleton-line wide" />
                    <div className="skeleton-line medium" />
                    <div className="skeleton-line narrow" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && shops.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">🛍️</span>
              <h3>No shops found</h3>
              <p>Try a different search</p>
            </div>
          )}

          {loadingMore && <p className="loading-more">Loading more…</p>}
          <div ref={loadMoreRef} className="infinite-sentinel" aria-hidden="true" />
        </main>
      </div>
    </AppLayout>
  )
}
