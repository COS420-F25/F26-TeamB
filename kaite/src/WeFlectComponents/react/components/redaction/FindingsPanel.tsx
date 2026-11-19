// KAIte/react/components/redaction/FindingsPanel.tsx
//
// The findings report on the redaction-review screen: five sections, the
// keep/redact/exclude checkboxes and the downloads.
//
// PRIVACY: this panel shows ORIGINAL identifiers on purpose (that is what makes
// the numbering auditable). It is rendered and downloaded client-side only and
// must never be included in anything sent to the server.

import type { ReactNode } from "react";
import type { RedactionResult } from "../../../logic/types";
import type { RedactionDecisions } from "../../../logic/findings";
import { hasFindings, reviewableOriginals, withMember } from "../../lib/decisions";
import { CountsTable } from "./CountsTable";
import { DownloadButtons } from "./DownloadButtons";
import { FlagsTable } from "./FlagsTable";
import { KeptTable } from "./KeptTable";
import { LimitationsBlock } from "./LimitationsBlock";
import { MappingTable } from "./MappingTable";

export interface FindingsPanelProps {
  /** The engine's undecided proposal. */
  redaction: RedactionResult;
  decisions: RedactionDecisions;
  onDecisionsChange: (next: RedactionDecisions) => void;
}

// Heading plus either the section's content or an explicit empty-state line,
// so an empty section still says it was checked.
function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  return (
    <>
      <h3 className="f-head">{title}</h3>
      {children || <p className="f-empty">{empty}</p>}
    </>
  );
}

export function FindingsPanel({ redaction, decisions, onDecisionsChange }: FindingsPanelProps) {
  // Nothing was redacted and nobody was numbered: the normal outcome for a
  // clean log. The panel is left out rather than showing an all-empty audit.
  if (!hasFindings(redaction)) return null;

  const uncertain = reviewableOriginals(redaction);
  const kept = redaction.keptPlaceholders ?? [];
  const flags = redaction.reviewFlags ?? [];

  return (
    <details className="findings">
      <summary>Full findings report — what was changed and why (stays on this device)</summary>
      <p className="f-note">
        This report contains the original values so you can audit the numbering. It is rendered in your browser and
        downloads to your device; it is never uploaded.
      </p>

      <div>
        <p className="f-note">
          Checkboxes work the same way everywhere: a tick means that item leaves the shared output — Redact? hides the
          value, Exclude? leaves the conversation out of your profile. Untick to keep something. Nothing is applied
          until you continue.
        </p>

        <Section title="1. Tell us which of these need redacting" empty="Nothing needs your review.">
          {uncertain.length > 0 && (
            <MappingTable
              rows={uncertain}
              isRedacted={(original) => !decisions.preserveOriginals.includes(original)}
              onToggle={(original, redact) =>
                onDecisionsChange({
                  ...decisions,
                  preserveOriginals: withMember(decisions.preserveOriginals, original, !redact),
                })
              }
            />
          )}
        </Section>
        <p className="f-note">
          API keys &amp; secrets, email addresses, phone numbers, and credential-bearing URLs are always hidden
          automatically and aren't listed here — full detail is in the downloadable report. File paths keep their
          structure; only a username or person's name inside a path is masked, and it appears above under that person.
        </p>
        {uncertain.length > 0 && (
          <p className="f-note">
            Rows that share a placeholder are the same person or entity — every alias we tied together is listed under
            it. Uncheck a row to keep that value visible. For a person, unchecking their name keeps that person
            everywhere (their other mentions stop being swept, including inside file paths); emails and keys stay
            independently redacted. Applied when you continue.
          </p>
        )}

        <Section title="2. Preserved / deliberately not redacted" empty="Nothing noted.">
          {kept.length > 0 && (
            <KeptTable
              kept={kept}
              isRedacted={(text) => decisions.redactPreserved.includes(text)}
              onToggle={(text, redact) =>
                onDecisionsChange({
                  ...decisions,
                  redactPreserved: withMember(decisions.redactPreserved, text, redact),
                })
              }
            />
          )}
        </Section>
        {kept.length > 0 && (
          <p className="f-note">
            These were left visible on purpose — they show what a conversation was about and hide nothing live. Tick a
            row to hide it after all; it becomes a typed placeholder like the values in section 1. Applied when you
            continue.
          </p>
        )}

        <Section
          title="3. Flagged possibly-personal conversations (text untouched — you decide)"
          empty="No conversations flagged."
        >
          {flags.length > 0 && (
            <FlagsTable
              flags={flags}
              conversations={redaction.conversations}
              isExcluded={(id) => decisions.excludeConversations.includes(id)}
              onToggle={(id, exclude) =>
                onDecisionsChange({
                  ...decisions,
                  excludeConversations: withMember(decisions.excludeConversations, id, exclude),
                })
              }
            />
          )}
        </Section>
        {flags.length > 0 && (
          <p className="f-note">
            Flagged conversations are left out of your profile by default. Untick a row to keep it — it is then
            summarized and counted like the rest. Applied when you continue.
          </p>
        )}

        <Section title="4. Checked but could not fully verify" empty="">
          <LimitationsBlock />
        </Section>

        <Section title="5. Counts" empty="">
          <CountsTable redaction={redaction} />
        </Section>
      </div>

      <DownloadButtons redaction={redaction} />
    </details>
  );
}
