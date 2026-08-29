# Custom Instructions & Directives

## Part A: Architectural Rules
- Show the working application instantly.
- Default to clean, modern, and accessible design principles.
- Server-side routes proxy all sensitive API interactions with zero client exposure.

## Part B: Data Boundaries & Endpoint Constraints
- **Outcome Writes Are Allowlisted, Never Free-Form**: Any endpoint that resolves or updates a stored record (such as `POST /api/reckoning/resolve`) takes an ID plus a value from a fixed enum, never the record's content. A client must never be able to supply the stance or conviction score while grading it, which prevents rewriting history under the guise of resolving it.
- **Owner-Bound Scopes**: All user collections are locked to `request.auth.uid == userId` or server-authoritative Admin SDK mutations.
