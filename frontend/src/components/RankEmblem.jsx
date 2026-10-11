/* Hexagon rank emblem. E-C: quiet outline, B-A: accent, S: gold (gold is reserved for coins and S-rank). */
import { useLook } from "../look";

export default function RankEmblem({ rank, size = 96 }) {
  const { w } = useLook();
  const tier = rank === "S" ? "s" : rank === "A" || rank === "B" ? "hi" : "lo";
  return (
    <div className={`emblem tier-${tier}`} style={{ width: size, height: size }} role="img" aria-label={w.rankNamed(rank)}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <polygon points="50,4 91,27 91,73 50,96 9,73 9,27" className="emblem-outer" />
        <polygon points="50,14 82,32 82,68 50,86 18,68 18,32" className="emblem-inner" />
      </svg>
      <span className="display emblem-letter" style={{ fontSize: size * 0.5 }}>{rank}</span>
    </div>
  );
}
