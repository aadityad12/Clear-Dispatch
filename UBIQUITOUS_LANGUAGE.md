# Ubiquitous Language — SIGNAL

A human-in-the-loop emergency dispatch support system for wildfire surge events. The AI never speaks to callers — only to the dispatcher. This glossary formalizes domain terminology used across backend, frontend, and integration layers.

---

## System Modes

| Term        | Definition                                                                                   | Aliases to avoid         |
| ----------- | --------------------------------------------------------------------------------------------- | ------------------------ |
| **ASSISTED** | Normal operating mode in which the dispatcher is in full control and AI agents support       | Manual, normal, default  |
| **SURGE**    | High-volume crisis mode activated when incoming call rate exceeds the SURGE_THRESHOLD        | Overload, emergency mode |

---

## Actors

| Term            | Definition                                                                  | Aliases to avoid    |
| --------------- | --------------------------------------------------------------------------- | ------------------- |
| **Dispatcher**  | The human 911 operator; sole decision-maker; never bypassed by the AI       | User, operator      |
| **Caller**      | A person in crisis placing a 911 call; AI never communicates with them      | Requester, victim   |
| **AI Agent**    | One of four named intelligent systems assisting the dispatcher              | Agent module, bot   |

---

## AI Agents

Each agent performs a distinct role in the dispatch workflow.

| Term          | Definition                                                       | Aliases to avoid    |
| ------------- | ---------------------------------------------------------------- | ------------------- |
| **MONITOR**   | Watches incoming call volume; triggers SURGE mode when threshold | Call tracker        |
| **TRIAGE**    | Classifies incident severity (CRITICAL, URGENT, STANDARD)        | Classifier          |
| **RESOURCE**  | Allocates and dispatches response units; enforces HOLD protocol  | Dispatcher agent    |
| **RELAY**     | Generates dispatcher briefings via TTS or text; summarizes calls | Briefing generator  |

---

## Call & Incident

| Term              | Definition                                                                                        | Aliases to avoid       |
| ----------------- | ------------------------------------------------------------------------------------------------- | ---------------------- |
| **Call**          | An incoming 911 request from a caller; immutable identifier for the entire incident lifecycle    | Request, ticket       |
| **Incident**      | The emergency situation described by a call (e.g., wildfire, structure fire)                     | Event, emergency      |
| **Severity**      | The classified priority level of a call; one of CRITICAL, URGENT, STANDARD, or transient PENDING | Priority, classification |
| **CRITICAL**      | Most urgent severity; immediate life-safety threat                                              | High, red              |
| **URGENT**        | Severe but not immediate life-safety threat                                                      | Medium, orange         |
| **STANDARD**      | Lower urgency or routine incident                                                               | Low, green             |
| **PENDING**       | Transient severity state assigned immediately upon call intake; replaced by TRIAGE classification | Unclassified, unknown |
| **Incident Type** | The category of emergency (e.g., structure fire, vegetation fire, medical, hazmat)               | Event type, category  |
| **Zone**          | Geographic area or district where the incident is located                                        | Region, area, sector  |
| **Vulnerable**    | Boolean flag indicating the caller is a vulnerable individual (elderly, disabled, etc.)          | Special needs, at-risk |

---

## Response Units & Dispatch

| Term        | Definition                                                                         | Aliases to avoid      |
| ----------- | ---------------------------------------------------------------------------------- | --------------------- |
| **Unit**    | A dispatched response resource (fire truck, tanker, rescue team, etc.)             | Vehicle, resource     |
| **Unit ID** | Unique identifier for a response unit                                              | Vehicle ID, truck ID  |
| **ETA**     | Estimated time of arrival in minutes for a dispatched unit to reach the incident  | Arrival time, time to scene |
| **Dispatch** | The act of assigning and sending a unit to a call                                 | Send, assign          |

---

## Protocol HOLD

The HOLD protocol prevents dangerous deployments without explicit human approval.

| Term             | Definition                                                                    | Aliases to avoid       |
| ---------------- | ----------------------------------------------------------------------------- | ---------------------- |
| **HOLD**         | A blocking state requiring dispatcher confirmation before deploying a heavy asset | Block, gate           |
| **Hold Event**   | A HOLD_REQUIRED message requesting dispatcher decision on a deployment       | Hold request           |
| **Heavy Asset**  | Specialized or high-risk response unit (air_tanker, heavy_rescue, hazmat)    | Restricted unit       |
| **Confirm**      | Dispatcher action approving a HOLD; permits unit dispatch                     | Approve               |
| **Cancel**       | Dispatcher action rejecting a HOLD; prevents unit dispatch                    | Reject, deny          |

---

## Briefing

| Term              | Definition                                                                  | Aliases to avoid       |
| ----------------- | --------------------------------------------------------------------------- | ---------------------- |
| **Briefing**      | A summary of a call generated by RELAY agent for the dispatcher              | Summary, overview      |
| **Briefing Text** | Human-readable text form of a briefing                                       | Text summary           |
| **Audio Briefing** | Briefing rendered as spoken audio via ElevenLabs TTS; optional, text fallback | Voice briefing, TTS   |

---

## Audit & Observability

| Term              | Definition                                                                              | Aliases to avoid       |
| ----------------- | --------------------------------------------------------------------------------------- | ---------------------- |
| **Audit Entry**   | A timestamped record of a system event (mode change, call added, agent status, hold, etc.) | Log entry, event log |
| **Audit Log**     | Chronologically ordered list of all audit entries; immutable append-only log             | System log             |
| **Override**      | Dispatcher action to forcibly return from SURGE to ASSISTED mode                        | Cancel surge, reset    |

---

## Technical Terms with Domain Meaning

| Term                 | Definition                                                                                                           | Aliases to avoid       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Agent Status**     | Current state of an AI agent: IDLE (ready), RUNNING (active), COMPLETE (finished), or ERROR (failed)               | State, condition       |
| **WebSocket Message** | Real-time event pushed from backend to frontend via `/ws` connection; carries call, agent, hold, mode, or briefing data | Event, frame          |
| **Mode Change**      | A WebSocket event indicating transition between ASSISTED and SURGE modes                                            | Mode switch            |
| **SURGE_THRESHOLD**  | Environment variable controlling call rate (calls/min) at which SURGE mode activates; default 10                   | Threshold value       |

---

## Relationships

- A **Call** is placed by a **Caller** and received by a **Dispatcher**.
- A **Call** has exactly one **Severity** (CRITICAL, URGENT, STANDARD, or PENDING).
- **TRIAGE** replaces PENDING severity with a final classification (CRITICAL, URGENT, or STANDARD).
- **RESOURCE** may dispatch a **Unit** to a **Call**, generating an ETA.
- A **Unit** deployment may trigger a **HOLD** if it is a **Heavy Asset**.
- A **Dispatcher** must **Confirm** or **Cancel** a **HOLD** before the **Unit** can be dispatched.
- **RELAY** generates a **Briefing** (text or audio) for each **Call**, viewed by the **Dispatcher**.
- **MONITOR** triggers transition from **ASSISTED** to **SURGE** when call volume exceeds **SURGE_THRESHOLD**.
- **Dispatcher** can issue an **Override** to return from **SURGE** to **ASSISTED**.
- Every action is recorded as an **Audit Entry** in the immutable **Audit Log**.

---

## Example Dialogue

> **Frontend Dev:** "When a caller places a call, what severity do we show them?"
>
> **Domain Expert:** "We show nothing to the caller. The dispatcher receives the **Call** immediately with severity PENDING. TRIAGE classifies it within seconds to CRITICAL, URGENT, or STANDARD."
>
> **Frontend Dev:** "So if a **Call** comes in during **SURGE** mode with a **Heavy Asset** request, what happens?"
>
> **Domain Expert:** "RESOURCE detects the **Heavy Asset** type and emits a **HOLD_REQUIRED** message. The dispatcher sees the **Hold** modal with the **Call** details and must explicitly **Confirm** or **Cancel** before dispatch. If they **Confirm**, the **Unit** is dispatched with an ETA. If they **Cancel**, the **Unit** never moves."
>
> **Frontend Dev:** "And if the dispatcher wants to exit **SURGE** mode while there are active **Holds**?"
>
> **Domain Expert:** "They issue an **Override**. The system returns to **ASSISTED** mode immediately. Any pending **Holds** remain until the dispatcher resolves them — the mode change doesn't auto-cancel deployments. Every action, including the **Override**, is logged as an **Audit Entry** with a timestamp."
>
> **Frontend Dev:** "Got it. So the **Dispatcher** is always the bottleneck for critical decisions, and the **Audit Log** records every turn."
>
> **Domain Expert:** "Exactly. The **AI Agents** advise, but the **Dispatcher** decides. That's the core safety constraint: the AI never speaks to the **Caller**, only to the **Dispatcher**."

---

## Flagged Ambiguities

**None identified.** The terminology is internally consistent across codebase, PRD, and team specification. All synonyms (e.g., "caller" vs. "requester") have been consolidated into canonical terms. The PENDING severity state is correctly recognized as transient, not a final classification.

---

## Notes for Implementation

- **Enums** (Mode, Severity, AgentName, AgentStatus) are shared contracts across backend, frontend, and integration layers. Changes require all three to align.
- **WebSocket messages** are the source-of-truth for inter-service communication; never deviate from the canonical schema.
- **Heavy asset types** (air_tanker, heavy_rescue, hazmat) trigger HOLD protocol; new types must be added to the enum and the HOLD logic.
- **Dispatcher** is never bypassed by AI. Every HOLD, override, or critical decision requires human confirmation.
- **Audit Log** is append-only and immutable; timestamps use ISO8601 format.
