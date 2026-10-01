import { RT_TECHNOLOGIES } from '../config.js'

const technologyOptions = [
  { value: RT_TECHNOLOGIES.NONE, label: 'None' },
  { value: RT_TECHNOLOGIES.SOCKET_IO, label: 'Socket.IO' },
  { value: RT_TECHNOLOGIES.STOMP, label: 'STOMP' },
]

export default function BlueprintActionBar({
  canCreate = false,
  canSave = false,
  canDelete = false,
  busy = false,
  technology = RT_TECHNOLOGIES.NONE,
  onTechnologyChange,
  onCreate,
  onSave,
  onDelete,
}) {
  return (
    <div className="action-bar" role="toolbar" aria-label="Blueprint actions">
      <div className="action-bar-buttons">
        <button
          className="btn btn-primary"
          type="button"
          disabled={!canCreate || busy}
          onClick={onCreate}
        >
          Create
        </button>
        <button className="btn" type="button" disabled={!canSave || busy} onClick={onSave}>
          Save/Update
        </button>
        <button
          className="btn btn-danger"
          type="button"
          disabled={!canDelete || busy}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>

      <label className="rt-selector">
        <span>Real time</span>
        <select
          className="input"
          value={technology}
          onChange={(event) => onTechnologyChange?.(event.target.value)}
        >
          {technologyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
