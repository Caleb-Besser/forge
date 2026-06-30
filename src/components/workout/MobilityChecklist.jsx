export default function MobilityChecklist({ parts, checked, onChange }) {
  return (
    <div className="mobility-list">
      {parts.map((part) => (
        <label className="mobility-item" key={part.id}>
          <input
            type="checkbox"
            checked={checked[part.id] ?? false}
            onChange={(event) => onChange({ ...checked, [part.id]: event.target.checked })}
          />
          <span className="check-mark" aria-hidden="true" />
          <span>{part.name}</span>
        </label>
      ))}
    </div>
  );
}

