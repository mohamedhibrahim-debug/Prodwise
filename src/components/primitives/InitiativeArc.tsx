import { STAGES, type Stage } from "@/lib/domain/types";
import { stageIndex } from "@/lib/domain/ordering";

interface InitiativeArcProps {
  stage?: Stage;
  size?: number;
  /** Rendered without stage data, as a pure identity mark. */
  mark?: boolean;
  className?: string;
}

/**
 * THE INITIATIVE ARC — Prodwise's visual signature.
 *
 * A thin ring of eight segments, one per lifecycle stage: completed stages
 * solid, the current stage in cyan, later stages faint. It reinterprets the
 * arc/ring geometry of the reference deck as something information-bearing
 * rather than decorative, and it must never resemble the AMAN logo.
 *
 * It is a SUPPORTING motif. It stays small and quiet, and must never compete
 * with Current State, Needs Your Attention or Next Best Action, nor become a
 * hero graphic (CLAUDE.md §16).
 */
export function InitiativeArc({
  stage,
  size = 28,
  mark = false,
  className,
}: InitiativeArcProps) {
  const segments = STAGES.length;
  const current = stage ? stageIndex(stage) : -1;

  const radius = 44;
  const centre = 50;
  const gapDegrees = 7;
  const step = 360 / segments;
  const sweep = step - gapDegrees;

  const strokeWidth = mark ? 11 : 9;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: segments }, (_, i) => {
        // Start at 12 o'clock and run clockwise.
        const start = -90 + i * step + gapDegrees / 2;
        const end = start + sweep;

        const toPoint = (deg: number): [number, number] => {
          const rad = (deg * Math.PI) / 180;
          return [
            centre + radius * Math.cos(rad),
            centre + radius * Math.sin(rad),
          ];
        };

        const [x1, y1] = toPoint(start);
        const [x2, y2] = toPoint(end);

        let stroke = "var(--rule-strong)";
        let opacity = 1;

        if (mark) {
          // Identity mark: a quiet ring with one accented segment.
          stroke = i === 1 ? "var(--accent-400)" : "var(--navy-500)";
        } else if (current >= 0) {
          if (i < current) {
            stroke = "var(--accent-200)";
          } else if (i === current) {
            stroke = "var(--accent-500)";
          } else {
            stroke = "var(--rule-strong)";
            opacity = 0.75;
          }
        }

        return (
          <path
            key={i}
            d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`}
            fill="none"
            stroke={stroke}
            strokeOpacity={opacity}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
}
