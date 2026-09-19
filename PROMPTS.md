# Prompts used in this project

This file documents how AI tooling was used to build and refactor the calculator,
as required by the assignment ("Share any prompts that you used in your work").

**Tools used:** <!-- fill in: Claude (Cowork / claude.ai), Claude Code, Cursor, ChatGPT, Copilot… -->

**How I used them:** <!-- 2–3 lines in your own words. Example: I used AI for
architecture discussion, to generate a refactor plan, and to draft boilerplate and
tests. I reviewed every output, rejected suggestions that added scope, and wrote the
design decisions myself. -->

Prompts are listed in chronological order, with spelling and punctuation corrected
and the substance unchanged. The "Outcome" line says what I did with the answer —
accepted, modified, or rejected — because that is the part that shows judgment, not
the prompt itself.

---

## 1. Original build

<!--
Recover these from wherever you built the first version. See "Where to find your
prompt history" at the bottom of this file. Paste each one using the block below.
If you built part of it without AI, say so — that is also information.
-->

### 1.1 <!-- short title, e.g. "Scaffold the Go backend" -->

**Tool:** <!-- -->
**Prompt:**

> <!-- paste verbatim -->

**Outcome:** <!-- accepted / modified because… / rejected because… -->

### 1.2 <!-- next -->

---

## 2. Architecture discussion (Claude, Cowork session)

Before refactoring, I discussed the architecture with Claude. The prompts are
informal; spelling and punctuation have been corrected, wording and intent are
unchanged.

### 2.1 Initial architecture question

**Prompt:**

> [pasted the full assignment text]
>
> Please, let's discuss this. I'm going to use Go for the backend, as the
> instructions say, but first I want to know how to implement it with a clean
> structure, which approach would be best for this app (SOLID, DRY, etc.), and
> how to set up the folders for a clear folder structure.

**Outcome:** Accepted the core recommendation: two layers per side (a pure
`calculator` domain package with no HTTP imports, and a thin `httpapi` transport
layer; on the frontend, one API client injected into one `useCalculator` hook).
Accepted the single `POST /api/v1/calculate` endpoint over per-operation endpoints.
Noted the explicit warning against over-engineering a 4-hour take-home.

### 2.2 State management

**Prompt:**

> For React, do we need to use Redux to simplify the state management?

**Outcome:** Accepted: no Redux. A calculator is a single-screen state machine, so
`useReducer` inside one hook is proportional. Kept the list of conditions under
which Redux, Zustand, or Context would become justified, for the README.

### 2.3 Request for a step-by-step plan

**Prompt:**

> Make a step-by-step plan in a markdown file. I already have an app ready, and I
> need to apply these changes to that app. So you need to include a step to
> analyze the current code and then apply the changes.

**Outcome:** Received `REFACTOR_PLAN.md` with an analysis-first Phase 0 and gated
phases. Used as the working plan for the refactor.

### 2.4 Pushback on scope

**Prompt:**

> Did you consider not over-engineering this?

**Outcome:** The plan had accumulated nice-to-haves (operations endpoint, graceful
shutdown, distroless image, operation chaining, keyboard mapping). I later checked
each one against the assignment (entries 3.4–3.7); none is required. Deferred the
operations-listing endpoint (nobody consumes it) and the CORS middleware (never
exercised: Vite proxies in development, nginx in Docker), and listed them under
"What I'd do with more time". Kept graceful shutdown: about 15 lines, idiomatic
for a Go server, and Docker stops containers with a terminate signal. Kept
operation chaining and keyboard mapping because the original app already had
them — removing them would be a regression. Chose `alpine` over distroless so
the Docker health check can run.

### 2.5 Clarifying jargon

**Prompt:**

> What is an ops list?

**Outcome:** "ops" meant "operations". Led directly to the next rule.

### 2.6 Naming rule — no abbreviations

**Prompt:**

> Don't use shorthand in the app. Leave the variables with their full meaning —
> for example, ops = operations, keep all the letters. Implement that in the
> markdown.

**Outcome:** Added a Naming convention section to the plan: full words in every
identifier, with a short list of allowed acronyms and Go idioms, and a grep check
at every gate.

### 2.7 Naming rule — English only

**Prompt:**

> Also, change all the variables to English, because all the variables are in
> Spanish.

**Outcome:** The original code base used Spanish identifiers. Added an English-only
rule, a Spanish → English rename table produced in Phase 0, and the decision that
JSON field names change with it (a contract change, handled backend and frontend in
the same pull request).

### 2.8 This file

**Prompt:**

> One of the requirements is to share any prompts I used to build this app. Could
> you help me with that?

**Outcome:** This template, plus instructions on recovering prompt history.

### 2.9 Cleaning up this file

**Prompt:**

> Correct my spelling mistakes, from any prompt that I've sent.

**Outcome:** Prompts in this file were corrected for spelling, capitalization, and
punctuation only.

---

## 3. Refactor execution

<!--
Append here as you go, one entry per prompt, in order. If you run the plan with
Claude Code, the per-phase prompts from Appendix C of REFACTOR_PLAN.md go here
verbatim, followed by anything you asked inside each session.
-->

### 3.1 Phase 0 — analysis

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Read REFACTOR_PLAN.md in full, including the Naming convention section. The
> code base currently uses Spanish identifiers; they will all be translated to
> English full words. Execute ONLY Phase 0. Do not modify any source file. Write
> your findings to docs/ANALYSIS.md following the structure in the plan, including
> the filled gap-analysis table, the backend and frontend rename tables (Spanish or
> abbreviated identifier → English full-word name), the list of Spanish JSON field
> names, and the strategy decision in 0.7. When Gate 0 is satisfied, stop and
> summarize what you found in five lines.

**Outcome:** Received `docs/ANALYSIS.md` and the `pre-refactor` tag on `1b273e2`;
no source file changed. Baseline: backend coverage 10.1%, no frontend tests.
Findings that changed the plan: the gate grep for Spanish words missed most of
this code base's vocabulary (extended grep added), single-letter identifiers were
invisible to the abbreviation grep (second grep added, `t *testing.T` allowed as
a Go idiom), and Appendix B said `sqrt` where Rule 2 requires `squareRoot`.
<!-- adjust: say which of the 0.7 decisions you accepted or overrode -->

### 3.2 Phase 0 — what is left before Phase 1

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Okay, so what do we need to do before the next step?

**Outcome:** A short checklist: add `REFACTOR_PLAN.md` and this file to the
repository root, confirm the 0.7 decisions, fold the Phase 0 findings into the
plan, branch, and commit Phase 0.

### 3.3 Phase 0 — scope confirmation

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Everything that is not in the current app, we will need to build it — for
> example power, square root, and percentage. Give me the path for saving
> REFACTOR_PLAN.md; I have the PROMPTS.md and I will put it in the same folder
> that you give me.

**Outcome:** My decision, recorded in `docs/ANALYSIS.md` (finding F2 and section
0.7): features the target needs and the current application lacks get built,
each with its tests in the phase that adds it. Narrowed in 3.4–3.6 after reading
the assignment again.

### 3.4 Scope check against the assignment

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> [attached the assignment text]
>
> Let's talk about 2.4, and check this against the assignment. If the assignment
> requires it, then do it; if not, just let me know.

**Outcome:** None of the five items in 2.4 is required. Two already existed in
the app (chaining, keyboard mapping) and stay. The answer also pointed out that
the CORS middleware would never run in this project, which I had not noticed.

### 3.5 Docker stays

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Although Docker is optional, I want to build it.

**Outcome:** My decision. Phase 5 stays in full; the backend image is `alpine`.

### 3.6 Advanced operations stay

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Also build the operations: square root, percentage, and power.

**Outcome:** My decision. With that, the rule became: build what the assignment
lists, even when optional; defer what it never mentions. Recorded in Appendix D
of `REFACTOR_PLAN.md`.

### 3.7 Final call on the three deferred items

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> And yes, remove the CORS middleware and the operations endpoint — nobody
> consumes them — and keep graceful shutdown.

**Outcome:** My decision. The assistant had deferred all three; I kept graceful
shutdown as the one exception to the rule in 3.6.

---

## 4. Documentation

<!-- Prompts used for the README, diagrams, or this file. -->

---

## What I did without AI

<!--
Optional but strong: list the things you decided or wrote yourself — the design
decisions table, the choice to cut scope, the test cases you added by hand, bugs you
found that the AI missed. Evaluators read this section closely.
-->

---

## Where to find your prompt history

Delete this section before submitting.

**Claude Code (terminal).** Every session is stored as JSON Lines under your home
folder. On Windows: `C:\Users\<you>\.claude\projects\<project-folder-slug>\*.jsonl`.
On macOS / Linux: `~/.claude/projects/…`. Each project folder is named after the
path you ran `claude` from. To print only your own messages from one session
(requires `jq`):

```
jq -r 'select(.type == "user") | .message.content | if type == "array" then map(select(.type == "text") | .text) | join("\n") else . end' session.jsonl
```

`claude --resume` also lists past sessions with their first message, which helps
find the right file.

**Claude desktop / claude.ai / Cowork.** Open the conversation and copy your
messages, or export everything: Settings → Privacy → Export data (arrives by email
as JSON).

**Cursor.** The chat panel keeps history per workspace; copy from there. Cursor
also stores it in its SQLite state database, but copying is faster for a few
prompts.

**ChatGPT.** Settings → Data controls → Export data. Or open the conversation and
copy.

**GitHub Copilot Chat (VS Code).** No export; copy from the chat view while the
session is still open.

**A rule for pasting:** keep the substance verbatim. Fixing spelling and
punctuation is fine (that is what was done in Section 2); rewriting a prompt to
sound more expert than it was defeats the purpose of the requirement, and
evaluators can usually tell.
