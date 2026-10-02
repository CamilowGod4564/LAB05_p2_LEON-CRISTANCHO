import { useMemo } from 'react'
import { countPoints, totalPoints } from '../utils/blueprints.js'

export default function AuthorPanel({
  author,
  items = [],
  status = 'idle',
  error = null,
  selectedName = null,
  openDisabled = false,
  onOpen,
  onRetry,
  renderActions,
}) {
  const total = useMemo(() => totalPoints(items), [items])

  return (
    <section className="card results-panel" aria-labelledby="results-title">
      <div className="results-heading">
        <div>
          <p className="eyebrow">Author results</p>
          <h2 className="panel-title" id="results-title">
            {author ? `${author}'s blueprints` : 'Results'}
          </h2>
        </div>
        {author && (
          <span className="result-count">
            {items.length} {items.length === 1 ? 'blueprint' : 'blueprints'}
          </span>
        )}
      </div>

      {status === 'loading' && (
        <p className="status-message" role="status">
          Loading blueprints...
        </p>
      )}
      {status === 'failed' && (
        <div className="status-message error-message retry-banner" role="alert">
          <span>Could not load blueprints: {error}</span>
          {onRetry && (
            <button className="btn" type="button" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}
      {!author && status !== 'loading' && (
        <p className="empty-message">Enter an author name to see their blueprints.</p>
      )}
      {author && !items.length && status !== 'loading' && status !== 'failed' && (
        <p className="empty-message">No blueprints found for this author.</p>
      )}

      {!!items.length && (
        <div className="table-scroll">
          <table className="blueprints-table">
            <caption className="sr-only">Blueprints created by {author}</caption>
            <thead>
              <tr>
                <th scope="col">Blueprint name</th>
                <th className="numeric-cell" scope="col">
                  Number of points
                </th>
                <th className="action-cell" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((blueprint) => (
                <tr
                  key={blueprint.name}
                  className={blueprint.name === selectedName ? 'selected-row' : undefined}
                >
                  <td className="blueprint-name-cell">{blueprint.name}</td>
                  <td className="numeric-cell">
                    <span className="point-count">{countPoints(blueprint)}</span>
                  </td>
                  <td className="action-cell">
                    <div className="blueprint-actions">
                      <button
                        className="btn btn-open"
                        type="button"
                        onClick={() => onOpen?.(blueprint)}
                        disabled={openDisabled}
                      >
                        Open
                      </button>
                      {renderActions?.(blueprint)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="results-footer">
        <span>Total user points</span>
        <strong data-testid="author-total-points">{total}</strong>
      </footer>
    </section>
  )
}
