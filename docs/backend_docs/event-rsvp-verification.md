# Event RSVP implementation and verification

Verified on 2026-09-07 using an isolated SQLite database, the real Go server/router/session middleware, and Chrome controlled by Playwright. Existing workspace data was not used or changed.

## RSVP PERSISTENCE

Root cause of disappearing response:
- `UpsertEventResponse` already persisted both response values correctly.
- `GetGroupEvents` called `GetEventsByGroup` without the session user ID, and the query never read `event_responses`. Only event details populated `CurrentUserResponse`.
- `current_user_response` used `omitempty`, so the list omitted it. The frontend mapping consequently received `undefined`.
- `GroupEvents.responseOverrides` retained successful selections only until component unmount, and could mask a newer response from another tab. The existing mutation hook and WebSocket handler refetched the incomplete list contract; neither repaired that omission.
- Before the fix, the regression test confirmed one saved SQLite row for each choice, reopened the database, and failed because the fresh list GET omitted the response.

Database persistence:
- Existing `Repository.UpsertEventResponse`: `INSERT INTO event_responses ... ON CONFLICT(event_id, user_id) DO UPDATE`.
- Existing `UNIQUE(event_id, user_id)` prevents duplicate responses.
- `eventSummarySelect` joins the session user's row and reads authoritative Going/Not Going counts in one SQL query. The existing event/user index supports those lookups.

Current user response returned by:
- `GET /api/groups/{id}/events`: `events[].current_user_response`.
- `GET /api/groups/{id}/events/{eventID}`: `event.current_user_response`.
- `PUT /api/groups/{id}/events/{eventID}/response`: also returns the saved event summary.
- Unanswered events explicitly return `null`; frontend uses `EventResponseStatus | null`.
- User ID comes from the authenticated session, never from the RSVP request body.

Refresh behavior:
- Going persists: YES.
- Not Going persists: YES.
- Browser refresh was checked against actual SQLite rows for both values.
- Database close/reopen, tab unmount/remount, browser reopen, and reconnect restore persisted responses.
- Successful saves update the existing query cache from the returned backend event, invalidate older in-flight reads, and then refetch. No local override remains.
- Both buttons disable while pending; previous selection remains visible. Failed writes show an error. A successful write followed by a failed refetch also retains the saved selection.

## ATTENDEE LISTS

Backend:
- `GET /api/groups/{id}/events/{eventID}/responses`.
- Existing Groups repository's `GetEventResponses` joins `event_responses` with `users`.
- Only `user_id`, `username`, optional `avatar`, and `response` are exposed.

Going users:
- `responses[]` filtered by `response === "going"`.

Not Going users:
- `responses[]` filtered by `response === "not_going"`.

Authorization:
- `Service.GetEventDetails` verifies the event belongs to the URL group and calls the existing `Repository.GetMembership` check.
- Response reads and writes reuse that service authorization.

The Events list includes `going_count` and `not_going_count`; names load only when an attendee panel opens. Lists remain compact and scrollable. Empty events show zero counts and empty lists without inserting default responses.

## REAL-TIME RSVP LIST UPDATE

WebSocket EventType:
- Existing `group_event_response_updated`.

Payload:
```json
{"group_id":1,"event_id":1,"user_id":2,"response":"not_going"}
```

Updates:
- Current response.
- Going list/count.
- Not Going list/count.

The existing service broadcasts after the SQLite write. The existing WebSocketProvider now exposes a direct response-event subscription so React batching cannot discard intermediate invalidations. GroupStateSync refetches event summaries and mounted attendee queries; closed lists make no requests. Existing reconnect/focus synchronization refreshes these same resources. Lists are replaced with authoritative rows rather than appending users or manually adjusting counts.

## ARCHITECTURE

- Existing event_responses reused: YES.
- Existing WebSocket Hub reused: YES.
- Existing WebSocketProvider reused: YES.
- New persistence system created: NO.
- Polling added: NO.
- Existing notification system and countdown preserved: YES.

## Validation

- `go test ./...` and `go vet ./...`: passed.
- `npx tsc --noEmit`, ESLint for changed frontend modules, and `npm run build`: passed.
- `event_persistence_test.go` covers real migrated SQLite, close/reopen restoration through list/detail handlers, one row after repeated switches, multiple users/counts, empty events, session identity, invalid responses, private-field exclusion, and authorization.
- Chrome acceptance checks passed: both refresh choices, tab remount, browser reopen, live movement between lists in two sessions, counts, no duplicates, no attendee requests on initial load, pending buttons, failed writes, failed refetch after success, reconnect restoration, countdown, future-event rejection, and new-event notification delivery over the existing WebSocket.
