import { useNavigate } from 'react-router-dom'
import {
  getShopCoverUrl,
  getProfileImageUrl,
  handleImageError,
  SHOP_PLACEHOLDER,
  AVATAR_PLACEHOLDER,
} from '../utils/images'
import './shopCard.css'

export default function ShopCard({ shop }) {
  const navigate = useNavigate()
  const owner = shop.profiles
  const ownerId = shop.owner_id || owner?.id
  const coverImage = getShopCoverUrl(shop)
  const avatarUrl = getProfileImageUrl(owner)

  const goToProfile = (e) => {
    e.stopPropagation()
    if (ownerId) navigate(`/profile/${ownerId}`)
  }

  return (
    <div className="shop-card">
      <div className="shop-card-img-wrap" onClick={() => navigate(`/shop/${shop.id}`)} role="button" tabIndex={0}>
        <img
          src={coverImage}
          alt={shop.title}
          className="shop-card-img"
          loading="lazy"
          onError={(e) => handleImageError(e, SHOP_PLACEHOLDER)}
        />
      </div>

      <div className="shop-card-body">
        <h3 className="shop-title">{shop.title}</h3>

        <button type="button" className="shop-owner shop-owner-btn" onClick={goToProfile}>
          <img
            src={avatarUrl}
            alt={owner?.name ?? 'Owner'}
            className="owner-avatar avatar avatar-sm"
            onError={(e) => handleImageError(e, AVATAR_PLACEHOLDER)}
          />
          <span className="owner-name">{owner?.name ?? 'Unknown'}</span>
        </button>

        <p className="shop-desc">
          {shop.description?.length > 90
            ? shop.description.slice(0, 90) + '…'
            : shop.description ?? 'No description provided.'}
        </p>

        <div className="shop-card-footer">
          <button
            type="button"
            className="view-shop-btn"
            onClick={() => navigate(`/shop/${shop.id}`)}
          >
            View Shop →
          </button>
        </div>
      </div>
    </div>
  )
}
