// KAIte/react/components/redaction/CategoryChips.tsx
//
// Per-category tallies above the findings panel. "review" categories are
// counted but not auto-redacted; everything else is already hidden.

import type { RedactionCategory } from "../../../logic/types";

export interface CategoryChipsProps {
  categories: RedactionCategory[];
}

export function CategoryChips({ categories }: CategoryChipsProps) {
  return (
    <div className="cats" aria-live="polite">
      {categories.length === 0 ? (
        // Wording kept from weflect: with the real engine an empty
        // list means the scan found nothing to hide or review.
        <div className="cat">
          <span>No redaction categories yet</span>
          <span className="count">pending</span>
        </div>
      ) : (
        categories.map((c) => (
          <div key={`${c.kind}-${c.disposition}`} className={c.disposition === "review" ? "cat review" : "cat"}>
            <span>{c.label}</span>
            <span className="count">
              {c.count} {c.disposition === "review" ? "to review" : "hidden"}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
