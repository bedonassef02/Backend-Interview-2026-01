# Time Tracking

> **Candidate:** Abdelrahman
> **Date:** 2026-02-27

| Phase     | Task                                                                                                               | Duration               |
| --------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Design    | Analysis & planning → `implementation_plan.md`                                                                     | ~30 min                |
| Phase 1   | Project initialization (NestJS, deps, tsconfig, env)                                                               | ~0 min (single commit) |
| Phase 2   | Core infrastructure (AppModule, global filter, logging interceptor, Swagger bootstrap)                             | ~30 min                |
| Phase 3   | Database service (JSON file read/write, bulkInsert, reset, metadata)                                               | ~30 min                |
| Phase 4   | Authentication module (JWT strategy, API key guard, env validation via Joi, login endpoint, DTO)                   | ~60 min                |
| Phase 5   | Bulk upload service (streaming CSV parse, record limit, data normalisation, file signature validation)             | ~90 min                |
| Phase 6   | Frontend interface (`public/index.html` — dark UI, drag-and-drop, table, reset, server-side pagination & controls) | ~75 min                |
| Phase 7   | Sample CSV data files                                                                                              | ~10 min                |
| Phase 8   | Testing (unit + e2e, 141 tests)                                                                                    | ~20 min                |
| Phase 9   | Security & hardening (CORS, concurrency, combined guards)                                                          | ~15 min                |
| Phase 10  | Formatting / Prettier                                                                                              | ~5 min                 |
| Phase 11  | Documentation (README, TIME_TRACKING, Swagger annotations, plan updates)                                           | ~5 min                 |
| **TOTAL** |                                                                                                                    | **~4h 50min**          |

---

## Significant Implementation Notes

* **uuid v13 ESM compatibility** — `uuid` v13 is pure ESM but Jest runs in CJS mode. Resolved by creating `__mocks__/uuid.js` (manual CJS mock) and configuring `moduleNameMapper` in Jest config.
* **csv-parser streaming** — chose streaming over buffer parsing to keep memory constant regardless of file size.
* **File signature validation** — beyond MIME type checking, buffer magic bytes are inspected to prevent extension spoofing (e.g., a PNG renamed to `.csv`).
* **Data normalisation** — automatic type coercion (string → number / boolean / null) is applied per field via `normalizeRow()` in `BulkUploadService`.
* **Server-side pagination** — frontend table integrates with backend paging and sorting controls.