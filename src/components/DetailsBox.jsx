function DetailsBox({ exercise }) {
  return (
    <aside className="exercise-details">
      <div className="details-header">
        <span className="details-eyebrow">Exercise details</span>
        <h3>Muscles worked</h3>
      </div>

      <div className="muscle-section">
        <p className="muscle-label">Primary</p>
        <div className="muscle-pill-list">
          {exercise.primaryMuscles.map((muscle) => (
            <span key={muscle} className="muscle-pill primary">
              {muscle}
            </span>
          ))}
        </div>
      </div>

      {exercise.secondaryMuscles.length > 0 && (
        <div className="muscle-section">
          <p className="muscle-label">Secondary</p>
          <div className="muscle-pill-list">
            {exercise.secondaryMuscles.map((muscle) => (
              <span key={muscle} className="muscle-pill secondary">
                {muscle}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export default DetailsBox;
