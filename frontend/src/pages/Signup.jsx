import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

export default function Signup() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
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
      password: form.password
    })
    
    // Check if registration was successful
    if (response.status === 201 || response.data.message) {
      // Show success message
      alert('Account created successfully! Please login.')
      navigate('/login')
    } else {
      setError('Signup failed. Please try again.')
    }
  } catch (err) {
    const errorMsg = err.response?.data?.error || 'Signup failed'
    setError(errorMsg)
  } finally {
    setLoading(false)
  }
}

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Light Pink Brand Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-pink-200 relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-between p-12">
          <div>
            <div className="flex items-center gap-2 mb-16">
              <div className="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-pink-700 text-lg font-bold">UH</span>
              </div>
              <span className="text-pink-700 text-xl font-semibold tracking-wide">UniHub</span>
            </div>
            
            <div className="space-y-8">
              <h1 className="text-4xl font-bold text-pink-700 leading-tight">
                Join Our <br/>
                <span className="text-pink-500">Creative Community</span>
              </h1>
              <p className="text-pink-600 text-lg leading-relaxed">
                Start your journey with UniHub. Showcase your skills, find opportunities, and connect with fellow creators.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-pink-300/50 rounded-full flex items-center justify-center">
                    <span className="text-pink-700 text-sm">✓</span>
                  </div>
                  <span className="text-pink-700">Showcase your portfolio</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-pink-300/50 rounded-full flex items-center justify-center">
                    <span className="text-pink-700 text-sm">✓</span>
                  </div>
                  <span className="text-pink-700">Find paid opportunities</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-pink-300/50 rounded-full flex items-center justify-center">
                    <span className="text-pink-700 text-sm">✓</span>
                  </div>
                  <span className="text-pink-700">Build your professional brand</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-pink-500 text-sm">
            <span>© 2026 UniHub</span>
            <span>•</span>
            <span>Privacy</span>
            <span>•</span>
            <span>Terms</span>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="lg:hidden flex justify-center mb-6">
              <div className="w-12 h-12 bg-pink-200 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-pink-700 text-lg font-bold">UH</span>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Create account</h2>
            <p className="text-gray-500 mt-2">Start your journey today</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full name</label>
              <input
                type="text"
                name="name"
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-500 transition"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-500 transition"
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pink-200 hover:bg-pink-300 text-pink-700 py-3 rounded-lg font-semibold transition mt-4"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-gray-600 mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-pink-500 font-semibold hover:text-pink-600">
              Sign in
            </Link>
          </p>

          <p className="text-center text-gray-400 text-xs mt-6">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}