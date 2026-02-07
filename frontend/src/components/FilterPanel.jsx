import "./FilterPanel.css";

export default function FilterPanel({ filters, onChange }) {
  return (
    <div className="filter-panel glass">
      {filters.map((f) => (
        <label key={f.key}>
          <span>{f.label}</span>
          <select value={f.value} onChange={(e) => onChange(f.key, e.target.value)}>
            {f.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
