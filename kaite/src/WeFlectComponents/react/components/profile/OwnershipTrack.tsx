// KAIte/react/components/profile/OwnershipTrack.tsx
//
// "Work split": a marker on a track from AI-led to clearly the student's own.

import type { OwnershipSignal } from "../../../logic/types";
import { pct } from "../../lib/format";

export interface OwnershipTrackProps {
  ownership: OwnershipSignal;
}

export function OwnershipTrack({ ownership }: OwnershipTrackProps) {
  return (
    <div className="ownership">
      <div className="track">
        <span className="marker" style={{ left: pct(ownership.value) }} />
      </div>
      <div className="track-labels">
        <span>AI-led</span>
        <span>Even</span>
        <span>Clearly you</span>
      </div>
      <p className="own-label">{ownership.label}</p>
      <p className="thin-edge">A reflection cue, not a grade.</p>
    </div>
  );
}
