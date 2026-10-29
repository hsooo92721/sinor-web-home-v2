# Scheduled column publication

`cms/column-schedule.js` is the shared publication plan and excerpt helper.

- Clicking Publish/Save Changes with a future `displayDate` sends/stores `status:"draft"` and `scheduledAt` at 10:00 Asia/Seoul on that day (01:00 UTC).
- An explicit temporary save or private/trash status cancels the reservation (`scheduledAt:null`). Author/category bulk changes preserve an existing reservation.
- Existing `publishedAt` is retained for previously published posts. A newly scheduled article receives its scheduled instant as first publication time when due.
- The original display date drives ordering and NEW rules. It is not replaced by migration time.
- Excerpts are derived from the beginning of body text, excluding figures, captions, header/author/source/tag blocks. No excerpt input is exposed in the editor.

## Current demo

Reservations remain in browser-local storage. Reading local posts materializes due draft reservations as published; a future timer refreshes already-open reader tabs. A closed browser runs no background job, and other visitors cannot read another browser's local drafts. This is the existing demo CMS persistence boundary, not a server scheduler.

## Company API integration

The existing POST/PUT admin column endpoints must accept and validate `scheduledAt`, require a future scheduled draft to remain excluded from the public endpoints, and return this field to administrators. Run a durable scheduler/worker at 10:00 Korea time, or query by an indexed `scheduledAt <= serverNow` every minute. Atomically publish only still-draft rows whose matching reservation remains due. Re-read state/updatedAt under lock so cancelling/editing a reservation cannot be overridden by a stale job. Make publication idempotent, record the first publication timestamp, and invalidate public list/detail caches. Browser-computed dates alone must not authorize publication in API mode. Public endpoints must never return unreleased draft content.

A source URL entered in the editor is a migration redirect mapping. It does not itself enable HTTP 301 on the original Imweb server; apply the prepared redirect manifest at domain/server cutover.
