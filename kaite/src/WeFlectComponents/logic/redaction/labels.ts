/**
 * Kind → student-facing label, placeholder style, and the single confidence threshold
 * that gates disposition — one tunable number instead of per-kind policy.
 */

/**
 * Candidates at or above this confidence are auto-hidden; below it they are review-only.
 * Why 0.8 exactly is not recorded; what matters is where the detectors sit relative to
 * it: every claiming Layer A rule is ≥ 0.85 (hidden; the review-only version-quad rule
 * is 0.5 by design), names.ts cues are 0.85–0.95 (hidden) while
 * its shape-only tiers are 0.6 / 0.5 (review), orgsLocations.ts is 0.6 throughout
 * (review by design), and session.ts places its roster boost (0.85) and persona damper
 * (0.5) on either side of it. Retuning this value moves all of those at once.
 */
export const AUTO_HIDE_THRESHOLD = 0.8;

/**
 * Every placeholder carries an index: entity kinds per entity ([NAME_2], [ORG_3]),
 * everything else per type by distinct value ([GITHUB_TOKEN_1], [IPV4_2], [PHONE_1]).
 * NOTE: exported but unused anywhere in the repo — numbering is decided in session.ts
 * render() (email by distinct address, entity kinds by entity, everything else per
 * placeholder type by distinct value), not by membership here. Kept as documentation
 * of the intended set.
 */
export const NUMBERED_KINDS: ReadonlySet<string> = new Set([
  "name",
  "email",
  "org",
  "location",
  "phone",
  "secret",
  "url-token",
  "ip",
  "id",
  "participant",
]);

/**
 * Placeholder token base per kind (numbered kinds get `_N` appended). There is no
 * "path" kind: file paths keep their structure and only the identifying segment
 * inside them is masked (as [NAME_N]).
 */
export const PLACEHOLDER_BASE: Readonly<Record<string, string>> = {
  name: "NAME",
  email: "EMAIL",
  phone: "PHONE",
  secret: "SECRET",
  "url-token": "URL",
  ip: "IP", // fallback only: the ip rules supply [IPV4] / [IPV6] themselves
  id: "ID",
  org: "ORG",
  location: "LOCATION",
  participant: "PARTICIPANT",
};

/** Student-facing labels for the review screen (RedactionCategory.label). */
export const KIND_LABELS: Readonly<Record<string, string>> = {
  email: "Email addresses",
  phone: "Phone numbers",
  secret: "Credentials & keys",
  "url-token": "Credential-bearing URLs",
  ip: "IP addresses",
  id: "ID numbers",
  name: "Names of people",
  org: "Organizations",
  location: "Places & addresses",
  participant: "Study participant IDs",
  "maybe-personal": "Possibly personal topics",
};

/**
 * Labels for review-disposition rows. labelFor applies these to EVERY review row of
 * the kind, whether or not the kind also has hidden rows, so the review screen never
 * says "Names of people" about names it did not hide. Kinds absent here fall back to
 * KIND_LABELS (e.g. "maybe-personal" is review-only and already worded as such).
 */
export const REVIEW_LABELS: Readonly<Record<string, string>> = {
  name: "Possible names (please review)",
  org: "Possible organizations (please review)",
  location: "Possible places (please review)",
  ip: "Dotted numbers kept as software versions (please review)",
};

/** `[BASE_N]`, or `[BASE]` when unnumbered; an unknown kind renders as [REDACTED] so a span can never render empty. */
export function placeholderFor(kind: string, index?: number): string {
  const base = PLACEHOLDER_BASE[kind] ?? "REDACTED";
  return index !== undefined ? `[${base}_${index}]` : `[${base}]`;
}

/** Student-facing label for a category row; review rows prefer REVIEW_LABELS, and an unknown kind shows its raw id rather than throwing. */
export function labelFor(kind: string, disposition: "hidden" | "review"): string {

  if (disposition === "review" && REVIEW_LABELS[kind]) return REVIEW_LABELS[kind];
  return KIND_LABELS[kind] ?? kind;
}
