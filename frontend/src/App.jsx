import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import FeedPage from './pages/FeedPage'
import UserProfile from './pages/UserProfile'
import CreateShop from './pages/CreateShop'
import ShopPage from './pages/ShopPage'
import ProductPage from './pages/ProductPage'
import MessagesPage from './pages/MessagesPage'
import OrdersPage from './pages/OrdersPage'
import NotificationsPage from './pages/NotificationsPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/profile/:userId" element={<UserProfile />} />
        <Route path="/create-shop" element={<CreateShop />} />
        <Route path="/shop/:id" element={<ShopPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Routes>
    </Router>
  )
}

export default App