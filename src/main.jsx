import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { FormStateProvider } from './context/FormStateContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FormStateProvider>
      <App />
    </FormStateProvider>
  </StrictMode>,
)