// KAIte/react/screens/ProfileDashboard.tsx
//
// Full "What your logs show" page: the AI-use profile built from the redacted
// conversations. Read-only; the only action is to move on.

import type { ReflectionSummary } from "../../logic/types";
import { DomainBubbles } from "../components/profile/DomainBubbles";
import { OwnershipTrack } from "../components/profile/OwnershipTrack";
import { PurposeBars } from "../components/profile/PurposeBars";
import { StatGrid } from "../components/profile/StatGrid";
import { StrengthNote } from "../components/profile/StrengthNote";
import { Screen } from "../components/Screen";

export interface ProfileDashboardProps {
  /** Null before the review step has produced a summary. */
  summary: ReflectionSummary | null;
  onContinue: () => void;
  onBack: () => void;
  active?: boolean;
}

function standfirst(s: ReflectionSummary): string {
  const i = s.intensity;
  const range = i.firstDate && i.lastDate ? `, ${i.firstDate.slice(0, 10)} to ${i.lastDate.slice(0, 10)}` : "";
  return (
    `${i.conversationCount} conversations${range}. Counts come from what you imported. ` +
    `Labels are WeFlect's best guess — you can correct any of them in the reflection.`
  );
}

export function ProfileDashboard({ summary, onContinue, onBack, active }: ProfileDashboardProps) {
  return (
    <Screen id="s-profile" active={active}>
      <p className="eyebrow">Your AI-use profile</p>
      <h1>What your logs show</h1>
      <p className="standfirst">{summary ? standfirst(summary) : ""}</p>

      {summary && (
        <div className="grid2">
          <div className="col">
            <section className="panel">
              <h2 className="block">Where AI shows up</h2>
              <DomainBubbles domains={summary.domains} />
              <p className="thin-edge">
                Sizes come from how many conversations fell into each area. Labels are WeFlect's best guess; they may be
                off.
              </p>
            </section>
            <section className="panel">
              <h2 className="block">Your guess, and the logs</h2>
              <StatGrid intensity={summary.intensity} />
            </section>
          </div>
          <div className="col">
            <section className="panel">
              <h2 className="block">Why the chats happened</h2>
              <PurposeBars purposes={summary.purposes} />
            </section>
            <section className="panel">
              <h2 className="block">Work split</h2>
              <OwnershipTrack ownership={summary.ownership} />
            </section>
            <section className="panel soft">
              <h2 className="block">Something to notice</h2>
              <StrengthNote summary={summary} />
            </section>
          </div>
        </div>
      )}

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn primary" disabled={!summary} onClick={onContinue}>
          Continue
        </button>
      </div>
    </Screen>
  );
}
