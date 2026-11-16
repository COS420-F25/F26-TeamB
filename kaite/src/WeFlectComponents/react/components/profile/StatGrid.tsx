// KAIte/react/components/profile/StatGrid.tsx
//
// The four intensity tiles: how much, and how back-and-forth, the usage is.

import type { IntensityMetrics } from "../../../logic/types";
import { pct, round } from "../../lib/format";

export interface StatTileProps {
  value: string;
  caption: string;
}

export function StatTile({ value, caption }: StatTileProps) {
  return (
    <div className="stat">
      <div className="v">{value}</div>
      <div className="k">{caption}</div>
    </div>
  );
}

export interface StatGridProps {
  intensity: IntensityMetrics;
}

export function StatGrid({ intensity }: StatGridProps) {
  return (
    <div className="statgrid">
      <StatTile value={String(intensity.conversationCount)} caption="conversations" />
      <StatTile value={round(intensity.avgPromptsPerConversation)} caption="avg prompts / chat" />
      <StatTile value={pct(intensity.multiTurnRatio)} caption="back-and-forth" />
      <StatTile value={pct(intensity.singleTurnRatio)} caption="single prompt" />
    </div>
  );
}
