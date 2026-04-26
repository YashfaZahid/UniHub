import './ShopCard.css'

const PLACEHOLDER = 'https://placehold.co/400x240/e8e0f0/6c63ff?text=No+Image'

function StarRating({ rating }) {
  const stars = Math.round(rating ?? 0)
  return (
    <span className="star-rating" title={`${rating ?? 0} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < stars ? 'star filled' : 'star'}>★</span>
      ))}
      <span className="rating-num">{rating ? Number(rating).toFixed(1) : 'New'}</span>
    </span>
  )
}

export default function ShopCard({ shop }) {
  const owner = shop.profiles
  const coverImage = shop.cover_image ?? PLACEHOLDER

  return (
    <div className="shop-card">
      <div className="shop-card-img-wrap">
        <img
          src={coverImage}
          alt={shop.title}
          className="shop-card-img"
          onError={e => { e.target.src = PLACEHOLDER }}
        />
        {shop.category && (
          <span className="shop-category-badge">{shop.category}</span>
        )}
      </div>

      <div className="shop-card-body">
        <h3 className="shop-title">{shop.title}</h3>

        <div className="shop-owner">
          {owner?.profile_image ? (
            <img src={owner.profile_image} alt={owner.name} className="owner-avatar" />
          ) : (
            <div className="owner-avatar placeholder-avatar">
              {(owner?.name ?? 'U')[0].toUpperCase()}
            </div>
          )}
          <span className="owner-name">{owner?.name ?? 'Unknown'}</span>
        </div>

        <p className="shop-desc">
          {shop.description?.length > 90
            ? shop.description.slice(0, 90) + '…'
            : shop.description ?? 'No description provided.'}
        </p>

        <div className="shop-card-footer">
          <StarRating rating={shop.average_rating} />
          <button className="view-shop-btn">View Shop →</button>
        </div>
      </div>
    </div>
  )
}
