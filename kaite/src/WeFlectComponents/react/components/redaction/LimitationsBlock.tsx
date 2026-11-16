// KAIte/react/components/redaction/LimitationsBlock.tsx
//
// Review section 4: what the engine checks but cannot guarantee. The bottom
// line (the `scope` entry) is always visible; the other checks sit behind one
// disclosure, grouped by theme into headline cards that each expand to the
// full detail. The list is static, not per-log data.

import { Limitation, LIMITATION_GROUPS, LIMITATIONS } from "../../../logic/findings";

export function LimitationsBlock() {
  const scope = LIMITATIONS.find((l) => l.group === "scope");
  const checks = LIMITATIONS.filter((l) => l.group !== "scope");
  const groups = LIMITATION_GROUPS.map((g) => ({
    ...g,
    items: checks.filter((l: Limitation) => l.group === g.key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="f-limits">
      {scope && <p className="f-limits-lead">{scope.detail}</p>}
      <details className="f-limits-all">
        <summary>
          <span className="f-limits-toggle">
            <span className="f-when-closed">Show the {checks.length} checks</span>
            <span className="f-when-open">Hide the {checks.length} checks</span>
          </span>
          {/* Topic labels only, no counts: a number here would read as "4
              things slipped through in YOUR log". */}
          <span className="f-limits-chips">
            {groups.map((g) => (
              <span key={g.key} className="f-chip">
                {g.title.toLowerCase()}
              </span>
            ))}
          </span>
        </summary>
        <div className="f-limit-groups">
          {groups.map((g) => (
            <section key={g.key} className="f-limit-group">
              <h4 className="f-limit-group-title">
                {g.title}
                <span className="f-limit-count">{g.items.length}</span>
              </h4>
              <p className="f-limit-group-blurb">{g.blurb}</p>
              <div className="f-limit-cards">
                {g.items.map((l) => (
                  <details key={l.short} className="f-limit-card">
                    <summary className="f-limit-card-title">{l.short}</summary>
                    <p className="f-limit-card-detail">{l.detail}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </details>
      <p className="f-note">The downloadable report prints every one of these in full.</p>
    </div>
  );
}
