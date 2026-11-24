// KAIte/react/components/framing/LikertRow.tsx
//
// One framing dimension as a 1-5 scale with low / mid / high anchors. The
// wording comes from FRAMING_DIMENSIONS (src/framing.ts), which the system
// prompt shares.

import type { FramingDimension } from "./Logic/framingIndex";

export interface LikertRowProps {
  dimension: FramingDimension;
  /** Selected level, 1 to 3. */
  value: number;
  onChange: (level: number) => void;
}

const LEVELS = [1, 2, 3];
const ANCHORS = ["low", "mid", "high"] as const;

export function LikertRow({ dimension, value, onChange }: LikertRowProps) {
  return (
    <fieldset className="likert">
      <legend>
        <span className="likert-title">{dimension.title}. </span>
        {dimension.question}
      </legend>
      <div className="likert-scale">
        {LEVELS.map((level,i) => (
          <label key={level} className="likert-opt">
            <input
              type="radio"
              name={`framing-${dimension.id}`}
              value={level}
              checked={value === level}
              onChange={() => onChange(level)}
            />
            <span>{dimension.anchors[ANCHORS[i]]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
