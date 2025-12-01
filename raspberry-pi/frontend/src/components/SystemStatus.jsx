import React from 'react'

export default function SystemStatus({ mqttConnected, apiConnected }) {
  return (
    <div className="system-status">
      <div className={`status-indicator ${mqttConnected ? 'online' : 'offline'}`}>
        <div className="status-dot"></div>
        <span className="status-text">MQTT</span>
      </div>
      <div className={`status-indicator ${apiConnected ? 'online' : 'offline'}`}>
        <div className="status-dot"></div>
        <span className="status-text">API</span>
      </div>
    </div>
  )
}
