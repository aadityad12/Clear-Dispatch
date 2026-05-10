import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import SosPage from './pages/SosPage'

const isSos = window.location.pathname === '/sos'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSos ? <SosPage /> : <App />}
  </StrictMode>,
)
