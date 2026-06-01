import { useState } from 'react'
import { getPrimaryProductImageUrl, resolveImageUrl, PRODUCT_PLACEHOLDER, handleImageError } from '../utils/images'
import './ProductGallery.css'

export default function ProductGallery({ images = [] }) {
  const sorted = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const primary = sorted.find((i) => i.is_primary) ?? sorted[0]
  const [active, setActive] = useState(primary?.id ?? 0)

  const activeImg = sorted.find((i) => i.id === active) ?? primary
  const mainSrc = resolveImageUrl(activeImg?.image_url) ?? getPrimaryProductImageUrl({ product_images: images })

  if (!sorted.length) {
    return (
      <img src={PRODUCT_PLACEHOLDER} alt="No product images" className="gallery-main" />
    )
  }

  return (
    <div className="product-gallery">
      <img
        src={mainSrc}
        alt="Product"
        className="gallery-main"
        onError={(e) => handleImageError(e, PRODUCT_PLACEHOLDER)}
      />
      {sorted.length > 1 && (
        <div className="gallery-thumbs">
          {sorted.map((img) => (
            <button
              key={img.id}
              type="button"
              className={`gallery-thumb ${img.id === active ? 'active' : ''}`}
              onClick={() => setActive(img.id)}
            >
              <img
                src={resolveImageUrl(img.image_url)}
                alt=""
                onError={(e) => handleImageError(e, PRODUCT_PLACEHOLDER)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
