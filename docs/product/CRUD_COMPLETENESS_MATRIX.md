# ABC CRM CRUD completeness matrix

This document tracks what is actually implemented, partially implemented, and still missing against the original bureau d'etude scope.

## Status legend

- Complete: API and UI expose the workflow with validation, state handling, and navigation.
- Partial: useful pieces exist, but the workflow is not complete end to end.
- Missing: not implemented or only present as a placeholder.

## Module matrix

| Module | Current status | Implemented | Missing or partial |
| --- | --- | --- | --- |
| Auth | Partial | Custom login, logout, refresh, `/auth/me`, protected shell, password reset request/confirm pages, session expired page, logged-out page, session revocation UI, account disabling UI, role/user admin screens. | Email delivery for reset links, login throttling polish, 2FA, dedicated session browser. |
| Clients | Partial | List, detail, create, edit, archive, restore, responsible consultants, cadre contacts, legal document upload foundation, CSV export, sortable list, page-size selector, row actions, bulk archive/restore. | PDF export UI, organigramme extraction and review, optional column visibility, audit/conflict states. |
| Consultants | Partial | List, detail, create, edit, archive, restore, linked account display. | Linked account management, availability context editing, archive filter polish, delete/restore policy documentation, full table controls. |
| Calendar and missions | Partial | Calendar workspace, mission create, mission detail/edit, mission mode colors, Monday-Saturday work week, mobile day/month views, mission updates through API. | Drag/drop persistence QA, click-to-create from calendar date, full cancellation review flow, archive/restore policy. |
| Ordres de mission | Disabled in web | Backend and legacy components still exist, but routes intentionally return 404 while this module is paused. | Reactivate UI only when scheduled, then finish manual ordre create/edit, archived filter, restore model, older ordre import/historical flow. |
| Templates | Disabled in web | Backend and legacy TipTap components still exist, but routes intentionally return 404 while this module is paused. | Reactivate UI only when scheduled, then finish preview, placeholder validation display, default management audit trail view, richer template states. |
| Files | Partial | Backend-owned upload validation and client document association. | Signed download routes, private Supabase Storage policy verification, malware scan placeholder/implementation, upload retry state. |
| Offline/sync | Partial | Offline-oriented architecture docs and sync center shell. | Dexie repositories, outbox mutations, encrypted upload staging, batch sync, conflict diff/resolve UI. |
| Admin | Missing | Basic role checks exist in API guards. | Users, roles, sessions, settings, archives, audit log browser, uptime/backup operations UI. |
| Exports | Partial | Ordre CSV/XLSX/PDF/print server paths. | Client exports, consultant exports, table toolbar exports, print styles beyond ordres. |
| Tests and QA | Partial | Typecheck, lint, build, some browser smoke paths have been used. | CRUD integration tests for restore/archive, Playwright flows for every module, accessibility and offline tests. |

## Next implementation order

1. Finish exposed CRUD for existing modules: mission edit, manual ordre create/edit, archived filters in list pages, client exports.
2. Close original client scope: organigramme extraction upload review and personnel confirmation before storage.
3. Build admin surfaces: users, linked consultant accounts, sessions, account disabling, audit logs.
4. Build offline infrastructure after CRUD workflows are honest end to end.

## Notes

- Ordre restore is intentionally not implemented yet. The current archive operation overwrites the previous lifecycle status with `ARCHIVED`, so restoring to `DRAFT` would be inaccurate. Add a previous-status field or an archive event model before enabling restore.
- Mission archive currently represents cancellation semantics. Restore needs a domain decision because it can conflict with linked ordre state.
