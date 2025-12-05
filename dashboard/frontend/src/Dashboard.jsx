import React, { useState } from 'react'
import App from './App'
import ClientDashboard from './ClientDashboard'
import './styles/navigation.css'

export default function Dashboard() {
  const [currentView, setCurrentView] = useState('admin') // 'admin' ou 'client'

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-buttons">
          <button 
            className={`nav-button ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => setCurrentView('admin')}
          >
            Painel Administrativo
          </button>
          <button 
            className={`nav-button ${currentView === 'client' ? 'active' : ''}`}
            onClick={() => setCurrentView('client')}
          >
            Painel do Cliente
          </button>
        </div>
      </nav>
      
      {currentView === 'admin' ? <App /> : <ClientDashboard />}
    </div>
  )
}