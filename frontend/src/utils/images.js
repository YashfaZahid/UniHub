import { BASE_URL } from '../../api'

export const SHOP_PLACEHOLDER =
  'https://placehold.co/400x240/F5EFE6/7B1E3A?text=Shop'
export const PRODUCT_PLACEHOLDER =
  'https://placehold.co/400x300/F5EFE6/7B1E3A?text=Product'
export const AVATAR_PLACEHOLDER =
  'https://placehold.co/80x80/E8DCCB/7B1E3A?text=?'

/** Resolve shop/product image paths from Flask uploads or full URLs */
export function resolveImageUrl(imagePath) {
  if (!imagePath) return null
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }
  if (imagePath.startsWith('/')) {
    return `${BASE_URL}${imagePath}`
  }
  return `${BASE_URL}/${imagePath}`
}

export function getShopCoverUrl(shop) {
  const path = shop?.shop_images?.[0]?.image_url ?? shop?.cover_image
  return resolveImageUrl(path) ?? SHOP_PLACEHOLDER
}

export function getPrimaryProductImageUrl(product) {
  const images = product?.product_images ?? []
  const primary = images.find((i) => i.is_primary) ?? images[0]
  return resolveImageUrl(primary?.image_url) ?? PRODUCT_PLACEHOLDER
}

/**
 * profiles.profile_image stores a full public Supabase URL (standard).
 * resolveImageUrl handles legacy relative paths if any exist.
 */
export function getProfileImageUrl(profile) {
  const url = resolveImageUrl(profile?.profile_image)
  return url || AVATAR_PLACEHOLDER
}

export function handleImageError(e, placeholder = SHOP_PLACEHOLDER) {
  e.target.onerror = null
  e.target.src = placeholder
}
