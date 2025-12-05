import React from 'react'

export default function ContadorVagas({ livres = 0, total = 0 }) {
  return (
    <div className="contador">
      <div className="contador-numeric">
        <span className="livres">{livres}</span>
        <span className="sep">/</span>
        <span className="total">{total}</span>
      </div>
      <div className="contador-label">Vagas livres</div>
    </div>
  )
}
