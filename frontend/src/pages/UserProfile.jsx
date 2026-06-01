import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { getPublicProfile, followUser, clearAuthSession } from '../../api'
import { uploadAvatar } from '../utils/avatarUpload'
import AppLayout from '../components/AppLayout'
import { getProfileImageUrl, handleImageError, AVATAR_PLACEHOLDER } from '../utils/images'
import './Profile.css'

function syncUserInStorage(profile) {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return
    const user = JSON.parse(raw)
    localStorage.setItem(
      'user',
      JSON.stringify({ ...user, profile_image: profile.profile_image, name: profile.name })
    )
  } catch {
    /* ignore */
  }
}

export default function UserProfile() {
  const { userId: paramId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const currentUserId = localStorage.getItem('user_id')
  const profileId = paramId || currentUserId
  const isOwnProfile = !paramId || paramId === currentUserId

  const [profile, setProfile] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')

  useEffect(() => {
    if (!profileId) {
      setLoading(false)
      return
    }
    async function load() {
      try {
        const data = await getPublicProfile(profileId)
        setProfile(data)
        setFormData({
          bio: data.bio || '',
          department: data.department || '',
          semester: data.semester || '',
          university: data.university || '',
          phone: data.phone || '',
          instagram: data.instagram || '',
          linkedin: data.linkedin || '',
        })
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profileId])

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !profile || !isOwnProfile) return

    setUploadError('')
    setUploadSuccess('')
    setUploading(true)

    try {
      const result = await uploadAvatar(file)
      const updated = { ...profile, profile_image: result.profile_image }
      setProfile(updated)
      syncUserInStorage(updated)
      setUploadSuccess('Profile photo updated.')
      setTimeout(() => setUploadSuccess(''), 4000)
    } catch (err) {
      setUploadError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    const { error } = await supabase.from('profiles').update(formData).eq('id', profile.id)
    if (!error) {
      setProfile({ ...profile, ...formData })
      setIsEditing(false)
    } else {
      alert('Error saving: ' + error.message)
    }
  }

  const handleFollow = async () => {
    await followUser(profileId)
    setProfile((p) => ({ ...p, followers_count: (p.followers_count || 0) + 1 }))
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
    clearAuthSession()
    navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="profile-page">
          <p className="text-muted">Loading profile…</p>
        </div>
      </AppLayout>
    )
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="profile-page empty-state">
          <h3>Profile not found</h3>
          <p>Please log in or check the link.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="profile-page profile-v2">
        <div className="profile-container card">
          <div
            className={`profile-image-box ${isOwnProfile ? 'editable' : ''}`}
            onClick={() => isOwnProfile && !uploading && fileInputRef.current?.click()}
            role={isOwnProfile ? 'button' : undefined}
            tabIndex={isOwnProfile ? 0 : undefined}
            onKeyDown={(e) => {
              if (isOwnProfile && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <img
              src={getProfileImageUrl(profile)}
              alt={profile.name}
              className="avatar avatar-lg"
              onError={(e) => handleImageError(e, AVATAR_PLACEHOLDER)}
            />
            {isOwnProfile && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  hidden
                  disabled={uploading}
                />
                <div className="upload-hint">{uploading ? 'Uploading…' : 'Change photo'}</div>
              </>
            )}
          </div>

          {uploadError && (
            <p className="alert alert-error profile-alert" role="alert">
              {uploadError}
            </p>
          )}
          {uploadSuccess && (
            <p className="alert alert-success profile-alert" role="status">
              {uploadSuccess}
            </p>
          )}

          <h1 className="heading-2 profile-name">{profile.name}</h1>

          <div className="profile-stats">
            <div className="profile-stat">
              <strong>{profile.followers_count ?? 0}</strong>
              <span>Followers</span>
            </div>
            <div className="profile-stat">
              <strong>{profile.following_count ?? 0}</strong>
              <span>Following</span>
            </div>
            <div className="profile-stat">
              <strong>{profile.shops?.length ?? 0}</strong>
              <span>Shops</span>
            </div>
          </div>

          {!isOwnProfile && currentUserId && (
            <button type="button" className="profile-btn profile-action-btn" onClick={handleFollow}>
              Follow
            </button>
          )}

          {isOwnProfile && (
            <div className="profile-toolbar">
              {isEditing ? (
                <button type="button" className="profile-btn" onClick={handleSave}>
                  Save Profile
                </button>
              ) : (
                <button type="button" className="profile-btn" onClick={() => setIsEditing(true)}>
                  Edit Profile
                </button>
              )}
              <button
                type="button"
                className="profile-btn"
                onClick={() => !uploading && fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Upload Profile Image'}
              </button>
              <button type="button" className="profile-btn profile-btn-logout" onClick={handleLogout}>
                Log out
              </button>
            </div>
          )}

          <div className="profile-fields">
            {['bio', 'department', 'semester', 'university', 'phone', 'instagram', 'linkedin'].map(
              (field) => (
                <div key={field} className="field-group">
                  <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  {isEditing && isOwnProfile ? (
                    field === 'bio' ? (
                      <textarea
                        className="textarea edit-field"
                        value={formData[field]}
                        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                      />
                    ) : (
                      <input
                        className="input edit-field"
                        value={formData[field]}
                        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                      />
                    )
                  ) : (
                    <div className="static-field">{profile[field] || '—'}</div>
                  )}
                </div>
              )
            )}
          </div>

          <section className="profile-section">
            <h2 className="heading-3">Shops</h2>
            {profile.shops?.length ? (
              <div className="profile-shops-grid">
                {profile.shops.map((s) => (
                  <Link key={s.id} to={`/shop/${s.id}`} className="profile-shop-card">
                    {s.title}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted">No shops yet</p>
            )}
          </section>

          <section className="profile-section">
            <h2 className="heading-3">Products</h2>
            {profile.products?.length ? (
              <ul className="profile-products-list">
                {profile.products.map((p) => (
                  <li key={p.id}>
                    <Link to={`/product/${p.id}`}>{p.title}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No products listed</p>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  )
}
