// KAIte/react/components/profile/DomainBubbles.tsx
//
// "Where AI shows up": a bubble per domain sized by its share of
// conversations, plus the full list so nothing is hidden.

import type { DomainBubble } from "../../../logic/types";
import { pct } from "../../lib/format";

export interface DomainBubblesProps {
  /** Domains sorted by count, highest first (summarize.ts does this). */
  domains: DomainBubble[];
}

/** Only the top domains get a bubble so the cluster stays readable. */
export const MAX_BUBBLES = 8;

export function DomainBubbles({ domains }: DomainBubblesProps) {
  const top = domains.slice(0, MAX_BUBBLES);
  // The 0.0001 floor avoids a divide-by-zero when every share is 0.
  const maxShare = Math.max(...top.map((d) => d.share), 0.0001);

  return (
    <>
      <div className="bubbles">
        {top.map((d) => {
          // Diameter scales with share relative to the largest domain: 46px
          // minimum (the label still fits) up to 132px.
          const size = Math.round(46 + (d.share / maxShare) * 86);
          return (
            <div
              key={d.domain}
              className="bubble"
              style={{ width: `${size}px`, height: `${size}px` }}
              title={d.examples.join(" · ")}
            >
              <span className="b-label">{d.label}</span>
              <span className="b-count">{pct(d.share)}</span>
            </div>
          );
        })}
      </div>
      <ul className="domain-list">
        {domains.map((d) => (
          <li key={d.domain}>
            {d.label}: {d.count}
          </li>
        ))}
      </ul>
    </>
  );
}
