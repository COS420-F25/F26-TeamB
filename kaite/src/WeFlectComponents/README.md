# KAIte

React components for reflecting on AI chat logs, with the logic they need. A student imports their AI conversation exports, reviews what gets redacted, sees a profile of their AI use, sets how the conversation should go, and then talks it through with an agent.

This folder is self-contained. Copy it into another project as is.

## What it needs from the host project

- `react` and `react-dom` (written against React 19; uses `useId`, so 18 or later).
- A bundler that handles `.ts`/`.tsx` with the automatic JSX runtime (`"jsx": "react-jsx"`) and can load a CSS file.
- A server for the reflection chat, reached through two functions you pass in (see below).

Nothing in this folder imports from outside it, apart from `react` and `react-dom`.

## Folders

| Folder | Contents |
|---|---|
| `react/` | `WeflectFlow` (the whole flow), `screens/` (full pages), `components/` (small parts), `hooks/`, `lib/` |
| `logic/parser/` | Reads ChatGPT, Claude.ai, Claude Code, Gemini and plain-text exports |
| `logic/redaction/` | Local redaction engine: names, emails, secrets, paths, flagged topics |
| `logic/findings/` | Review decisions, the limitations checklist, the downloadable reports |
| `logic/summary/` | Builds the AI-use profile from the redacted conversations |
| `logic/framing/` | The six conversation-style dimensions and their wording |
| `logic/markdown/` | Small, safe Markdown-to-HTML renderer for the agent's replies |
| `logic/types/` | Shared data shapes |
| `server/` | The `ReflectionServer` contract and a ready-made client for a weflect backend |
| `styles/` | `kaite.css` |

Everything is exported from `index.ts`.

## Quick start

```tsx
import { createRoot } from "react-dom/client";
import { WeflectFlow, createWeflectServer } from "./KAIte";
import "./KAIte/styles/kaite.css";

const server = createWeflectServer(); // POSTs to /api/session and /api/message on this origin

createRoot(document.getElementById("root")!).render(<WeflectFlow server={server} />);
```

`WeflectFlow` props:

| Prop | Purpose |
|---|---|
| `server` (required) | The two server calls. See "The server" below. |
| `logConversation` | Whether the server may log the conversation. Ask for consent in your own UI and pass the answer. Default `true`. |
| `exportGuideHref` | Link to your "how do I export my AI logs" page. The help row on the import screen appears only when set. |
| `onStartError` | Called when the session cannot be created. Default: an alert. |

## Using the pieces separately

`WeflectFlow` is only one way to arrange things. Each screen in `react/screens/` takes its data and callbacks as props, and each small component in `react/components/` knows nothing about the flow, so you can build your own pages from them.

```tsx
<ProfileDashboard summary={summary} onContinue={next} onBack={back} />
<FramingScreen onStart={(framing) => start(framing)} onBack={back} />
<ReflectionChat sessionId={id} sendMessage={server.sendMessage} />
```

Screens stay mounted when hidden (`active={false}`), which is how the file list, review ticks and framing choices survive going Back.

## The server

The components never call `fetch`. Pass in an object with two functions (`server/types.ts`):

```ts
interface ReflectionServer {
  createSession(request: CreateSessionRequest): Promise<string>; // returns a session id
  sendMessage(
    sessionId: string,
    text: string,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void>;
}
```

`createSession` receives `{ reflectionSummary, logConversation, framing }`. It never receives raw conversation text.

`sendMessage` reports the reply through `onEvent`, in order:

| Event | Meaning |
|---|---|
| `{ type: "delta", text }` | The next piece of the reply (Markdown). Any number of these. |
| `{ type: "evidence", text }` | The agent's basis for a question, shown under "Why am I asking this?". Optional. |
| `{ type: "turn_end" }` | The reply is complete. |
| `{ type: "error", message }` | The server failed mid-reply. |

The first message the chat sends is a hidden kickoff (`react/lib/messages.ts`); the reply to it is shown all at once as the opening summary.

### Weflect backend

`createWeflectServer(options)` implements the contract for a weflect server:

| Option | Purpose |
|---|---|
| `baseUrl` | Where the backend lives, e.g. `"https://reflect.example.org"`. Default: same origin. |
| `headers` | Function returning extra headers for every request. |
| `onUnauthorized` | Called once if session creation gets a 401; return `true` to retry. |

In the weflect repo itself, the access code is wired in like this:

```ts
import { accessHeaders, promptForAccessCode } from "../src/client/access";

const server = createWeflectServer({ headers: accessHeaders, onUnauthorized: promptForAccessCode });
```

## Styles

Import `styles/kaite.css` once. Every rule is scoped under the `.kaite` class, so it does not restyle the rest of your page. The screens add that class themselves. If you use a small component outside a screen, give it an ancestor with `class="kaite"`.

Colours and fonts are CSS custom properties on `.kaite` (`--you`, `--ai`, `--amber`, `--paper`, `--serif`, ...). Override them there to re-theme.

## Privacy

- Files are read and parsed in the browser. Nothing uploads.
- Redaction runs in the browser. The findings report and its downloads contain original identifiers and must never be sent to a server.
- Only the derived usage summary, the framing choices and what the student types in the chat reach the server.

## Not included

- An access gate or a consent screen. Handle both in the host project and pass `logConversation` in.
- A "how to export your logs" page. Link your own with `exportGuideHref`.
- The server itself.

The visible copy still says "WeFlect" (headings, the chat speaker label, report titles). Search for it if the host project uses another name.

## Origin

The `logic/` folders are copies of the weflect client's modules. In the weflect repo, `tests/react.test.tsx` fails if a copy drifts from its original, or if any file here starts importing from outside this folder.
