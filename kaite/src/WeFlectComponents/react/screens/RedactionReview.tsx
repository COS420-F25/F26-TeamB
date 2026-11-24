// KAIte/react/screens/RedactionReview.tsx
//
// Full "What stays private" page: the notice, the category tallies and the
// findings report with its keep/redact/exclude decisions. The decisions are
// applied by the caller when the student continues.

import type { RedactionResult } from "../../logic/types";
import type { RedactionDecisions } from "../../logic/findings";
import { REDACTION_IS_STUB } from "../../logic/redaction";
import { CategoryChips } from "../components/redaction/CategoryChips";
import { FindingsPanel } from "../components/redaction/FindingsPanel";
import { Screen } from "../components/Screen";

export interface RedactionReviewProps {
  /** The engine's undecided proposal; null before the first import. */
  redaction: RedactionResult | null;
  decisions: RedactionDecisions;
  onDecisionsChange: (next: RedactionDecisions) => void;
  onContinue: () => void;
  onBack: () => void;
  active?: boolean;
}

// REDACTION_IS_STUB is a constant `false` today. The branch is kept so a build
// with the engine swapped out shows an honest notice.
const NOTICE = REDACTION_IS_STUB
  ? "Redaction is not active in this build. A dedicated redaction step will be added that hides " +
    "names, emails, and file paths before your profile is built. Until then, nothing is uploaded — " +
    "your conversation text stays in this browser and only a summary of patterns is ever sent."
  : "WeFlect found some things that look personal. They're hidden by default and stay in this browser.";

export function RedactionReview({
  redaction,
  decisions,
  onDecisionsChange,
  onContinue,
  onBack,
  active,
}: RedactionReviewProps) {
  return (
    <Screen id="s-redact" active={active}>
      <p className="eyebrow">Setup · step 3 of 3</p>
      <h1>What stays private</h1>
      <p className="standfirst">
        Before WeFlect builds your profile, this step shows what is kept private. Sensitive details stay in this
        browser.
      </p>

      {redaction && (
        <>
          <div className="notice">{NOTICE}</div>
          <CategoryChips categories={redaction.categories} />
          <FindingsPanel redaction={redaction} decisions={decisions} onDecisionsChange={onDecisionsChange} />
        </>
      )}

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn primary" onClick={onContinue}>
          Looks right, continue
        </button>
      </div>
    </Screen>
  );
}
