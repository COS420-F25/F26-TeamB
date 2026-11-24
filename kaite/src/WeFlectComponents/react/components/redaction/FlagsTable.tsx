// KAIte/react/components/redaction/FlagsTable.tsx
//
// Review section 3: conversations flagged as possibly personal. Their text is
// never edited; a ticked row (the default) leaves the conversation out of the
// profile.

import type { Conversation, ReviewFlag } from "../../../logic/types";
import { conversationLabel } from "../../../logic/findings";
import { DecisionCheckbox } from "./DecisionCheckbox";
import { SimpleTable } from "./SimpleTable";

export interface FlagsTableProps {
  flags: ReviewFlag[];
  /** The redacted conversations, used to show a readable label and date. */
  conversations: readonly Conversation[];
  isExcluded: (conversationId: string) => boolean;
  onToggle: (conversationId: string, exclude: boolean) => void;
}

/** Label above, date beneath; the raw id is kept only as a hover tooltip. */
function ConversationCell({ conversation, id }: { conversation: Conversation | undefined; id: string }) {
  const label = (conversation && conversationLabel(conversation)) || id;
  const date = conversation?.timestamp?.slice(0, 10);
  return (
    <span className="f-conv" title={`Conversation id: ${id}`}>
      <span className="f-conv-title">{label}</span>
      {date && <span className="f-conv-date">{date}</span>}
    </span>
  );
}

export function FlagsTable({ flags, conversations, isExcluded, onToggle }: FlagsTableProps) {
  const byId = new Map(conversations.map((c) => [c.id, c] as const));
  return (
    <SimpleTable
      className="f-flags"
      headers={["Exclude?", "Conversation", "Flag", "Reason"]}
      rows={flags.map((f, i) => ({
        key: `${f.conversationId}-${i}`,
        cells: [
          <DecisionCheckbox
            checked={isExcluded(f.conversationId)}
            ariaLabel={`Exclude conversation ${f.conversationId}`}
            onChange={(checked) => onToggle(f.conversationId, checked)}
          />,
          <ConversationCell conversation={byId.get(f.conversationId)} id={f.conversationId} />,
          f.subkind,
          // The reason is folded into the question text, which names the keywords.
          f.question,
        ],
      }))}
    />
  );
}
