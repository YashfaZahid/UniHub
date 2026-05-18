
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import ShopCard from '../components/ShopCard'
import './FeedPage.css'

const CATEGORIES = ['All', 'Art', 'Design', 'Photography', 'Writing', 'Music', 'Video', 'Tech']
const PAGE_SIZE = 9

export default function FeedPage() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const fetchShops = useCallback(async (reset = false) => {
    setLoading(true)
    const currentPage = reset ? 0 : page

    let query = supabase
      .from('shops')
      .select(`
        *,
        profiles ( name, profile_image )
      `, { count: 'exact' })

    if (search.trim()) {
      query = query.or(
        `title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`
      )
    }

    if (activeCategory !== 'All') {
      query = query.eq('category', activeCategory)
    }

    if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false })
    } else if (sortBy === 'top_rated') {
      query = query.order('average_rating', { ascending: false })
    }

    query = query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching shops:', error.message)
      setLoading(false)
      return
    }

    setTotalCount(count ?? 0)
    setHasMore((currentPage + 1) * PAGE_SIZE < (count ?? 0))

    if (reset) {
      setShops(data ?? [])
      setPage(0)
    } else {
      setShops(prev => currentPage === 0 ? (data ?? []) : [...prev, ...(data ?? [])])
    }

    setLoading(false)
  }, [search, activeCategory, sortBy, page])

  // Reset and refetch when filters change
  useEffect(() => {
    setPage(0)
    setShops([])
    fetchShops(true)
  }, [search, activeCategory, sortBy]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
  }

  // Fetch when page increments (load more)
  useEffect(() => {
    if (page > 0) fetchShops(false)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="feed-wrapper">
      {/* Header */}
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
              placeholder="Search shops, categories, keywords…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>
      </header>

      <main className="feed-main">
        {/* Filter bar */}
        <div className="filter-bar">
          <div className="category-pills">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`pill ${activeCategory === cat ? 'pill-active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <select
            className="sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="top_rated">Top Rated</option>
          </select>
        </div>

        {/* Results count */}
        {!loading && (
          <p className="results-count">
            {totalCount === 0
              ? 'No shops found'
              : `${totalCount} shop${totalCount !== 1 ? 's' : ''} found`}
          </p>
        )}

        {/* Grid */}
        {shops.length > 0 && (
          <div className="shop-grid">
            {shops.map(shop => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="shop-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shop-card skeleton">
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

        {/* Empty state */}
        {!loading && shops.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🛍️</span>
            <h3>No shops found</h3>
            <p>Try a different search or category</p>
          </div>
        )}

        {/* Load more */}
        {!loading && hasMore && (
          <div className="load-more-wrap">
            <button className="load-more-btn" onClick={loadMore}>
              Load More
            </button>
          </div>
        )}
      </main>
    </div>
  )
}


