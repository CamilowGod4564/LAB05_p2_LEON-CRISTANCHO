import { useCallback, useEffect, useState } from 'react'
import { checkAllServices } from '../services/healthService.js'

const statusLabels = { up: 'Up', down: 'Down' }

export default function HealthPanel({ check = checkAllServices }) {
  const [results, setResults] = useState([])
  const [checking, setChecking] = useState(false)

  const runCheck = useCallback(async () => {
    setChecking(true)
    try {
      setResults(await check())
    } finally {
      setChecking(false)
    }
  }, [check])

  useEffect(() => {
    runCheck()
  }, [runCheck])

  return (
    <section className="card health-panel" aria-labelledby="health-title">
      <div className="results-heading">
        <div>
          <p className="eyebrow">Health check</p>
          <h2 className="panel-title" id="health-title">
            Services
          </h2>
        </div>
        <button className="btn" type="button" onClick={runCheck} disabled={checking}>
          {checking ? 'Checking...' : 'Check again'}
        </button>
      </div>
      <ul className="health-list">
        {results.map((result) => (
          <li key={result.id} className="health-item" data-status={result.status}>
            <span className="rt-dot" aria-hidden="true" />
            <strong>{result.label}</strong>
            <span>
              {statusLabels[result.status]}
              {result.latencyMs !== null && ` · ${result.latencyMs} ms`}
              {result.error && ` · ${result.error}`}
            </span>
            <code className="health-url">{result.url}</code>
          </li>
        ))}
      </ul>
    </section>
  )
}
