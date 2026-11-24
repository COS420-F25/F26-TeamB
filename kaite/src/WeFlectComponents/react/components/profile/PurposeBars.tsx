// KAIte/react/components/profile/PurposeBars.tsx
//
// "Why the chats happened": one horizontal bar per purpose.

import type { PurposeBreakdown } from "../../../logic/types";
import { pct } from "../../lib/format";

export interface PurposeBarsProps {
  purposes: PurposeBreakdown[];
}

export function PurposeBars({ purposes }: PurposeBarsProps) {
  return (
    <div className="bars">
      {purposes.map((p) => (
        <div key={p.purpose} className="bar-row">
          <div className="bar-top">
            <span>{p.label}</span>
            <span>{pct(p.share)}</span>
          </div>
          <div className="bar">
            <span style={{ width: pct(p.share) }} />
          </div>
        </div>
      ))}
    </div>
  );
}
