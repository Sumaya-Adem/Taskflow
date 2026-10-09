import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { createAppServices } from './state/services.js'
import './styles/global.css'

// Storage is read once here, before rendering (see createAppServices).
const services = createAppServices()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
)
