import { useState } from 'react'

import { useNavigate, Link } from 'react-router-dom'

import axios from 'axios'

import { setAuthSession } from '../../api'

import './Auth.css'



function PasswordToggle({ show, onToggle }) {

  return (

    <button type="button" className="auth-toggle-password" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}>

      {show ? 'Hide' : 'Show'}

    </button>

  )

}



export default function Login() {

  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState('')

  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()



  const handleLogin = async (e) => {

    e.preventDefault()

    setError('')

    setLoading(true)



    try {

      const response = await axios.post('http://localhost:5000/api/login', {

        email,

        password,

      })



      if (response.data.token) {

        setAuthSession({

          token: response.data.token,

          access_token: response.data.access_token,

          refresh_token: response.data.refresh_token,

          user_id: response.data.user_id,

          user: response.data.user

            ? { id: response.data.user_id, ...response.data.user }

            : { id: response.data.user_id },

        })

        navigate('/feed')

      }

    } catch (err) {

      setError(err.response?.data?.error || 'Invalid credentials')

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

              Welcome Back to <br />

              <span>Your Creative Space</span>

            </h1>

            <p>

              Continue your journey with UniHub. Showcase your skills and find opportunities that

              matter.

            </p>

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

          <h2>Welcome back</h2>

          <p className="auth-subtitle">Please enter your details</p>



          {error && <div className="auth-error" role="alert">{error}</div>}



          <form onSubmit={handleLogin} className="auth-form">

            <div className="auth-field">

              <label htmlFor="login-email">Email address</label>

              <input

                id="login-email"

                type="email"

                className="auth-input"

                placeholder="you@example.com"

                value={email}

                onChange={(e) => setEmail(e.target.value)}

                required

              />

            </div>



            <div className="auth-field">

              <div className="auth-field-row">

                <label htmlFor="login-password">Password</label>

                <a href="#" className="auth-link">Forgot password?</a>

              </div>

              <div className="auth-input-wrap">

                <input

                  id="login-password"

                  type={showPassword ? 'text' : 'password'}

                  className="auth-input"

                  placeholder="Enter your password"

                  value={password}

                  onChange={(e) => setPassword(e.target.value)}

                  required

                />

                <PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />

              </div>

            </div>



            <button type="submit" className="auth-submit" disabled={loading}>

              {loading ? 'Signing in…' : 'Sign in'}

            </button>

          </form>



          <p className="auth-footer-text">

            Don&apos;t have an account? <Link to="/signup">Create account</Link>

          </p>

          <p className="auth-legal">

            By signing in, you agree to our Terms of Service and Privacy Policy.

          </p>

        </div>

      </div>

    </div>

  )

}

