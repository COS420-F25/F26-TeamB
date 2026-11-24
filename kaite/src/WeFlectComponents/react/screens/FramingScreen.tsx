// KAIte/react/screens/FramingScreen.tsx
//
// Full "How should this conversation go?" page: six 1-5 scales and an optional
// note that set the agent's stance. Set once, before the chat starts.

import { useState } from "react";
import { FRAMING_DIMENSIONS, FramingDimensionId, FramingPreferences } from "../../logic/framing";
import { CustomNote } from "../components/framing/CustomNote";
import { LikertRow } from "../components/framing/LikertRow";
import { Screen } from "../components/Screen";

export interface FramingScreenProps {
  /** Called with the chosen preferences when the student begins the reflection. */
  onStart: (framing: FramingPreferences) => void;
  /** True while the session is being created: the button is disabled. */
  busy?: boolean;
  onBack: () => void;
  active?: boolean;
}

type Levels = Record<FramingDimensionId, number>;

// Default to the neutral midpoint so a student who skips a question expresses
// "no preference" rather than an extreme.
const NEUTRAL = 3;
const initialLevels = (): Levels =>
  Object.fromEntries(FRAMING_DIMENSIONS.map((d) => [d.id, NEUTRAL])) as Levels;

export function FramingScreen({ onStart, busy = false, onBack, active }: FramingScreenProps) {
  const [levels, setLevels] = useState<Levels>(initialLevels);
  const [custom, setCustom] = useState("");

  const start = () => {
    const prefs: FramingPreferences = { ...levels };
    const note = custom.trim();
    if (note) prefs.custom = note;
    onStart(prefs);
  };

  return (
    <Screen id="s-framing" active={active}>
      <p className="eyebrow">Before we talk</p>
      <h1>How should this conversation go?</h1>
      <p className="standfirst">
        Set the stance you want WeFlect to take. There are no right answers — these choices shape the tone, depth, and
        scope of the reflection, and the agent will follow them.
      </p>

      <div className="framing-rows">
        {FRAMING_DIMENSIONS.map((dim) => (
          <LikertRow
            key={dim.id}
            dimension={dim}
            value={levels[dim.id]}
            onChange={(level) => setLevels((prev) => ({ ...prev, [dim.id]: level }))}
          />
        ))}
      </div>

      <CustomNote value={custom} onChange={setCustom} />

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn primary" disabled={busy} onClick={start}>
          {busy ? "Starting…" : "Begin the reflection"}
        </button>
      </div>
    </Screen>
  );
}
