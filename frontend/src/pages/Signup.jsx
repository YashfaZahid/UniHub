import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import './Auth.css'

function PasswordToggle({ show, onToggle }) {
  return (
    <button type="button" className="auth-toggle-password" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}>
      {show ? 'Hide' : 'Show'}
    </button>
  )
}

export default function Signup() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const response = await axios.post('http://localhost:5000/api/register', {
        name: form.name,
        email: form.email,
        password: form.password,
      })

      if (response.status === 201 || response.data.message) {
        navigate('/login')
      } else {
        setError('Signup failed. Please try again.')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand-panel">
        <div>
          <div className="auth-brand-header">
            <span className="auth-logo">UH</span>
            <span className="auth-brand-name">UniHub</span>
          </div>
          <div className="auth-brand-copy" style={{ marginTop: '4rem' }}>
            <h1>
              Join Our <br />
              <span>Creative Community</span>
            </h1>
            <p>
              Start your journey with UniHub. Showcase your skills, find opportunities, and connect
              with fellow creators.
            </p>
            <div className="auth-checklist">
              <div className="auth-check-item">
                <span className="auth-check-icon">✓</span>
                <span>Showcase your portfolio</span>
              </div>
              <div className="auth-check-item">
                <span className="auth-check-icon">✓</span>
                <span>Find paid opportunities</span>
              </div>
              <div className="auth-check-item">
                <span className="auth-check-icon">✓</span>
                <span>Build your professional brand</span>
              </div>
            </div>
          </div>
        </div>
        <div className="auth-brand-footer">
          <span>© 2026 UniHub</span>
          <span>•</span>
          <span>Privacy</span>
          <span>•</span>
          <span>Terms</span>
        </div>
      </aside>

      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-logo">
            <span className="auth-logo">UH</span>
          </div>
          <h2>Create account</h2>
          <p className="auth-subtitle">Start your journey today</p>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <form onSubmit={handleSignup} className="auth-form">
            <div className="auth-field">
              <label htmlFor="signup-name">Full name</label>
              <input
                id="signup-name"
                type="text"
                name="name"
                className="auth-input"
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                name="email"
                className="auth-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="signup-password">Password</label>
              <div className="auth-input-wrap">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className="auth-input"
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="signup-confirm">Confirm password</label>
              <div className="auth-input-wrap">
                <input
                  id="signup-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  className="auth-input"
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <PasswordToggle
                  show={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="auth-footer-text">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <p className="auth-legal">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
