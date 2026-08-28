# ReflectAI — Personal Reflection Companion

A secure, user-authenticated web application combining **Gemini 3.6 Flash** and **Google Cloud Firestore** to provide a private, multi-turn conversational journaling and reflection workspace.

---

## Architecture & Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **User Identity** | Firebase Authentication | Federated Google Sign-In with zero password storage. |
| **Backend Database** | Cloud Firestore | User-isolated document persistence for multi-turn reflections and summaries (`/users/{userId}/interactions/{interactionId}`). |
| **AI Processing Engine** | Gemini 3.6 Flash (`@google/genai`) | Multi-turn cognitive reflection, divergent brainstorming, structured summarization, and tag extraction with resilient fallback ladder. |
| **Backend Service** | Node.js Express + TypeScript | Secure API proxy keeping Gemini API keys hidden from the browser client. |
| **Frontend Client** | React 19 + Tailwind CSS + Lucide | High-contrast, accessible, responsive reflection dashboard with real-time Firestore sync. |
| **Secret Management** | Google Cloud Secret Manager / Env | Zero hardcoded keys; secure runtime secret injection. |

---

## 1. Agentic Threat Modeling & Security Architecture

### Threat Summary Table (5 Threat Zones)

| Threat Zone | Identified Attack Vector | Countermeasure & Mitigation |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Prompt injection via malicious journal notes, oversized payloads, malformed JSON bodies. | Strict schema validation, max character constraints, top-level body decoding (`express.json({ limit: '2mb' })`), and treating user entries strictly as passive data inside prompts. |
| **2. Planning & Reasoning** | System instruction bypass, persona hijacking to force unwanted output formats. | Explicit system prompt boundaries in backend routes; isolation of system instructions from user chat text; strict fallback ladder. |
| **3. Tool & API Execution** | API rate exhaustion (`429`), model outages (`503`), unexpected API errors. | Multi-tier **Resilient Model Fallback Ladder** (`gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-flash-latest` → `gemini-2.5-pro`) with automated recovery before bubbling errors to UI. |
| **4. Memory & State** | Cross-user data leakage, unauthorized reads/writes to other users' journal entries, `undefined` field database driver crashes. | Strict Firestore security rules matching `request.auth.uid == userId`, recursive `stripUndefined()` payload sanitizer, and user-scoped subcollections. |
| **5. Inter-System & Auth** | Credential theft, API key exposure in browser DevTools, session hijacking. | Server-side API proxy (keys never in browser), Federated Google OAuth, Firebase Auth JWT verification. |

---

## 2. Firestore Security Rules

Deploy the following owner-bound rules in `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Isolates user interactions and journal reflection entries strictly to the authenticated owner
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // User metadata and profile document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Deploy using Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 3. Secret Manager Setup & Permissions

Store the Gemini API Key in Google Cloud Secret Manager:

```bash
# 1. Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 2. Create the GEMINI_API_KEY secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 3. Add the secret version with your Gemini API key
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 4. Grant Cloud Run runtime service account permission to read the secret
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Google Cloud Run Deployment & Campaign Verification

### Prerequisites
- Google Cloud SDK (`gcloud` CLI installed and authenticated)
- Docker or Google Cloud Build enabled

### Build and Deploy to Cloud Run

```bash
# 1. Build and deploy container directly
gcloud run deploy reflect-ai \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000

# 2. Apply mandatory campaign verification label
gcloud run services update reflect-ai \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 5. Functional Stability & User Interaction Test Walkthroughs

The following test suites cover all user interactions and workflows for end-to-end verification:

### Test Suite 1: Authentication & Landing Flow
- **TC-1.1: Unauthenticated Landing Screen**
  - **Action**: Load the application in a fresh browser session.
  - **Expected Outcome**: App displays the landing view, feature highlights, Firestore privacy guarantee badge, and "Continue with Google Account" CTA. No private data is rendered.
- **TC-1.2: Google Sign-In**
  - **Action**: Click "Continue with Google Account" (or "Sign In with Google" in the header) and complete the OAuth consent popup.
  - **Expected Outcome**: User is authenticated; UI transitions seamlessly into the private dashboard displaying their user avatar, name, and initial reflection session.
- **TC-1.3: Sign Out Flow**
  - **Action**: Click the Sign Out button in the navigation bar.
  - **Expected Outcome**: Firebase session terminates, active entries and local workspace state are wiped from memory, and the user is redirected back to the landing view.

### Test Suite 2: Multi-Turn Journaling & Gemini Reflection
- **TC-2.1: Reflection Mode Selection**
  - **Action**: Click between mode chips ("Deep Reflection", "Brainstorming", "Action Steps", "Gratitude & Wins", "Summary & Synthesis").
  - **Expected Outcome**: Active mode badge updates, starter prompt pills adjust dynamically to the chosen cognitive mode, and backend system prompt is tuned accordingly.
- **TC-2.2: Prompt Suggestion Spark**
  - **Action**: Click any inspiration prompt pill on an empty reflection.
  - **Expected Outcome**: The text area populates with the prompt, auto-adjusts height, and focuses the cursor.
- **TC-2.3: Multi-Turn Conversation Execution**
  - **Action**: Enter a thought and press <kbd>Enter</kbd> (or click Send).
  - **Expected Outcome**: User thought renders immediately in the conversation thread; "Reflecting on your entry with Gemini 3.6 Flash..." loading spinner appears; Gemini generates a rich Markdown-formatted response; turn count badge increments.
- **TC-2.4: Multi-Turn Follow-Up**
  - **Action**: Type a follow-up answer or counter-question to Gemini's reply and submit.
  - **Expected Outcome**: Gemini receives the full conversation history and produces contextual follow-up guidance.

### Test Suite 3: Firestore Persistence & Zero-Data-Leakage
- **TC-3.1: Automatic Document Creation & Real-Time Sync**
  - **Action**: Inspect the top navigation sync indicator during and after submitting a reflection.
  - **Expected Outcome**: Sync indicator transitions to "Saving..." and settles on "Synced to Cloud". Document is written to `/users/{userId}/interactions/{entryId}`.
- **TC-3.2: Cross-User Isolation Verification**
  - **Action**: Sign in with User Account A, create 2 reflections, sign out, and sign in with User Account B.
  - **Expected Outcome**: User B's history sidebar is completely empty and cannot read or query any records belonging to User A.
- **TC-3.3: Undefined-Stripping Payload Integrity**
  - **Action**: Create and update entries with optional fields omitted.
  - **Expected Outcome**: `stripUndefined` utility sanitizes all payloads prior to `setDoc`/`updateDoc`, ensuring no Firestore driver errors occur.

### Test Suite 4: History Management, Summarization & Export
- **TC-4.1: History Search & Filtering**
  - **Action**: Type a keyword in the sidebar search bar or click a `#tag` pill.
  - **Expected Outcome**: History list filters in real-time by title, content, or tag across date groups ("Today", "Yesterday", "Earlier").
- **TC-4.2: Automated AI Summarize & Tagging**
  - **Action**: On a reflection with 2 or more turns, click the "Summarize & Tag" button.
  - **Expected Outcome**: Gemini generates a crisp title, 2-line executive summary, and contextual tags. Summary card renders at the top of the workspace and updates in Firestore.
- **TC-4.3: Markdown Export**
  - **Action**: Click the download button in the workspace toolbar.
  - **Expected Outcome**: Browser downloads a cleanly formatted `.md` file containing the complete reflection thread, timestamps, and summary.
- **TC-4.4: Deletion Confirmation Flow**
  - **Action**: Hover over an entry in the history sidebar, click the trash icon, and confirm in the deletion modal.
  - **Expected Outcome**: Entry is permanently deleted from Firestore and removed from the sidebar; the workspace automatically selects the next available entry.
