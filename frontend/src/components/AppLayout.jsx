import { Link, NavLink, useNavigate } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import './AppLayout.css'

export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const userId = localStorage.getItem('user_id')

  return (
    <div className="app-layout">
      <nav className="app-nav">
        <Link to="/feed" className="nav-brand">
          UniHub
        </Link>
        <div className="nav-links">
          <NavLink to="/feed" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Feed
          </NavLink>
          <NavLink
            to="/messages"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Messages
          </NavLink>
          <NavLink
            to="/orders"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Orders
          </NavLink>
          <NotificationBell />
          {userId ? (
            <button
              type="button"
              className="btn btn-primary nav-profile-btn"
              onClick={() => navigate('/profile')}
            >
              Profile
            </button>
          ) : (
            <Link to="/login" className="btn btn-secondary nav-login-btn">
              Login
            </Link>
          )}
        </div>
      </nav>
      <div className="app-content">{children}</div>
    </div>
  )
}
