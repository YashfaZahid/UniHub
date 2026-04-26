import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import FeedPage from './pages/FeedPage'  
import Profile from './pages/Profile'
import CreateShop from './pages/CreateShop'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path='/profile' element={<Profile />}/>
        <Route path='/create-shop' element={<CreateShop />}/>
      </Routes>
    </Router>
  )
}

export default App