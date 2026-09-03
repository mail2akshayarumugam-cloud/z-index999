import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getUser } from './user'
import useSessionTimeout from './hooks/useSessionTimeout'
import LoginPage from './pages/LoginPage'
import MainView from './pages/MainView'
import PayPage from './pages/PayPage'
import ReviewPage from './pages/ReviewPage'
import ProfilePage from './pages/ProfilePage'
import AuthorityDashboard from './pages/AuthorityDashboard'
import MailMonitor from './pages/MailMonitor'

function RequireUser({ children }) {
  const user = getUser()
  if (!user) return <Navigate to="/login" replace />
  return <SessionWrapper>{children}</SessionWrapper>
}

function RequireAuthority({ children }) {
  const user = getUser()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'authority') return <Navigate to="/" replace />
  return <SessionWrapper>{children}</SessionWrapper>
}

function SmartHome() {
  const user = getUser()
  if (user?.role === 'authority') return <Navigate to="/authority" replace />
  return <MainView />
}

function SessionWrapper({ children }) {
  useSessionTimeout()
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireUser><SmartHome /></RequireUser>} />
        <Route path="/pay" element={<RequireUser><PayPage /></RequireUser>} />
        <Route path="/review" element={<RequireUser><ReviewPage /></RequireUser>} />
        <Route path="/profile" element={<RequireUser><ProfilePage /></RequireUser>} />
        <Route path="/mail" element={<RequireUser><MailMonitor /></RequireUser>} />
        <Route path="/authority" element={<RequireAuthority><AuthorityDashboard /></RequireAuthority>} />
      </Routes>
    </BrowserRouter>
  )
}
