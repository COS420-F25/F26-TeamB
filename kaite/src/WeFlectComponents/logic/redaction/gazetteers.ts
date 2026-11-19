/**
 * Embedded gazetteers — data, not dependencies. Everything stays in-bundle so the
 * module runs in-browser with zero network calls.
 *
 * FIRST_NAMES gates the low-confidence name heuristics (roster rows, bare bigrams,
 * possessives, name-shaped path segments). It is a recall aid, not a requirement for
 * the strong cue heuristics (self-intro, honorific, Author:, signature, iCal), which
 * fire regardless of gazetteer membership.
 *
 * Membership tests go through foldToken (bottom of file), so every entry here is
 * lowercase ASCII without diacritics.
 */

// A few names appear in both groups below ("jose", "juan", "nina", "sofia"); the Set
// absorbs the duplicates, so the lists are kept readable rather than deduplicated.
const FIRST_NAMES_RAW = [
  // Common English / Western first names
  "aaron", "abigail", "adam", "adrian", "aiden", "alan", "albert", "alex", "alexander",
  "alexandra", "alice", "alicia", "allison", "amanda", "amber", "amelia", "amy", "andrea",
  "andrew", "angela", "anna", "anne", "anthony", "april", "arthur", "ashley", "austin",
  "barbara", "benjamin", "beth", "betty", "bill", "billy", "blake", "bob", "bobby",
  "bradley", "brandon", "brenda", "brian", "brittany", "bruce", "bryan", "caleb",
  "cameron", "carl", "carla", "carlos", "carol", "caroline", "carrie", "casey",
  "catherine", "chad", "charles", "charlotte", "chelsea", "chloe", "chris", "christian",
  "christina", "christine", "christopher", "cindy", "claire", "clara", "cody", "colin",
  "connor", "corey", "craig", "crystal", "curtis", "cynthia", "dale", "dan", "dana",
  "daniel", "danielle", "danny", "darren", "dave", "david", "dawn", "dean", "deborah",
  "debra", "dennis", "derek", "diana", "diane", "dominic", "don", "donald", "donna",
  "doris", "dorothy", "douglas", "dustin", "dylan", "earl", "eddie", "edward", "elaine",
  "eleanor", "elena", "elias", "elijah", "elizabeth", "ella", "ellen", "emily", "emma",
  "eric", "erica", "erik", "erin", "ethan", "eugene", "eva", "evan", "evelyn", "felix",
  "fiona", "frances", "francis", "frank", "fred", "gabriel", "gary", "gavin", "george",
  "gerald", "gina", "glen", "glenn", "gloria", "grace", "greg", "gregory", "hannah",
  "harold", "harry", "heather", "helen", "helena", "henry", "holly", "howard", "hugh",
  "ian", "irene", "isaac", "isabel", "isabella", "ivan", "jack", "jackson", "jacob",
  "jacqueline", "jake", "james", "jamie", "jane", "janet", "janice", "jason", "jay",
  "jean", "jeff", "jeffrey", "jenna", "jennifer", "jenny", "jeremy", "jerry", "jesse",
  "jessica", "jill", "jim", "jimmy", "joan", "joanna", "joe", "joel", "john", "johnny",
  "jon", "jonathan", "jordan", "jose", "joseph", "josh", "joshua", "joyce", "juan",
  "judith", "judy", "julia", "julian", "julie", "justin", "kaitlyn", "karen", "kate",
  "katherine", "kathleen", "kathryn", "kathy", "katie", "kayla", "keith", "kelly", "ken",
  "kenneth", "kevin", "kim", "kimberly", "kyle", "larry", "laura", "lauren", "lawrence",
  "leah", "lee", "leo", "leonard", "leslie", "liam", "lily", "linda", "lisa", "logan",
  "lori", "louis", "louise", "lucas", "lucy", "luke", "lydia", "lynn", "madison",
  "marc", "marcus", "margaret", "maria", "marie", "marilyn", "marion", "mark", "martha",
  "martin", "mary", "mason", "matt", "matthew", "maureen", "max", "maxine", "megan",
  "melanie", "melissa", "michael", "michelle", "mike", "mildred", "molly", "monica",
  "morgan", "nancy", "natalie", "nathan", "neil", "nicholas", "nicole", "nina", "noah",
  "nora", "norman", "oliver", "olivia", "oscar", "owen", "pamela", "patricia", "patrick",
  "paul", "paula", "peter", "philip", "phillip", "phyllis", "rachel", "ralph", "randy",
  "raymond", "rebecca", "regina", "reuben", "rex", "rhonda", "richard", "rick", "riley",
  "rita", "rob", "robert", "robin", "rodney", "roger", "ronald", "rose", "roy", "russell",
  "ruth", "ryan", "sam", "samantha", "samuel", "sandra", "sara", "sarah", "scott",
  "sean", "sharon", "shawn", "sheila", "shirley", "sidney", "simon", "sofia", "sophia",
  "sophie", "spencer", "stacy", "stanley", "stephanie", "stephen", "steve", "steven",
  "stuart", "susan", "suzanne", "sydney", "tammy", "tara", "taylor", "ted", "teresa",
  "terry", "theo", "theodore", "theresa", "thomas", "tiffany", "tim", "timothy", "tina",
  "todd", "tom", "tony", "tracy", "travis", "trevor", "tyler", "valerie", "vanessa",
  "veronica", "victor", "victoria", "vincent", "virginia", "walter", "wanda", "wayne",
  "wendy", "william", "willie", "zachary", "zoe",
  // Common international first names (South/East Asian, African, Middle Eastern,
  // Latin American, European)
  "aditi", "ahmed", "aisha", "akira", "alejandro", "ali", "amara", "amir", "ana",
  "anastasia", "anika", "anjali", "ankit", "arjun", "arun", "asha", "ayesha", "boris",
  "carmen", "chen", "cheng", "chinwe", "dieter", "dimitri", "dmitri", "eduardo", "elif",
  "emeka", "enrique", "fatima", "felipe", "fernanda", "fernando", "franz", "gabriela",
  "giovanni", "guillermo", "hana", "hans", "haruki", "hassan", "hiroshi", "hussein",
  "ibrahim", "imani", "ingrid", "irina", "ivana", "jamal", "javier", "jia", "jin",
  "jorge", "jose", "juan", "jun", "kai", "kamal", "katya", "kavya", "kenji", "khalid",
  "kwame", "lakshmi", "lars", "layla", "lei", "leila", "li", "liang", "lin", "ling",
  "lucia", "luis", "malik", "manuel", "marco", "mariam", "mario", "mateo", "mei",
  "mehmet", "miguel", "mina", "ming", "mohamed", "mohammed", "mustafa", "nadia", "naomi",
  "natasha", "ngozi", "nikolai", "nina", "noor", "olga", "omar", "paulo", "pedro",
  "pierre", "ping", "priya", "priyanka", "qing", "rafael", "rahul", "raj", "rajesh",
  "ramon", "rania", "ravi", "ricardo", "roberto", "rohan", "rosa", "sanjay", "santiago",
  "sergei", "shreya", "sofia", "stefan", "sung", "svetlana", "tamar", "tariq", "tatiana",
  "tomas", "vijay", "vikram", "wei", "xiao", "xin", "yan", "yasmin", "ying", "yuki",
  "yusuf", "zahra", "zainab", "zhang", "zhen",
] as const;

export const FIRST_NAMES: ReadonlySet<string> = new Set(FIRST_NAMES_RAW);

/**
 * Proper-noun products, languages, frameworks, vendors, and platforms. These are the
 * words a name detector grabs ("I'm Claude Code", "Railway Postgres") that tell a
 * reader a conversation was software work — they must survive redaction. A candidate
 * made ENTIRELY of these (plus generic tech / function words) is never a person, even
 * under a strong cue; a single one mixed with a real surname ("Ruby Chen") still is.
 *
 * Entries that are also first names or plain English ("ruby", "word", "edge",
 * "render", "lock", "stack", "visual", "studio", "cursor") are listed ON PURPOSE: a
 * lone "Ruby" or "Visual Studio" must never read as a person, and rules.ts
 * isVersionLike uses the same set as a version cue ("python 3.12.7.1").
 */
const PRODUCT_NAMES_RAW = [
  "android", "angular", "anthropic", "apache", "azure", "bash", "bitbucket", "bun",
  "canva", "canvas", "chatgpt", "chrome", "chromium", "clang", "claude", "cloudflare",
  "codespaces", "colab", "conda", "copilot", "cpython", "cursor", "deno", "discord",
  "django", "docker", "dropbox", "eclipse", "edge", "electron", "excel", "express",
  "fastapi", "figma", "firebase", "firefox", "flask", "flutter", "gemini", "git",
  "github", "gitlab", "gmail", "google", "gpt", "gradescope", "gradle", "grafana",
  "graphql", "heroku", "homebrew", "huggingface", "intellij", "javascript", "jenkins",
  "jest", "jira", "jupyter", "kafka", "keras", "kotlin", "kubernetes", "langchain",
  "latex", "linux", "lock", "macos", "matlab", "maven", "microsoft", "mongodb", "moodle",
  "mysql", "netlify", "nextjs", "nginx", "node", "notion", "npm", "numpy", "obsidian",
  "ollama", "openai", "opencv", "oracle", "outlook", "overleaf", "pandas", "photoshop",
  "piazza", "pip", "pnpm", "poetry", "postgres", "postgresql", "postman", "powershell",
  "prometheus", "pycharm", "pydantic", "pytest", "python", "pytorch", "railway", "react",
  "redis", "render", "replit", "router", "ruby", "rust", "safari", "scala", "selenium",
  "sentry", "slack", "spark", "spotify", "spring", "sqlalchemy", "sqlite", "stack",
  "streamlit", "studio", "supabase", "swift", "tableau", "teams", "tensorflow",
  "terraform", "trello", "twitch", "twitter", "typescript", "ubuntu", "unity", "unreal",
  "uvicorn", "vercel", "vim", "visual", "vite", "vscode", "vue", "webpack", "windows",
  "windsurf", "word", "xcode", "yarn", "youtube", "zoom", "zotero",
] as const;

export const PRODUCT_NAMES: ReadonlySet<string> = new Set(PRODUCT_NAMES_RAW);

/**
 * TitleCase tokens common in programmer chat that must never gate a name candidate.
 * (These suppress the LOW-confidence heuristics only; strong cues still fire.)
 * Superset of PRODUCT_NAMES plus generic tech English that starts sentences and
 * headings ("Error Handling", "Build Tools").
 */
const TECH_STOPLIST_RAW = [
  ...PRODUCT_NAMES_RAW,
  // Generic TitleCase-prone English in tech prose
  "action", "advanced", "agent", "answer", "api", "app", "apps", "array", "article",
  "attribute", "audio", "auth", "backend", "batch", "beta", "binary", "block", "board",
  "body", "boolean", "branch", "browser", "buffer", "bug", "build", "button", "cache",
  "call", "cell", "chapter", "chat", "check", "class", "client", "cloud", "cluster",
  "code", "column", "command", "comment", "commit", "config", "connect", "console",
  "content", "context", "control", "copy", "core", "count", "course", "create", "dark",
  "dashboard", "data", "database", "date", "debug", "default", "delete", "deploy",
  "design", "desktop", "detail", "dev", "device", "dialog", "diff", "directory", "docs",
  "document", "domain", "draft", "driver", "drop", "echo", "edit", "editor", "element",
  "email", "endpoint", "engine", "enter", "entry", "error", "event", "example", "export",
  "false", "feature", "field", "file", "filter", "final", "first", "flag", "folder",
  "font", "form", "format", "frame", "function", "global", "graph", "grid", "group",
  "guide", "handler", "hash", "header", "height", "hello", "help", "home", "hook",
  "host", "image", "import", "index", "info", "input", "insert", "install", "instance",
  "interface", "interpreter", "issue", "item", "join", "json", "key", "label", "language",
  "last", "layer", "layout", "level", "library", "light", "line", "link", "list", "load",
  "loader", "local", "log", "login", "logout", "loop", "machine", "mail", "main", "map",
  "mark", "markdown", "master", "match", "matrix", "media", "memory", "menu", "merge",
  "message", "method", "mode", "model", "module", "monitor", "mount", "mouse", "name",
  "network", "new", "next", "night", "node", "note", "notebook", "null", "number",
  "object", "office", "open", "option", "order", "output", "overflow", "package", "page",
  "panel", "paper", "parse", "parser", "part", "password", "patch", "path", "pattern",
  "phone", "pipeline", "pixel", "plan", "plugin", "point", "policy", "port", "post",
  "print", "process", "product", "profile", "project", "prompt", "property", "protocol",
  "proxy", "public", "pull", "push", "query", "queue", "quick", "range", "read", "reader",
  "readme", "record", "release", "remote", "render", "report", "repository", "request",
  "reset", "response", "result", "return", "review", "root", "route", "row", "rule",
  "run", "save", "scale", "schema", "scope", "screen", "script", "scroll", "search",
  "second", "section", "select", "server", "service", "session", "set", "settings",
  "setup", "shell", "shift", "side", "sign", "site", "size", "sleep", "socket", "sort",
  "source", "space", "spec", "speed", "stack", "stage", "start", "state", "status",
  "step", "stop", "store", "stream", "string", "style", "submit", "suite", "summary",
  "support", "switch", "sync", "syntax", "system", "tab", "table", "tag", "target",
  "task", "team", "template", "term", "terminal", "test", "text", "theme", "thread",
  "time", "timer", "title", "token", "tool", "topic", "trace", "track", "train", "true",
  "type", "unit", "update", "upload", "url", "user", "util", "value", "variable",
  "version", "video", "view", "virtual", "void", "watch", "web", "widget", "width",
  "window", "worker", "workspace", "write", "zone",
] as const;

export const TECH_STOPLIST: ReadonlySet<string> = new Set(TECH_STOPLIST_RAW);

/** English function words that start sentences; never part of a low-confidence name. */
const FUNCTION_WORDS_RAW = [
  "a", "about", "after", "all", "also", "an", "and", "any", "are", "as", "at", "be",
  "because", "been", "before", "best", "both", "but", "by", "can", "cheers", "could",
  "dear", "did", "do", "does", "each", "every", "for", "from", "had", "has", "have",
  "he", "her", "here", "hey", "hi", "his", "how", "however", "i", "if", "in", "into",
  "is", "it", "its", "just", "let", "like", "make", "many", "may", "me", "more", "most",
  "much", "my", "no", "not", "now", "of", "off", "ok", "okay", "on", "once", "one",
  "only", "or", "other", "our", "out", "over", "per", "please", "regards", "she",
  "should", "since", "so", "some", "such", "than", "thanks", "that", "the", "their",
  "them", "then", "there", "these", "they", "this", "those", "to", "under", "until",
  "up", "upon", "use", "very", "was", "we", "well", "were", "what", "when", "where",
  "which", "while", "who", "why", "will", "with", "would", "yes", "yet", "you", "your",
] as const;

export const FUNCTION_WORDS: ReadonlySet<string> = new Set(FUNCTION_WORDS_RAW);

/**
 * Home-directory / OS account names that are never a person (system, CI and container
 * users). A path like `/home/runner/work` must not seed a sweepable "runner" entity
 * that then masks the word everywhere.
 */
const USERNAME_STOPLIST_RAW = [
  "admin", "administrator", "all users", "default", "default user", "defaultuser0",
  "guest", "public", "shared", "system", "temp", "test", "testuser", "user", "users",
  "vagrant", "runner", "runneradmin", "jenkins", "docker", "root", "ubuntu", "ec2-user",
  "agent", "app", "appuser", "www-data", "nobody", "node", "service", "deploy",
] as const;

export const USERNAME_STOPLIST: ReadonlySet<string> = new Set(USERNAME_STOPLIST_RAW);

/**
 * Strip diacritics for gazetteer membership tests ("Tomás" → "tomas"). NFD splits an
 * accented letter into its base letter plus a combining mark; the character class in
 * the regex below is the LITERAL U+0300–U+036F combining-diacritics range, which most
 * editors render as nothing or as stray marks — it is not a typo.
 */
export function foldToken(token: string): string {

  return token.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
