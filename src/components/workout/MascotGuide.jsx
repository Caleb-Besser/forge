import { useState } from "react";
import { mascotAsset } from "../../lib/mascotGuide";

export default function MascotGuide({
  moment,
  compact = false,
  className = "",
}) {
  const intendedSource = mascotAsset(moment.character, moment.pose);
  const [failedSource, setFailedSource] = useState("");
  const source = failedSource === intendedSource
    ? (
        moment.character === "drip"
          ? mascotAsset("drip", "idle")
          : mascotAsset("king", "idle")
      )
    : intendedSource;

  return (
    <aside className={`mascot-guide ${compact ? "is-compact" : ""} ${className}`}>
      <img
        src={source}
        alt={`${moment.character === "duo" ? "King and Drip" : moment.character} ${moment.pose}`}
        onError={() => setFailedSource(intendedSource)}
      />
      <div className="mascot-dialogue">
        <span>{moment.character === "duo" ? "King + Drip" : moment.character}</span>
        <p>{moment.message}</p>
      </div>
    </aside>
  );
}
