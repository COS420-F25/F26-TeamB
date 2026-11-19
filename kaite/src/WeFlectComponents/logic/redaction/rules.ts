/**
 * The ordered Layer A rule table. ARRAY ORDER = PRIORITY (first-claim-wins), so:
 *  - composites that contain other identifiers come before their parts
 *    (creds-URL before IP/email; repo URL before bare handle; specific keys before
 *    the loose api-key rule; ORCID before the generic id-cue rule),
 *  - the placeholder guard comes first so re-running on redacted text is a no-op,
 *  - path rules come after URL rules (a lookbehind also protects `https://` from the
 *    drive-letter rules).
 *
 * Provenance: ports every pattern in PATTERNS + EXTRA_PATTERNS of
 * agents/ai-redaction-agent-prototype/.claude/skills/redacting-usage-logs/redactlib.py
 * (its embedded fallback table; the upstream parse_claude_logs.py it prefers is not in
 * this repo, nor is the ChatGPT scanner whose extras the phone rule inherited), plus
 * upgrades grounded in the sighted corpora
 * (agents/ai-redaction-agent-prototype/fixtures/EXPECTED.md and
 * agents/ai-redaction-agent-prototype/data/interactions/simulated-not-actual/*.key.md).
 * Entry comments once carried the Python table's `#N` indexes; they no longer matched
 * this array and were dropped.
 *
 * Confidence tiers (all above labels.ts AUTO_HIDE_THRESHOLD = 0.8, so within Layer A
 * they document certainty rather than decide anything — array order resolves
 * overlaps): 0.99 a vendor prefix whose shape cannot occur in prose (ghp_, AKIA, hf_,
 * PEM); 0.98 distinctive but shorter / reused prefixes (AIza, Stripe, Slack, JWT) and
 * e-mail; 0.95 shapes with a plausible non-secret reading (plain sk-, user-, ORCID,
 * public IPv4, participant id); 0.9 cue-dependent or loose shapes (query tokens,
 * obfuscated e-mail, phone, IPv6, address, named link); 0.85 cue-word secrets, cue-gated
 * ids and the entropy floor. The exact values are not otherwise justified.
 *
 * Authored as regex literals (never strings) to avoid double-backslash bugs; the
 * engine re-creates each with the g (+d) flags, so authored objects never leak
 * lastIndex state.
 */

import type { EntitySeed, RuleContext, RuleSpec } from "./engine";
import { PRODUCT_NAMES } from "./gazetteers";
import {
  RX_CC_PROJECTDIR,
  RX_POSIX_DEEP,
  RX_POSIX_HOME,
  RX_TILDE,
  RX_WINDOWS_ANY,
  RX_WINDOWS_USER,
  ccProjectDirExtractor,
  pathEntityExtractor,
  pathSegmentsOnlyExtractor,
} from "./paths";

// Digits in a string: the phone and id rules gate on digit COUNT rather than on shape,
// so formatting variants (spaces, dashes, dots) cannot change the verdict.
const digitCount = (s: string): number => (s.match(/\d/g) ?? []).length;

/**
 * Role-based mailboxes — publicly listed company contact addresses stay visible.
 * A personal mailbox (jordan.rivera@…) is still redacted; only the generic
 * front-door addresses are exempt. Compared with separators stripped, so
 * "no-reply" and "no_reply" both match.
 */
const PUBLIC_MAILBOXES = new Set([
  "info", "support", "contact", "sales", "hello", "help", "hi", "team", "office",
  "admin", "billing", "orders", "service", "services", "careers", "jobs", "press",
  "media", "marketing", "partnerships", "feedback", "enquiries", "inquiries",
  "noreply", "donotreply", "notifications", "newsletter", "security", "privacy",
  "legal", "abuse", "webmaster", "postmaster", "hr", "recruiting",
]);

function isPublicMailbox(email: string): boolean {
  const local = (email.split("@")[0] ?? "").toLowerCase();
  const base = local.split("+")[0] ?? "";
  return PUBLIC_MAILBOXES.has(base.replace(/[-_.]/g, ""));
}

/**
 * IPv4 ranges that identify no one and are kept verbatim:
 *  - 0.0.0.0/8       unspecified / "all interfaces"
 *  - 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16   RFC 1918 private
 *  - 127.0.0.0/8     loopback
 *  - 169.254.0.0/16  link-local (incl. cloud metadata 169.254.169.254)
 *  - 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24   RFC 5737 documentation
 *  - 255.255.255.255 broadcast
 */
function isNonIdentifyingIPv4(ip: string): boolean {
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((n) => Number.isNaN(n))) return false;
  const [a, b, c] = o as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (ip === "255.255.255.255") return true;
  return false;
}

/** IPv6 equivalents: loopback `::1`, link-local `fe80::/10`, RFC 3849 docs `2001:db8::/32`, ULA `fc00::/7`. */
function isNonIdentifyingIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return true;
  if (/^fe[89ab][0-9a-f]:/.test(v)) return true;
  if (/^2001:0*db8:/.test(v)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(v)) return true;
  return false;
}

/**
 * An address written with a prefix length (`8.8.8.0/24`) names a network, not a host.
 * Only CIDR marks a network: a bare `122.0.0.0` is still treated as a host (operator
 * decision — recorded in the report's limitations).
 */
function isCidrNetwork(m: RegExpExecArray, text: string): boolean {
  return /^\/\d{1,3}(?![\d.])/.test(text.slice(m.index + m[0].length, m.index + m[0].length + 4));
}

/**
 * A public dotted quad that reads as a SOFTWARE VERSION rather than a host. Such values
 * are not hidden but routed to review (kind "ip", below the gate) so the operator sees
 * them. Signals, in priority order:
 *  1. A `:port` immediately after beats every version cue → it is a host (false).
 *  2. Co-occurrence: another, different dotted numeric value in the same field shares
 *     the first two components (`1.27.2.3` next to `1.27.2.2` or `1.27.2`) → version.
 *     Sequential releases do this; unrelated public hosts rarely do.
 *  3. An EXPLICIT cue immediately before: `v`, `version`/`ver`, `release`, `tag`,
 *     `pin(ned|s) [X] (to|at)`, `@`, a pip specifier (`==`, `>=`, `<=`, `~=`, `!=`), or a
 *     known product/language name (`python 3.12.7.1`). Vague words ("on", "at",
 *     "wants") are not cues — co-occurrence carries those cases.
 *  4. A version-only NOUN in the same sentence — `lockfile`, `toolchain`, `changelog`,
 *     `semver`, `dependenc(y|ies)`, `package.json`, `requirements.txt`, `pyproject`,
 *     `Cargo.toml`: words that never describe a host.
 *  5. Corpus consistency (via RuleContext.versionLiterals, filled by a session pre-pass):
 *     a literal judged version-like in ANY message is version-like in every message —
 *     `1.27.2.3` cannot be a version in turn 1 and a host in turn 3.
 */
const RX_VERSION_CUE_BEFORE =
  /(?:\bv|\bver(?:sion)?\s*[:=]?\s*|\brelease\s*|\btag\s*|\bpin(?:s|ned)?\s+(?:\S+\s+)?(?:to\s+|at\s+)?|@|==|>=|<=|~=|!=)\s*$/i;
const RX_VERSION_NOUN_IN_SENTENCE =
  /\b(?:lockfile|toolchain|changelog|semver|dependenc(?:y|ies)|package\.json|requirements\.txt|pyproject|cargo\.toml)\b/i;
/**
 * Host-side words: when one shares the quad's sentence, the quad is a host no matter
 * what version signals are present (except that a :port has already decided it).
 * `41.86.0.0 … with no prefix length` and `route table` are the canonical case.
 */
const RX_HOST_CUE_IN_SENTENCE =
  /\b(?:route table|routing table|prefix length|netmask|subnet|gateway|ssh|scp|sftp|ping|traceroute|telnet|curl|wget|nslookup|dig|ifconfig|ip addr|bind(?:s|ing)?|listen(?:s|ing)?|host(?:s|name)?|admin panel|health ?check|endpoint|dns|firewall|allowlist|whitelist|blocklist)\b/i;

/**
 * Sentence containing [start, end). Boundaries: `.`/`!`/`?`/`;` followed by whitespace or
 * end, a real line break, or a LITERAL backslash-n (exporters and harnesses sometimes
 * hand over `\n` as two characters — a splitter that only knows real newlines would let
 * one sentence's cue words leak into the next paragraph).
 */
function sentenceBounds(text: string, start: number, end: number): [number, number] {
  const rx = /[.!?;](?=\s|\\n|$)|\r?\n|\\n/g;
  let s = 0;
  let e = text.length;
  let b: RegExpExecArray | null;
  while ((b = rx.exec(text)) !== null) {
    const bEnd = b.index + b[0].length;
    if (bEnd <= start) s = bEnd;
    else if (b.index >= end) {
      e = b.index;
      break;
    }
  }
  return [s, e];
}

/**
 * `validate` gate for ip_v4 / ip_v4_version (also used by the session pre-pass): true
 * when a public dotted quad reads as a software version. The five signals and their
 * priority are documented above RX_VERSION_CUE_BEFORE; the checks below run in that
 * order, host evidence first, because a host verdict must win on conflict (the safe
 * direction: a hidden version string costs less than a visible host).
 */
export function isVersionLike(m: RegExpExecArray, text: string, ctx: RuleContext = {}): boolean {
  const start = m.index;
  const end = start + m[0].length;
  if (/^:\d{1,5}(?!\d)/.test(text.slice(end, end + 6))) return false;
  if (ctx.hostLiterals?.has(m[0])) return false;
  const [sentStart, sentEnd] = sentenceBounds(text, start, end);
  const sentence = text.slice(sentStart, sentEnd);
  if (RX_HOST_CUE_IN_SENTENCE.test(sentence)) return false;
  if (ctx.versionLiterals?.has(m[0])) return true;

  const parts = m[0].split(".");
  const prefix = `${parts[0]}.${parts[1]}.`;
  // Whole dotted values only — never a four-label fragment of a longer one (`7.8.8.8.8.8`).
  const rxDotted = /(?<![\d.])\b\d+(?:\.\d+){1,3}\b(?!\.\d)/g;
  let other: RegExpExecArray | null;
  while ((other = rxDotted.exec(text)) !== null) {
    if (other.index === start) continue;
    if (other[0] === m[0]) continue;
    if ((other[0] + ".").startsWith(prefix)) return true;
  }

  // 32 chars of look-back: room for `pinned the toolchain to ` or a product name plus
  // a word, short enough that a cue from the previous clause does not apply.
  const before = text.slice(Math.max(0, start - 32), start);
  if (RX_VERSION_CUE_BEFORE.test(before)) return true;
  const word = /([A-Za-z][\w+.-]*)\s+$/.exec(before)?.[1]?.toLowerCase();
  if (word && PRODUCT_NAMES.has(word)) return true;
  if (RX_VERSION_NOUN_IN_SENTENCE.test(sentence)) return true;
  return false;
}

/** A quad its own context marks as a HOST: a :port after it, or a host-side word in its sentence. */
function isHostMarked(m: RegExpExecArray, text: string): boolean {
  const end = m.index + m[0].length;
  if (/^:\d{1,5}(?!\d)/.test(text.slice(end, end + 6))) return true;
  const [s, e] = sentenceBounds(text, m.index, end);
  return RX_HOST_CUE_IN_SENTENCE.test(text.slice(s, e));
}

/**
 * The public-host quad shape shared by ip_v4 / ip_v4_version.
 * NOTE: this exact regex is written out three times (here, ip_v4, ip_v4_version). The
 * rules could reference this object (the engine re-creates a regex from `.source`
 * anyway); the triplication is historical. All three MUST stay byte-identical, or the
 * pre-pass and the rules would judge different literals.
 */
const RX_IPV4_QUAD =
  /(?<![\d.])(?<=^|[^A-Za-z0-9_.]|\bv)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b(?!\.\d)/g;

/**
 * Session pre-pass over one field: public, non-CIDR dotted quads judged on local
 * evidence as `version` (kept for review) or `host` (explicitly host-marked). The session
 * unions these across all fields; a literal in both sets is a HOST everywhere — one
 * literal, one disposition, and the safe one on conflict.
 */
export function collectVersionJudgements(text: string): { version: string[]; host: string[] } {
  const version: string[] = [];
  const host: string[] = [];
  RX_IPV4_QUAD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RX_IPV4_QUAD.exec(text)) !== null) {
    if (isNonIdentifyingIPv4(m[0]) || isCidrNetwork(m, text)) continue;
    if (isHostMarked(m, text)) host.push(m[0]);
    else if (isVersionLike(m, text)) version.push(m[0]);
  }
  return { version, host };
}

/**
 * Study participant identifier. PROVISIONAL FORMAT — seeded from the synthetic corpus
 * (`p_014`); the authoritative shape must come from the IRB protocol, not from code.
 * Change this one constant when confirmed.
 */
export const PARTICIPANT_ID_PATTERN = /\bp_\d{3}\b/;

/** The match's line mentions "participant" and the match is not inside inline/fenced code. */
function isParticipantContext(m: RegExpExecArray, text: string): boolean {
  const lineStart = text.lastIndexOf("\n", m.index) + 1;
  const lineEndIdx = text.indexOf("\n", m.index);
  const line = text.slice(lineStart, lineEndIdx === -1 ? text.length : lineEndIdx);
  if (!/participant/i.test(line)) return false;
  const before = text.slice(0, m.index);
  const fences = (before.match(/```/g) ?? []).length;
  if (fences % 2 === 1) return false;
  const ticksOnLine = (text.slice(lineStart, m.index).match(/`/g) ?? []).length;
  return ticksOnLine % 2 === 0;
}

/**
 * Cue-independent floor for secrets: a long token that mixes upper case, lower case,
 * and digits with frequent class changes is random material, not a word, a hash, or a
 * UUID (those are single-case hex). Vendor prefixes NAME what is found; they cannot be
 * the catching mechanism because prefix lists rot. Thresholds: ≥32 chars, ≥2 digits,
 * both cases, ≥8 class transitions (a 40-char random base62 token has ~25; a word with a
 * year appended has ~4). Never fires right after `base64,` (data URIs).
 */
function isHighEntropyToken(m: RegExpExecArray, text: string): boolean {
  const t = m[0];
  if (!/[A-Z]/.test(t) || !/[a-z]/.test(t) || (t.match(/\d/g) ?? []).length < 2) return false;
  if (/base64,$/.test(text.slice(Math.max(0, m.index - 7), m.index))) return false;
  const cls = (ch: string): number => (/\d/.test(ch) ? 0 : /[a-z]/.test(ch) ? 1 : /[A-Z]/.test(ch) ? 2 : -1);
  let transitions = 0;
  let prev = -1;
  for (const ch of t) {
    const c = cls(ch);
    if (c === -1) continue;
    if (prev !== -1 && c !== prev) transitions++;
    prev = c;
  }
  return transitions >= 8;
}

/** keptNote text for the documentation-placeholder guards — shown verbatim on the review screen's Preserved list and in the findings report. */
export const PLACEHOLDER_NOTE = "documentation placeholder, kept as-is (not a live secret)";

/**
 * Typed placeholder for a documentation placeholder the OPERATOR chose to hide after all
 * (review screen: "Redact?" ticked on a Preserved row → RedactOptions.redactLiterals).
 * Mirrors the vendor rules' names by prefix, so `sk-ant-…EXAMPLE…` becomes
 * [ANTHROPIC_API_KEY_N] exactly as a live key would; cue-shaped values fall back to
 * their cue's type, anything else to [SECRET_N].
 */
export function forcedKeepPlaceholder(token: string): string {
  const t = token.replace(/^</, "");
  if (/^sk-ant-/i.test(t)) return "[ANTHROPIC_API_KEY]";
  if (/^(?:sk|pk|rk)_(?:live|test)_/i.test(t)) return "[STRIPE_KEY]";
  if (/^sk-/i.test(t)) return "[OPENAI_API_KEY]";
  if (/^(?:gh[pousr]_|github_pat_)/i.test(t)) return "[GITHUB_TOKEN]";
  if (/^glpat-/i.test(t)) return "[GITLAB_TOKEN]";
  if (/^npm_/i.test(t)) return "[NPM_TOKEN]";
  if (/^AIza/.test(t)) return "[GOOGLE_API_KEY]";
  if (/^AKIA/.test(t)) return "[AWS_ACCESS_KEY_ID]";
  if (/^hf_/i.test(t)) return "[HUGGINGFACE_TOKEN]";
  if (/^xox[bapr]-/i.test(t)) return "[SLACK_TOKEN]";
  if (/passw(?:or)?d/i.test(t)) return "[PASSWORD]";
  if (/token/i.test(t)) return "[TOKEN]";
  if (/key/i.test(t)) return "[API_KEY]";
  return "[SECRET]";
}

// ---------------------------------------------------------------------------
// Type-preserving placeholders. The value leaves, the category stays: a reader still
// sees that a conversation configured a Postgres connection or pasted a GitHub token.
// ---------------------------------------------------------------------------

/** `postgres://…` → `[POSTGRESQL_URL]`, `mongodb+srv://…` → `[MONGODB_URL]`, `https://…` → `[HTTPS_URL]`. */
function schemePlaceholder(url: string): string {
  const scheme = (/^([a-z][a-z0-9+.-]*):\/\//i.exec(url)?.[1] ?? "url").toLowerCase();
  const base = scheme.split("+")[0] ?? scheme;
  const norm = base === "postgres" || base === "psql" ? "postgresql" : base;
  return `[${norm.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_URL]`;
}

/** `-----BEGIN RSA PRIVATE KEY-----…` → `[RSA_PRIVATE_KEY]`; `-----BEGIN PUBLIC KEY-----` → `[PUBLIC_KEY]`. */
function pemPlaceholder(block: string): string {
  const header = /-----BEGIN ([A-Z ]+?)-----/.exec(block)?.[1] ?? "PRIVATE KEY";
  return `[${header.trim().replace(/ +/g, "_")}]`;
}

/**
 * Loose-cue secrets take their cue's type: `password: …` → `[PASSWORD]`, `Bearer …` →
 * `[BEARER_TOKEN]`, `AWS_SECRET_ACCESS_KEY=…` → `[SECRET_ACCESS_KEY]`,
 * `OAUTH_CLIENT_SECRET: …` → `[CLIENT_SECRET]`. Must list the same cues as api_key_loose.
 */
const RX_CUE = /^(secret[_-]?access[_-]?key|secret[_-]?key|client[_-]?secret|signing[_-]?key|private[_-]?key|access[_-]?key(?:[_-]?id)?|api[_-]?key|secret|token|password|bearer)/i;

/** Cue with separators stripped → placeholder. */
const CUE_PLACEHOLDERS: Readonly<Record<string, string>> = {
  secretaccesskey: "[SECRET_ACCESS_KEY]",
  secretkey: "[SECRET_KEY]",
  clientsecret: "[CLIENT_SECRET]",
  signingkey: "[SIGNING_KEY]",
  privatekey: "[PRIVATE_KEY]",
  accesskey: "[ACCESS_KEY]",
  accesskeyid: "[ACCESS_KEY]",
  apikey: "[API_KEY]",
  secret: "[SECRET]",
  token: "[TOKEN]",
  password: "[PASSWORD]",
  bearer: "[BEARER_TOKEN]",
};

function cuePlaceholder(matched: string): string {
  const key = (RX_CUE.exec(matched)?.[1] ?? "secret").toLowerCase().replace(/[-_]/g, "");
  return CUE_PLACEHOLDERS[key] ?? "[SECRET]";
}

// Tested in order against the WHOLE id_cue match (cue phrase + value); first hit wins.
// The cue stems are mutually disjoint today, so the order is not load-bearing yet —
// but `/member/`, `/account/` and `/licen/` are deliberately broad stems ("membership
// no", "bank account number", licence / license) rather than exact phrases, so any new
// entry whose cue contains one of those stems must be placed ABOVE them.
const ID_CUE_PLACEHOLDERS: ReadonlyArray<[RegExp, string]> = [

  [/orcid/i, "[ORCID]"],
  [/university id|student id/i, "[STUDENT_ID]"],
  [/employee id/i, "[EMPLOYEE_ID]"],
  [/member/i, "[MEMBER_ID]"],
  [/passport/i, "[PASSPORT_NUMBER]"],
  [/frequent[- ]flyer/i, "[FREQUENT_FLYER_NUMBER]"],
  [/sort code/i, "[SORT_CODE]"],
  [/routing/i, "[ROUTING_NUMBER]"],
  [/account/i, "[ACCOUNT_NUMBER]"],
  [/national insurance/i, "[NATIONAL_INSURANCE_NUMBER]"],
  [/ssn|social security/i, "[SSN]"],
  [/licen/i, "[DRIVERS_LICENSE_NUMBER]"],
];

/** Cue-gated IDs take their cue's type: `student id: …` → `[STUDENT_ID]`, `ssn …` → `[SSN]`. */
function idPlaceholder(matched: string): string {
  for (const [rx, ph] of ID_CUE_PLACEHOLDERS) if (rx.test(matched)) return ph;
  return "[ID]";
}

/**
 * A key-shaped token is a documentation placeholder when it carries a marker no real
 * credential would: EXAMPLE, SAMPLE, PLACEHOLDER, REPLACE(_ME), YOUR, HERE, CHANGE_ME,
 * DO_NOT_USE, DUMMY, FAKE, INSERT, `xxxx`, `..`, `***`, or angle brackets.
 *
 * The marker must be BOUNDED on at least one side — by `-`, `_`, `.`, or the edge of the
 * token — so a marker word buried in a real key's random body does not count:
 * `ghp_Ab3xYourZq9…` (Your between x and Z) and `AKIAFAKE567…` (FAKE between A and 5)
 * are live keys and stay [SECRET]; `hf_YourTokenHere` (Your after `_`, Here at the end),
 * `AKIAIOSFODNN7EXAMPLE` (EXAMPLE at the end) and `sk-ant-api03-EXAMPLE-KEY-DO-NOT-USE`
 * are placeholders. A guard that kept a live key would also ADVERTISE it as safe in the
 * Preserved list, so this errs toward [SECRET].
 *
 * A marker bounded ONLY by the token edge (no delimiter) is weaker evidence — a random
 * 40-char body ends in a given 4-letter word about 1e-6 of the time — so it counts only
 * when the rest of the token is short (< 20 chars: `AKIAIOSFODNN7EXAMPLE`) or a second
 * bounded marker is present (`hf_YourTokenHere`). `ghp_KdLm2Qw…C8vBnHERE` stays [SECRET].
 */
const MARKER = "(?:example|sample|placeholder|replace|your|here|change[-_]?me|do[-_]?not[-_]?use|dummy|fake|insert|x{4,}|\\.{2,}|…|\\*{3,}|<[^>]+>)";
const RX_MARKER_ALL = new RegExp(MARKER, "gi");
const DELIMS = new Set(["-", "_", "."]);

function hasPlaceholderMarker(token: string): boolean {
  let edgeBounded = 0;
  let markerLen = 0;
  RX_MARKER_ALL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RX_MARKER_ALL.exec(token)) !== null) {
    if (m[0].length === 0) {
      RX_MARKER_ALL.lastIndex++;
      continue;
    }
    const before = token[m.index - 1];
    const after = token[m.index + m[0].length];
    if ((before !== undefined && DELIMS.has(before)) || (after !== undefined && DELIMS.has(after))) {
      return true; // delimiter-bounded: decisive
    }
    if (before === undefined || after === undefined) {
      edgeBounded++;
      markerLen += m[0].length;
    }
  }
  if (edgeBounded === 0) return false;
  return edgeBounded >= 2 || token.length - markerLen < 20;
}

/** Weak person-variant seed from an email local part ("jordan.rivera" ties to the name). */
function emailLocalSeed(m: RegExpExecArray): EntitySeed[] {
  const local = m[0].split("@")[0] ?? "";
  if (local.length < 3) return [];
  return [{ kindHint: "person-variant", value: local, weak: true }];
}

export const LAYER_A_RULES: RuleSpec[] = [
  // Idempotency guard: existing placeholders claim themselves and render unchanged.
  {
    id: "placeholder_guard",
    kind: "",
    // REDACTED allows digits mid-token ([REDACTED_PERSON_1_USER] from prior runs).
    // Typed placeholders ([POSTGRESQL_URL], [GITHUB_TOKEN], [RSA_PRIVATE_KEY],
    // [STUDENT_ID], [IPV4]…) are matched by suffix so new types need no edit here.
    pattern: /\[(?:NAME|EMAIL|PATH|SECRET|PHONE|URL|IP|IPV4|IPV6|ID|ORG|LOCATION|ORCID|SSN|PASSWORD|TOKEN|API_KEY|JWT|PARTICIPANT|REDACTED[A-Z0-9_]*|[A-Z0-9]+(?:_[A-Z0-9]+)*_(?:URL|KEY|TOKEN|ID|SECRET|PASSWORD|NUMBER|CODE))(?:_\d+)?\]/,
    confidence: 1,
    noop: true,
  },
  // DOCUMENTATION PLACEHOLDERS: `sk-ant-api03-EXAMPLE-KEY-DO-NOT-USE`,
  // `sk_test_EXAMPLE_REPLACE_ME`, `AIzaSy-YOUR-API-KEY-HERE`, `sk-ant-...xxxx`,
  // `token: REPLACE_ME`, `<your-slack-token>`. Not live secrets — redacting them as
  // [SECRET] hides that a conversation was about *setting up* a key. Claimed (so the
  // key-family / loose api-key / URL rules can't bite a piece of them), rendered
  // unchanged, and reported as deliberate keeps via keptNote. Three shapes:
  //   key-prefixed token carrying a placeholder marker; cue-word + marker-bearing
  //   value; angle-bracket credential placeholder. See hasPlaceholderMarker.
  {
    id: "placeholder_secret",
    kind: "",
    // A `.` is consumed only when another token character follows, so `…-USE.` at the
    // end of a sentence leaves its period to the prose (the report shows the bare token).
    pattern: /(?:\b(?:sk|hf|gh[pousr]|pk|rk|glpat|npm|xox[bapr])[-_]|\bAKIA|\bAIza)(?:[A-Za-z0-9_…*<>-]|\.(?=[A-Za-z0-9_.…*<>-]))*/,
    validate: (m) => hasPlaceholderMarker(m[0]),
    confidence: 1,
    noop: true,
    keptNote: PLACEHOLDER_NOTE,
  },
  {
    id: "placeholder_cue",
    kind: "",
    // Value is either a whole `<…>` (may contain spaces: `secret=<insert secret here>`)
    // or a bare marker-bearing token.
    pattern: /(?:api[_-]?key|secret|token|password|passwd|bearer|key)["':=\s]+(<[^>\n]*>|[A-Za-z0-9_.…*<>-]{6,})/i,
    claimGroup: 1,
    validate: (m) => hasPlaceholderMarker(m[1] ?? ""),
    confidence: 1,
    noop: true,
    keptNote: PLACEHOLDER_NOTE,
  },
  {
    id: "placeholder_angle",
    kind: "",
    // Contents may contain spaces (`<insert secret here>`). An XML/HTML element whose
    // NAME happens to be a cue word (`<key>abc</key>`, `<secret-widget>…</secret-widget>`)
    // is not a placeholder: reject when a matching closing tag exists in the field.
    pattern: /<([\w -]*(?:your|token|key|secret|password|passwd|credential|api)[\w -]*)>/i,
    validate: (m, text) => !text.includes(`</${m[1] ?? ""}>`),
    confidence: 1,
    noop: true,
    keptNote: PLACEHOLDER_NOTE,
  },
  // PEM PRIVATE key blocks: swallow the whole body when present, not just the
  // header. Zero or more type words (`-----BEGIN PRIVATE KEY-----` PKCS#8,
  // `-----BEGIN RSA PRIVATE KEY-----`, `-----BEGIN OPENSSH PRIVATE KEY-----`).
  // PUBLIC KEY and CERTIFICATE blocks are public material and are KEPT.
  {
    id: "ssh_private_block",
    kind: "secret",
    pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----(?:[\s\S]*?-----END (?:[A-Z]+ )*PRIVATE KEY-----)?/,
    confidence: 0.99,
    placeholder: (m) => pemPlaceholder(m[0]),
  },
  // Public PEM material (PUBLIC KEY, CERTIFICATE, CERTIFICATE REQUEST): kept — claimed
  // silently so the entropy floor cannot bite the base64 body.
  {
    id: "pem_public_guard",
    kind: "",
    pattern: /-----BEGIN (?:[A-Z]+ )*(?:PUBLIC KEY|CERTIFICATE(?: REQUEST)?)-----[\s\S]*?-----END (?:[A-Z]+ )*(?:PUBLIC KEY|CERTIFICATE(?: REQUEST)?)-----/,
    confidence: 1,
    noop: true,
  },
  // JWTs: three base64url segments. Often carry an email or user id in the payload.
  {
    id: "jwt",
    kind: "secret",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
    confidence: 0.98,
    placeholder: "[JWT]",
  },
  // Credentials-in-URL, widened from `https?` to any scheme (postgres://, mysql://)
  // and extended past the `@` so the embedded host/IP/db is one claim. The user part
  // may be EMPTY (`redis://:password@host`, the standard Redis/Memcached form) —
  // otherwise the email rule would win on `password@host` and misclassify it.
  {
    id: "url_with_creds",
    trimTrailingPunct: true,
    kind: "url-token",
    pattern: /(?<![\w.-])[a-z][a-z0-9+.-]*:\/\/[^/\s:@]*:[^@\s]+@[^\s"'()[\]<>]*/i,
    confidence: 0.98,
    placeholder: (m) => schemePlaceholder(m[0]),
    entity: (m) => {
      const user = /:\/\/([^/\s:@]+):/.exec(m[0])?.[1];
      return user && user.length >= 3
        ? [{ kindHint: "person-username", value: user, weak: true }]
        : [];
    },
  },
  // Credential-in-query links, BEFORE the bare token families and the loose
  // api-key rule: a link whose credential is also a recognizable key shape
  // (`?access_key=AKIA…`, `?token=ghp_…`) is masked as one [URL], not as a live link
  // with only its value swapped for [SECRET]. Parameter names cover tokens, keys,
  // OAuth codes, passwords / meeting passcodes (`pwd=`), and cloud signed-URL
  // signatures; the match then runs to the end of the link so `&state=…` sits inside
  // the placeholder, not dangling after it.
  {
    id: "url_token_query",
    trimTrailingPunct: true,
    kind: "url-token",
    pattern: /https?:\/\/[^\s"'()[\]<>]*[?&](?:token|key|sig|signature|auth|apikey|api_key|access_token|access_key|client_secret|secret|private_token|code|jwt|password|passwd|pwd|x-goog-signature|x-amz-signature|x-amz-security-token)=[^\s"'&()[\]<>]+[^\s"'()[\]<>]*/i,
    confidence: 0.9,
    placeholder: (m) => schemePlaceholder(m[0]),
  },
  // Vendor token families (verbatim ports of the Python table plus additions). Each
  // names what it found via a typed placeholder; see the header for the confidence tiers.
  { id: "github_pat", kind: "secret", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/, confidence: 0.99, placeholder: "[GITHUB_TOKEN]" },
  { id: "github_fine_pat", kind: "secret", pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}/, confidence: 0.99, placeholder: "[GITHUB_TOKEN]" },
  { id: "gitlab_pat", kind: "secret", pattern: /\bglpat-[A-Za-z0-9_-]{20,}/, confidence: 0.99, placeholder: "[GITLAB_TOKEN]" },
  { id: "npm_token", kind: "secret", pattern: /\bnpm_[A-Za-z0-9]{30,}/, confidence: 0.99, placeholder: "[NPM_TOKEN]" },
  { id: "google_api_key", kind: "secret", pattern: /\bAIza[0-9A-Za-z_-]{35}/, confidence: 0.98, placeholder: "[GOOGLE_API_KEY]" },
  { id: "anthropic_key", kind: "secret", pattern: /sk-ant-[A-Za-z0-9_-]{20,}/, confidence: 0.99, placeholder: "[ANTHROPIC_API_KEY]" },
  // Stripe: sk_/pk_/rk_ + live_/test_ (underscores). Live and test keys alike — a test
  // key still authorizes API calls against the account.
  { id: "stripe_key", kind: "secret", pattern: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/, confidence: 0.98, placeholder: "[STRIPE_KEY]" },
  // The label must not mislead: only `sk-proj-…` and plain `sk-<alnum>` are OpenAI;
  // other `sk-` variants (`sk-live-…`, `sk-or-…`) get the generic [API_KEY].
  {
    id: "openai_key",
    kind: "secret",
    pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
    confidence: 0.95,
    placeholder: (m) => (/^sk-(?:proj-[A-Za-z0-9_-]+|[A-Za-z0-9]{32,})$/.test(m[0]) ? "[OPENAI_API_KEY]" : "[API_KEY]"),
  },
  { id: "aws_access", kind: "secret", pattern: /AKIA[0-9A-Z]{16}/, confidence: 0.99, placeholder: "[AWS_ACCESS_KEY_ID]" },
  { id: "hf_token", kind: "secret", pattern: /hf_[A-Za-z0-9]{20,}/, confidence: 0.99, placeholder: "[HUGGINGFACE_TOKEN]" },
  // OpenAI `user-…` account ids, which appear in exported ChatGPT metadata and API
  // error bodies; they identify the account, not a request.
  { id: "openai_user_id", kind: "secret", pattern: /\buser-[A-Za-z0-9]{20,}\b/, confidence: 0.95, placeholder: "[OPENAI_USER_ID]" },
  // Slack bot/app/user/refresh tokens (`xoxb-2842719504-3910284756-KdLm9Qw…`). Added with
  // the placeholder guard so a live token whose body merely contains a marker word is
  // still caught once the guard (correctly) declines it.
  { id: "slack_token", kind: "secret", pattern: /\bxox[bapr]-[A-Za-z0-9-]{20,}/, confidence: 0.98, placeholder: "[SLACK_TOKEN]" },
  // Loose api-key: the claimGroup keeps the cue word ("token: [SECRET]"), fixing
  // the Python wart where the prefix was swallowed. Inline (?i) became the i flag.
  {
    id: "api_key_loose",
    kind: "secret",
    // Compound cues first so `AWS_SECRET_ACCESS_KEY=` is read as one cue (a bare `secret`
    // would stop at the `_`); each cue types its placeholder via cuePlaceholder.
    pattern: /(?:secret[_-]?access[_-]?key|secret[_-]?key|client[_-]?secret|signing[_-]?key|private[_-]?key|access[_-]?key(?:[_-]?id)?|api[_-]?key|secret|token|password|bearer)["':=\s]+([A-Za-z0-9_\-/.]{8,})/i,
    claimGroup: 1,
    // A credential has a digit in it or is long; a plain word after the cue
    // ("Secret 'bananagrams'", "secret retrieval") is prose, not a key.
    validate: (m) => /\d/.test(m[1] ?? "") || (m[1] ?? "").length >= 20,
    confidence: 0.85,
    placeholder: (m) => cuePlaceholder(m[0]),
  },
  // SCP-style remotes and targets — `git@github.com:org/repo.git`,
  // `deploy@host:/srv/data`, `deploy@host:~/inbox` — are `user@host`, not a mailbox.
  // No scheme, so the email rule's `/` lookbehind never fires; this noop GUARD claims
  // the `user@host` part first (kept visible, not counted) whenever a `:` + PATH
  // follows (`/…`, `~…`, or `segment/…`). Present in nearly every Claude Code session
  // (`git clone`, `git remote -v`), so without it EMAIL numbering is polluted on real
  // logs. Deliberately NO port branch: ssh/scp take ports via -p/-P, never
  // `user@host:port`, and a digits branch swallowed real addresses in prose
  // (`p.okonkwo@example.edu:14:30`, `l.osei@example.edu:2026 cohort`).
  {
    id: "scp_user_host",
    kind: "",
    pattern: /(?<![\w.-])[\w.+-]+@[\w-]+(?:\.[\w-]+)*(?=:(?:\/|~|[\w.-]+\/))/,
    confidence: 1,
    noop: true,
  },
  // Email (numbered [EMAIL_N]); \w upgraded to \p{L}\p{N} (JS \w is ASCII-only).
  {
    id: "email",
    kind: "email",
    // Lookbehind: never start right after `/` (the `user@host` of a password-less
    // URL such as `ftp://deploy@files.internal` is not a mailbox) nor mid-token
    // (so the engine cannot sidestep that by matching `eploy@files.internal`).
    pattern: /(?<![/\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/u,
    // Public role-based company mailboxes (support@, info@, noreply@…) stay visible;
    // rejecting the match (rather than noop-claiming) also skips the person seeding.
    // The final domain label must contain a letter: `pkg@1.0.0` is an npm version.
    validate: (m) => !isPublicMailbox(m[0]) && /\p{L}/u.test(m[0].slice(m[0].lastIndexOf(".") + 1)),
    confidence: 0.98,
    entity: emailLocalSeed,
  },
  // Obfuscated email: `reuben [dot] castellano [at] contoso-research [dot] org`.
  {
    id: "email_obfuscated",
    kind: "email",
    pattern: /[\w.+-]+(?:\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\))\s*[\w-]+)*\s*(?:\[\s*at\s*\]|\(\s*at\s*\))\s*[\w-]+(?:\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\))\s*[\w-]+)+/i,
    confidence: 0.9,
    entity: (m) => {
      const pre = m[0].split(/\s*(?:\[\s*at\s*\]|\(\s*at\s*\))\s*/i)[0] ?? "";
      const tokens = pre.split(/\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\))\s*|[._+-]/i).filter((t) => t.length >= 2);
      return tokens.length >= 2
        ? [{ kindHint: "person-variant", value: tokens.join(" "), weak: true }]
        : [];
    },
  },
  // URL families. Only CREDENTIAL-BEARING URLs are redacted (operator
  // decision): user:pass@ connection strings (url_with_creds) and credential-in-query links
  // (url_token_query). Everything else — share links, org invites, internal hosts,
  // deployed apps, public websites — is kept. Share links / invites / hosts are noop
  // GUARDS (claimed so nothing bites fragments out of an opaque id, rendered
  // unchanged); GitHub / Hugging Face URLs are seed-only so a known owner handle
  // inside them is masked like a path username (see the Hugging Face / GitHub rules).
  {
    id: "google_doc",
    trimTrailingPunct: true,
    kind: "",
    pattern: /(?:https?:\/\/)?docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/[A-Za-z0-9_-]+[^\s"'()[\]<>]*/,
    confidence: 1,
    noop: true,
  },
  // Claude organisation invite links: the invite id is opaque; a guard so the loose
  // rules cannot nibble at it (kept visible, not counted).
  { id: "claude_org", kind: "", pattern: /claude\.ai\/join\/org\/\w+/, confidence: 1, noop: true },
  // Deployed-app URLs (Cloud Run, Railway) are publicly accessible websites — kept
  // visible by operator decision, claimed only so nothing else nibbles at them.
  {
    id: "google_run",
    trimTrailingPunct: true,
    kind: "",
    pattern: /(?:https?:\/\/)?[A-Za-z0-9_-]+-\d{6,}\.us[\w-]*\.run\.app(?:\/[^\s"'()[\]<>]*)?/,
    confidence: 1,
    noop: true,
  },
  {
    id: "railway",
    trimTrailingPunct: true,
    kind: "",
    pattern: /(?:https?:\/\/)?[\w-]+\.up\.railway\.app(?:\/[^\s"'()[\]<>]*)?/,
    confidence: 1,
    noop: true,
  },
  // Internal-infrastructure hostnames (`grafana.internal.maxlab.example:3000/...`) —
  // not credential-bearing, kept visible.
  {
    id: "internal_host",
    trimTrailingPunct: true,
    kind: "",
    pattern: /(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)*\.(?:internal|intranet|corp)(?:\.[\w-]+)+(?::\d+)?(?:\/[^\s"'()[\]<>]*)?/i,
    confidence: 1,
    noop: true,
  },
  // Hugging Face / GitHub repo & user URLs: public websites, kept visible.
  // These are SEED-ONLY (like paths): the URL keeps its shape and the handle registers
  // as a weak person alias — so bare `jrivera` in prose ties to [NAME_N] — but the
  // rule claims nothing, which lets the entity sweep mask a handle we already know is
  // the owner's: `github.com/jrivera/app` → `github.com/[NAME_N]/app` when jrivera is
  // also the home-directory user. An unknown handle (`github.com/microsoft/vscode`)
  // stays verbatim: weak seeds never make an entity sweepable on their own.
  {
    id: "huggingface",
    seedOnly: true,
    trimTrailingPunct: true,
    kind: "",
    pattern: /(?:https?:\/\/)?huggingface\.co\/(?:spaces\/)?([A-Za-z0-9_-]+)(?:\/[^\s"'()[\]<>]*)?/,
    confidence: 1,
    entity: (m) =>
      m[1] && m[1].length >= 3 ? [{ kindHint: "person-username", value: m[1], weak: true }] : [],
  },
  {
    id: "github_repo",
    seedOnly: true,
    trimTrailingPunct: true,
    kind: "",
    pattern: /(?:https?:\/\/)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+)/,
    confidence: 1,
    entity: (m) =>
      m[1] && m[1].length >= 3 ? [{ kindHint: "person-username", value: m[1], weak: true }] : [],
  },
  {
    id: "github_user",
    seedOnly: true,
    trimTrailingPunct: true,
    kind: "",
    pattern: /(?:https?:\/\/)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/?(?![\w.-])/,
    confidence: 1,
    entity: (m) =>
      m[1] && m[1].length >= 3 ? [{ kindHint: "person-username", value: m[1], weak: true }] : [],
  },
  // Research / member IDs. ORCID first (specific), then the cue-gated generic.
  { id: "orcid", kind: "id", pattern: /\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/, confidence: 0.95, placeholder: "[ORCID]" },
  {
    id: "id_cue",
    kind: "id",
    // Value: optional letter prefix, optional hyphen (`E-44821`), then digits/uppercase.
    pattern: /\b(?:orcid|university id|student id|employee id|member(?:ship)? (?:no|number|id)|passport(?: number| no\.?)?|frequent[- ]flyer(?: number)?|sort code|account(?: number| no\.?)?|routing number|national insurance(?: number)?|ssn|social security number|driver'?s licen[cs]e(?: number)?)\b[\s:#-]*(?:is|was|=)?[\s:#]*([A-Z]{0,4}-?\d[\dA-Z-]{4,}|\d[\d -]{4,}\d)/i,
    claimGroup: 1,
    // The i flag would let [A-Z] match lowercase; require the token itself to be
    // uppercase/digits so hex blob words are not claimed.
    validate: (m) => /^[A-Z0-9][A-Z0-9 -]*$/.test(m[1] ?? "") && digitCount(m[1] ?? "") >= 4,
    confidence: 0.85,
    placeholder: (m) => idPlaceholder(m[0]),
  },
  // Path family (regexes + extractors in paths.ts). Paths are SEED-ONLY:
  // the directory structure is documentation of what was being worked on and stays
  // visible; only the identifying segment is masked, by the entity sweep —
  // `/Users/jrivera/dev/reflect-agent` → `/Users/[NAME_N]/dev/reflect-agent`.
  // Usernames from home-dir shapes are STRONG seeds (they sweep); TitleCase
  // "First Last" segments sweep when the first token is a known first name; every
  // other name-shaped segment is gated by the entity layer.
  { id: "path_windows_user", seedOnly: true,
    trimTrailingPunct: true, kind: "", pattern: RX_WINDOWS_USER, confidence: 1, entity: pathEntityExtractor },
  { id: "path_windows_any", seedOnly: true,
    trimTrailingPunct: true, kind: "", pattern: RX_WINDOWS_ANY, confidence: 1, entity: pathSegmentsOnlyExtractor },
  { id: "path_posix_home", seedOnly: true,
    trimTrailingPunct: true, kind: "", pattern: RX_POSIX_HOME, confidence: 1, entity: pathEntityExtractor },
  { id: "path_cc_projectdir", seedOnly: true, kind: "", pattern: RX_CC_PROJECTDIR, confidence: 1, entity: ccProjectDirExtractor },
  { id: "path_posix_deep", seedOnly: true,
    trimTrailingPunct: true, kind: "", pattern: RX_POSIX_DEEP, confidence: 1, entity: pathSegmentsOnlyExtractor },
  { id: "path_tilde", seedOnly: true,
    trimTrailingPunct: true, kind: "", pattern: RX_TILDE, confidence: 1, entity: pathSegmentsOnlyExtractor },
  // IPs. Only PUBLIC, routable host addresses are redacted. Non-identifying
  // ranges are allowlisted out entirely (not hidden, not counted) — same reasoning as
  // paths: `127.0.0.1:8080`, a Docker network's `172.18.0.2`, or `10.0.0.0/8` in a
  // firewall rule document what was being worked on and identify nobody. See
  // isNonIdentifyingIPv4 / isNonIdentifyingIPv6 for the ranges. v4 is the verbatim
  // octet regex; v6 covers full and `::`-compressed forms; timestamps can never match
  // (3 groups / no `::`).
  {
    id: "ip_v4",
    kind: "ip",
    // Lookbehind / lookahead: never claim four labels out of a longer dotted number
    // (`1.2.3.4.5` is a build id, not `[IP].5`).
    // Lookbehind allows a bare `v` prefix (`v1.27.2.3`, `v8.8.8.8:443`) so such values are
    // decided by isVersionLike rather than silently skipped by the word boundary.
    pattern: /(?<![\d.])(?<=^|[^A-Za-z0-9_.]|\bv)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b(?!\.\d)/,
    validate: (m, text, ctx) => !isNonIdentifyingIPv4(m[0]) && !isCidrNetwork(m, text) && !isVersionLike(m, text, ctx),
    confidence: 0.95,
    placeholder: "[IPV4]",
  },
  // The version-like complement: same shape, kept, surfaced as a review row under "ip".
  {
    id: "ip_v4_version",
    kind: "ip",
    reviewOnly: true,
    // Same shape and lookbehinds as ip_v4 (see there and RX_IPV4_QUAD); the validate is
    // its exact complement, so every public non-CIDR quad lands in exactly one of the two.
    pattern: /(?<![\d.])(?<=^|[^A-Za-z0-9_.]|\bv)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b(?!\.\d)/,
    validate: (m, text, ctx) => !isNonIdentifyingIPv4(m[0]) && !isCidrNetwork(m, text) && isVersionLike(m, text, ctx),
    confidence: 0.5,
  },
  // IPv6: the full 8-group form, or a `::`-compressed form with at least one group
  // BEFORE the `::` — so `::1` never matches here (it is non-identifying anyway) and a
  // timestamp (`12:30:45`, at most 3 groups, no `::`) cannot.
  {
    id: "ip_v6",
    kind: "ip",
    pattern: /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b|\b(?:[A-Fa-f0-9]{1,4}:){1,6}:(?:[A-Fa-f0-9]{1,4}(?::[A-Fa-f0-9]{1,4}){0,5})?\b/,
    validate: (m, text) => !isNonIdentifyingIPv6(m[0]) && !isCidrNetwork(m, text),
    confidence: 0.9,
    placeholder: "[IPV6]",
  },
  // Phones: `+` international (compact, or grouped by space / dot / dash) and the two
  // North-American written forms `(555) 123-4567` / `555-123-4567`; the latter three
  // shapes were inherited from the prototype's ChatGPT scanner (not in this repo).
  // Digit-count validated (10–15, the E.164 range) so `+1 23` or a 20-digit id never
  // counts. No typed placeholder: renders as the kind's [PHONE_N].
  {
    id: "phone",
    kind: "phone",
    pattern: /\+\d{10,15}\b|\+\d{1,3}(?:[ .-]\d{2,6}){2,4}\b|\(\d{3}\)[ ]?\d{3}-\d{4}\b|\b\d{3}-\d{3}-\d{4}\b/,
    validate: (m) => {
      const d = digitCount(m[0]);
      return d >= 10 && d <= 15;
    },
    confidence: 0.9,
  },
  // Structured street address (+ optional city and UK/US postcode) → [LOCATION_N].
  {
    id: "street_address",
    kind: "location",
    // City tokens are TitleCase-with-lowercase so they can never eat a UK postcode
    // prefix ("Leeds LS2 9JT": city stops at "Leeds", postcode group takes "LS2 9JT").
    pattern: /\b\d{1,5} (?:[A-Z][a-z]+ ){0,2}[A-Z][a-z]+ (?:Street|St|Avenue|Ave|Road|Rd|Row|Lane|Ln|Boulevard|Blvd|Drive|Dr|Court|Ct|Place|Pl|Terrace|Crescent|Close)\b\.?(?:,? [A-Z][a-z]+(?: [A-Z][a-z]+)?)?(?:,? ?[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b|,? ?\d{5}(?:-\d{4})?\b)?/,
    confidence: 0.9,
    entity: (m) => [{ kindHint: "location", value: m[0] }],
  },
  // The Python `named_link` pattern: a person's name used as a Google-Docs link
  // anchor. Claims only the name (group 1) and seeds a person entity.
  {
    id: "named_link",
    kind: "name",
    pattern: /\[([A-Z][a-z]+(?:\s+[A-Z][a-zA-Z]+)+)\]\(https?:\/\/docs\.google/,
    claimGroup: 1,
    confidence: 0.9,
    entity: (m) => (m[1] ? [{ kindHint: "person-name", value: m[1] }] : []),
  },
  // Study participant IDs → [PARTICIPANT_N]. Cue-gated (the line mentions
  // "participant", not inside code) so loop variables and test fixtures are untouched;
  // the enclosing path keeps its structure. Format: PARTICIPANT_ID_PATTERN (provisional).
  {
    id: "participant_id",
    kind: "participant",
    pattern: PARTICIPANT_ID_PATTERN,
    validate: isParticipantContext,
    confidence: 0.95,
    placeholder: "[PARTICIPANT]",
  },
  // LAST: the cue-independent entropy floor for secrets. Every specific rule has

  // claimed first; whatever long mixed-case+digit token remains is masked as [SECRET_N].
  {
    id: "secret_entropy",
    kind: "secret",
    pattern: /(?<![A-Za-z0-9_/+=-])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_/+=-])/,
    validate: isHighEntropyToken,
    confidence: 0.85,
    placeholder: "[SECRET]",
  },
];
