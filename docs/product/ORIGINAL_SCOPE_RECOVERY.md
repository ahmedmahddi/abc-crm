# ABC CRM Original Scope Recovery

## Purpose

The original product brief remains the acceptance baseline. Extended production work must not replace incomplete core workflows. Close this recovery gate before prioritizing offline synchronization, monitoring, or deployment polish.

## Scope Traceability

| Area | Working now | Required to close the original brief |
| --- | --- | --- |
| Custom auth | Login, logout, rotating refresh cookie, CSRF guard, `/auth/me` | Password reset, login throttling, account administration, disable and session revocation UI |
| Clients | CRUD, archive, effectifs, contacts, responsables, private document upload | Capture responsables and cadre contacts during creation, visible accent editor, type-specific uploads during creation, document removal, baseline organigramme extraction with review, CSV/PDF export, archive restore, rendered mission timeline |
| Consultants | CRUD, archive, detail and edit | Linked-account administration, availability context, archive restore, complete list filtering and pagination |
| Calendar and missions | Bounded FullCalendar feed, week/month planning, mobile agenda, create, drag reschedule, cancel, automatic ordre propagation | Mission edit UI, calendar click-to-create prefill, explicit responsable consultant selection, client and mode context in form, detail interaction polish |
| Ordres de mission | Transactional references, list, detail, validation, print state, preview, CSV/XLSX/PDF | Manual historical ordre creation UI, ordre edit UI, archive restore, template archive/default management polish |
| Templates | Temporarily disabled in the web app by explicit product decision | Reactivate only when ordres/modeles return to scope, then complete placeholder guidance, archive action and default-template workflow QA |
| Offline and production | Initial Dexie shell, sync center shell, health checks | Resume only after this recovery gate; complete Serwist, batch sync, conflict resolution, observability and deployment gates afterward |

## Baseline Organigramme Extraction

Personnel extraction from an uploaded organigramme image or PDF is part of the original brief. It is not deferred.

The baseline workflow is:

1. Upload an organigramme image or PDF to a client.
2. Create an extraction job with a visible processing status.
3. Produce reviewable personnel rows: name, role, phone and email when detected.
4. Require a user review before storing rows in `ClientPersonnel`.
5. Preserve the original document and audit the confirmation.

Advanced OCR automation remains deferred: unattended enrichment, confidence-based auto-approval, complex table reconstruction, and bulk historical backfill.

## Recovery Delivery Order

1. Complete client capture, uploads, extraction review and client exports.
2. Complete consultant account linking, availability and restore workflows.
3. Complete mission edit, explicit responsable selection and calendar creation shortcuts.
4. Complete manual historical ordre creation, ordre editing and template management.
5. Complete password reset, throttling, user administration and session revocation.
6. Run mobile-first browser QA at 320px, 375px, 390px, tablet and desktop widths.
7. Resume offline-first infrastructure and production hardening.

## Completed Increments

### Client capture and private document foundation

- Client creation captures the persisted calendar accent, responsible consultants and cadre contacts.
- Client editing exposes the persisted calendar accent.
- Client creation stages available legal documents and transfers them after the client record exists.
- Partial staged-upload failures redirect to the fiche with an explicit retry message.
- Shared document-specific upload rules drive both frontend guidance and NestJS validation.
- Authorized document removal deletes the private Storage object and its metadata after confirmation.
- Client detail renders linked mission history instead of an empty placeholder.

### Calendar planning correction

- Mission cards distinguish `Présentielle` and `En ligne` with token-based mode colors and visible labels.
- Calendar planning uses Monday through Saturday as the bureau working week and hides Sunday.
- Mobile calendar supports day and month views; the phone week view was removed to keep planning compact.
- Ordres de mission and modeles are temporarily disabled in the web app and return 404 until this workflow is reactivated.

## Definition Of Done

Each recovered workflow must include shared validation, API behavior, mobile UI, desktop enhancement, loading, empty, error and forbidden states, archive or restore semantics where relevant, audit records, and a browser QA pass.
