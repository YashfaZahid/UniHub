import { useNavigate } from 'react-router-dom'
import { getPrimaryProductImageUrl, handleImageError, PRODUCT_PLACEHOLDER } from '../utils/images'
import './ProductCard.css'

export default function ProductCard({ product, isOwner, onDelete }) {
  const navigate = useNavigate()
  const img = getPrimaryProductImageUrl(product)

  return (
    <article className="product-card-v2" onClick={() => navigate(`/product/${product.id}`)}>
      <img
        src={img}
        alt={product.title}
        className="product-card-img"
        loading="lazy"
        onError={(e) => handleImageError(e, PRODUCT_PLACEHOLDER)}
      />
      <div className="product-card-body">
        <h3>{product.title}</h3>
        <p className="product-desc">{product.description || 'No description.'}</p>
        {product.price_or_range && <p className="product-price">{product.price_or_range}</p>}
        {isOwner && onDelete && (
          <div className="product-card-actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="product-delete-btn btn btn-danger" onClick={onDelete}>
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
