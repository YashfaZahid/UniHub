import { uploadProfileAvatar } from '../../api'

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
export const AVATAR_ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp']

/**
 * Validate avatar file before upload.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateAvatarFile(file) {
  if (!file) {
    return { ok: false, error: 'No file selected.' }
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!AVATAR_ALLOWED_TYPES.includes(file.type) && !AVATAR_ALLOWED_EXT.includes(ext)) {
    return {
      ok: false,
      error: 'Unsupported file type. Use JPG, PNG, GIF, or WebP.',
    }
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: 'File too large. Maximum size is 5MB.' }
  }
  return { ok: true }
}

/**
 * Upload avatar through Flask API (authenticated, bypasses client storage RLS).
 * Stores public URL in profiles.profile_image.
 */
export async function uploadAvatar(file) {
  const validation = validateAvatarFile(file)
  if (!validation.ok) {
    const err = new Error(validation.error)
    err.code = 'VALIDATION'
    throw err
  }

  if (!localStorage.getItem('user_id')) {
    const err = new Error('Please log in to upload a profile photo.')
    err.code = 'AUTH'
    throw err
  }

  try {
    return await uploadProfileAvatar(file)
  } catch (e) {
    if (e.response?.status === 401) {
      const err = new Error('Session expired. Please log in again.')
      err.code = 'AUTH'
      throw err
    }
    const err = new Error(e.response?.data?.error || e.message || 'Upload failed.')
    err.code = 'UPLOAD'
    throw err
  }
}
