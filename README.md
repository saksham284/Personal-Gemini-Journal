# MindtrailAI — Personal Reflection & Epistemological Stance Tracker

> An intelligent journaling companion that tracks the philosophical, personal, and career positions you commit to across reflection sessions, automatically detecting and probing when a later entry refines, abandons, or reverses an earlier stance.

**Live Demo**: [https://mindtrailai-journal-reflection-companion.ai.studio/](https://mindtrailai-journal-reflection-companion.ai.studio/)

---

## Beyond the Base Spec: Stance Extraction & Perspective Shift Detection

Standard journaling apps treat reflections as isolated, ephemeral entries. MindtrailAI introduces an epistemological memory layer that turns conversational journaling into a longitudinal map of personal evolution:

1. **Stance & Claim Extraction with Conviction Scoring**:
   When sealing a session, the backend analyzes the conversation to extract explicit, first-person self-commitments, beliefs, rules, or work philosophies the user expressed. Each claim is assigned a normalized conviction score between `0.0` (hesitant / exploratory) and `1.0` (firm / dogmatic).
2. **Dynamic Topic-Slug Vocabulary Reuse**:
   To detect perspective shifts over time, the system maintains a persistent vocabulary of user topic slugs (`users/{uid}/meta/topics`). When sealing a new session, the user's existing slugs are passed directly into the Gemini prompt with strict instructions: if a newly extracted claim relates to an existing slug, the model **must reuse** that exact slug (e.g., reusing `"career-direction"` rather than inventing `"job-transition"` or `"career-path"`).
   > **Why Slug Reuse is Critical**: Without feeding the user's historical slug vocabulary into the prompt, LLMs will generate novel semantic variations on every session, preventing topic-level alignment and causing cross-session shift detection to fail completely.
3. **Perspective Shift Classification & Socratic Inquiry**:
   When a newly extracted claim matches the topic slug of any historical stance, Gemini evaluates the trajectory and classifies the evolution strictly into one of three filed shift categories:
   - `reverses`: Direct opposition to the prior conviction.
   - `abandons`: Letting go of an earlier rule or commitment.
   - `refines`: Nuancing, scoping, or deepening an earlier belief.
   For every detected shift, Gemini generates a tailored, non-judgmental Socratic inquiry question that challenges the user to reflect on what experiences or insights sparked that evolution.

---

## Architecture & Tech Stack

| Layer / Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Client** | React 19 + TypeScript + Tailwind CSS + Lucide Icons | Responsive single-page reflection dashboard with real-time Firestore sync, dynamic stance timelines, and Markdown transcript rendering. |
| **Backend Service** | Node.js Express + TypeScript (`server.ts`) | Reverse proxy, token verification, per-user rate limiting, daily quota metering, and structured Gemini generation. |
| **User Identity** | Firebase Authentication | Federated Google Sign-In with zero plaintext credential handling. |
| **Database & Persistence** | Cloud Firestore | Client-SDK persistence for journal interactions under owner-bound rules; Admin-SDK persistence for stance claims (`claims`), topic slug vocabularies (`meta/topics`), and daily quota counters (`quota`). |
| **AI Processing Engine** | Google GenAI SDK (`@google/genai`) | Multi-turn cognitive reflection, executive summarization, stance extraction, and perspective-shift analysis. |
| **Model Fallback Ladder** | `gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash` | Automated fallback across 4 model tiers catching `503`, `429`, `404`, and `500` status codes. |
| **Secret Management** | Google Cloud Secret Manager | Zero API keys exposed to browser client or hardcoded in source repository. |

---

## Security Architecture

MindtrailAI implements defense-in-depth across the API and persistence boundaries in the following order:

1. **`requireUser` Global Middleware (`server.ts`)**:
   - Mounted globally on `app.use('/api', requireUser)` before any route handler.
   - Extracts the Bearer token from the incoming `Authorization` header.
   - Executes cryptographic verification via `getAuth().verifyIdToken(token)` validating audience, project ID, signature, and expiration.
   - Explicitly inspects `decodedToken.firebase.sign_in_provider` and rejects anonymous accounts with HTTP `403 Forbidden` (`ANONYMOUS_ACCESS_FORBIDDEN`).
   - On authentication failure, returns HTTP `401 Unauthorized` with a standardized, stable error code (`UNAUTHORIZED_TOKEN`, `UNAUTHORIZED_MISSING_TOKEN`) and an opaque correlation ID (`correlationId`). Internal Firebase or cryptographic error messages are logged server-side only and never leaked to the client.
2. **Per-User Cost Controls & Rate Limiting (`enforceGeminiQuota`)**:
   - Mounted on `app.use('/api/gemini', enforceGeminiQuota)` covering all three Gemini AI endpoints (`/api/gemini/reflect`, `/api/gemini/summarize`, `/api/gemini/seal-session`).
   - **In-Memory Token Bucket**: Allows up to 20 requests per minute per `req.uid`. Refills continuously (1 token / 3,000 ms) and returns HTTP `429 Too Many Requests` with code `RATE_LIMITED` and a correlation ID when exhausted.
   - **Daily Firestore Quota Counter**: Tracks usage at `users/{uid}/quota/{YYYY-MM-DD}` using an atomic transaction with the Firebase Admin SDK. Enforces the daily limit defined by the `DAILY_CALL_LIMIT` environment variable (default: `120` calls/day). When exceeded, returns HTTP `429` with code `DAILY_LIMIT_REACHED`.
3. **Admin-Only Quota & Epistemological Stance Locking in Security Rules**:
   - `firestore.rules` enforces `allow write: if false;` on `users/{userId}/quota/{doc}`, `users/{userId}/claims/{claimId}`, and `users/{userId}/meta/{metaId}`. This ensures quota documents and historical claims can only be written and updated by the Admin SDK. Users cannot reset call limits or alter claims from the browser developer console.
4. **Draft-Preserving Client Interceptors (`src/App.tsx`)**:
   - The custom `authFetch` wrapper attaches `Authorization: Bearer <token>` to all `/api` calls.
   - If an HTTP `401` is received, an in-place Re-authentication modal is presented without navigating away, resetting input fields, or clearing the active reflection buffer.
   - If an HTTP `429` is received, an alert banner displays the exact limit message while leaving the user's draft text completely intact.

### Threat Summary Table (5 Threat Zones)

| Threat Zone | Identified Attack Vector | Countermeasure & Mitigation |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Prompt injection via untrusted reflection text; oversized payloads; JSON structure corruption. | Strict payload deserialization limits (`express.json({ limit: '2mb' })`), character truncation safeguards, structured JSON schemas (`responseSchema`), and strict isolation of user input as passive data inside prompts. |
| **2. Planning & Reasoning** | System instruction bypass; persona hijacking; unexpected output format deviations. | Server-side system instruction boundaries; structured response typing via `@google/genai` `Type.OBJECT`; defensive parsing and numeric clamping on all returned fields. |
| **3. Tool & API Execution** | Upstream API outages (`503`), quota limits (`429`), model deprecation (`404`), or transient infrastructure failures. | Resilient 4-tier model fallback ladder: `gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash` catching recoverable HTTP errors before surfacing issues to the user. |
| **4. Memory & State** | Cross-user data leakage; quota tampering; browser cache loss during session expiration. | Client-side Firestore rules enforcing `request.auth.uid == userId`; `quota` subcollection write-locked to Admin SDK transactions; client-side non-destructive error handling preserving draft text across 401/429 states. |
| **5. Inter-System & Auth** | Credential theft; client-side API key scraping; anonymous auth abuse. | Zero Gemini API keys in client code; cryptographic `verifyIdToken(token)` on all `/api` endpoints; rejection of anonymous providers (`403`). |

---

## Firestore Security Rules

The complete, active `firestore.rules` deployed to the project:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Isolates user interactions and journal reflection entries strictly to the authenticated owner
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // User quota tracking (Read-only for the user, Admin SDK writable only)
    match /users/{userId}/quota/{doc} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }

    // User metadata and topics document (e.g., users/{userId}/meta/topics - Read-only for user, Admin SDK writable only)
    match /users/{userId}/meta/{metaId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }

    // User claims collection (Read-only for user, Admin SDK writable only)
    match /users/{userId}/claims/{claimId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }

    // User metadata and profile document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Deployment to Google Cloud Run

### 1. Enable Required Google Cloud APIs
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com
```

### 2. Configure Secret Manager & IAM Bindings
```bash
# Create the secret for the Gemini API Key
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Retrieve project number and project ID
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
PROJECT_ID=$(gcloud config get-value project)

# Grant Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Cloud Run service account permissions to run Firestore transactions (for Admin SDK quota tracking)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### 3. Deploy Container to Cloud Run
```bash
gcloud run deploy mindtrail-ai \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances 4 \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-env-vars="DAILY_CALL_LIMIT=120" \
  --port 3000
```

### 4. Apply Campaign Verification Label & Verify
```bash
# Apply mandatory verification label
gcloud run services update mindtrail-ai \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1

# Verify label application
gcloud run services describe mindtrail-ai \
  --region=us-central1 \
  --format='value(metadata.labels)'
```

---

## Functional & Security Test Walkthroughs

### Test Suite 1: Authentication & Identity Isolation
- **TC-1.1: Unauthenticated API Access Rejection (`curl`)**
  - **Action**: `curl -X POST https://<APP_URL>/api/gemini/reflect -H "Content-Type: application/json" -d '{"messages":[]}'`
  - **Expected Outcome**: HTTP `401 Unauthorized` with JSON payload `{ "error": "Authentication required. Missing or malformed Authorization header.", "code": "UNAUTHORIZED_MISSING_TOKEN", "correlationId": "corr_..." }`.
- **TC-1.2: Cross-User Firestore Isolation**
  - **Action**: Sign in with User A, write 2 entries, seal a session to generate claims, and sign out. Sign in with User B.
  - **Expected Outcome**: User B's sidebar and stance evolution timeline are completely empty. Direct client queries to `users/USER_A_UID/interactions` or `users/USER_A_UID/claims` are rejected by Firestore security rules.
- **TC-1.3: Quota Tamper Rejection**
  - **Action**: Open the browser developer console while signed in as User A and execute:
    ```javascript
    import { doc, setDoc } from "firebase/firestore";
    await setDoc(doc(db, "users", auth.currentUser.uid, "quota", "2026-08-28"), { callCount: 0 });
    ```
  - **Expected Outcome**: Rejected with `FirebaseError: Missing or insufficient permissions` because `users/{userId}/quota/{doc}` enforces `allow write: if false;`.

### Test Suite 2: Rate Limiting & Quota Metering
- **TC-2.1: Per-User Minute Burst Limiting**
  - **Action**: Rapidly submit more than 20 prompt requests in under 60 seconds from the same signed-in account.
  - **Expected Outcome**: The 21st request returns HTTP `429 Too Many Requests` with code `RATE_LIMITED`. The UI displays a warning banner without clearing the text area.
- **TC-2.2: Daily AI Quota Cap**
  - **Action**: Exceed the configured daily limit (e.g. 120 calls).
  - **Expected Outcome**: The backend returns HTTP `429` with code `DAILY_LIMIT_REACHED`. Quota increments are verified in `users/{uid}/quota/{YYYY-MM-DD}`.

### Test Suite 3: Cognitive Reflection, Sealing & Evolution Tracking
- **TC-3.1: Multi-Turn Journaling across Cognitive Modes**
  - **Action**: Select "Deep Reflection" or "Brainstorming" mode, enter a reflective thought, and submit.
  - **Expected Outcome**: Gemini responds contextually in rich Markdown; conversation history persists to `users/{uid}/interactions/{entryId}`.
- **TC-3.2: Seal Session & Evolution Gap Analysis**
  - **Action**: Click "Seal Session" on a completed reflection containing committed statements.
  - **Expected Outcome**: Backend extracts claims with conviction scores, reuses matching topic slugs from `users/{uid}/meta/topics`, updates the topic list, and renders any detected perspective shifts (`reverses` / `abandons` / `refines`) with probing inquiry questions.
- **TC-3.3: AI Summarization & Tagging**
  - **Action**: Click "Summarize & Tag" on a reflection thread.
  - **Expected Outcome**: Generates a title, 2-sentence summary, and topic tags stored with the entry.
- **TC-3.4: Markdown Export & Entry Deletion**
  - **Action**: Click "Export Markdown" or delete an entry via the trash icon.
  - **Expected Outcome**: Downloads clean `.md` transcript with timestamps and stance records; deletion prompts modal confirmation and removes the document from Firestore.

---

## What the Security Review Caught

During our pre-production security audit, an architectural vulnerability was identified on the `/api/gemini/seal-session` endpoint:

- **The Flaw**: `/api/gemini/seal-session` was initially implemented without invoking `verifyIdToken`. Because the frontend always sent valid authenticated requests and performed client-side Firestore writes afterwards, all functional UI tests passed smoothly. However, the server endpoint was effectively an unauthenticated, public Gemini proxy burning our backend API key.
- **The Remedy & Unlocked Capability**: Implementing the global `requireUser` middleware closed the unauthenticated proxy loophole. Critically, validating and extracting a trusted `req.uid` from verified tokens is what made per-user rate limiting and daily quota enforcement possible, as anonymous or unauthenticated traffic could never be reliably metered.

---

## Security Hardening & Data Boundaries

- **Strict Server-Authoritative Epistemological Persistence**: Stance claims (`users/{uid}/claims`), topic vocabularies (`users/{uid}/meta/topics`), and rate-limit quotas (`users/{uid}/quota`) are write-locked with `allow write: if false;` in Firestore security rules and modified strictly via the Firebase Admin SDK in backend transactions and batch writes.
- **Client Ownership Scope**: Users retain client-SDK read/write access exclusively to their personal conversational reflections (`users/{uid}/interactions/{interactionId}`) and profile documents under owner-bound rules (`request.auth.uid == userId`), preventing any cross-user data leakage.
