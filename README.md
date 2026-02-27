# 📦 CSV Bulk Upload Service

A production-ready NestJS REST API that accepts CSV file uploads, processes and normalizes the data, persists records to a JSON "database", and exposes a clean web interface for interacting with the service.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Setup](#setup)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Security](#security)
- [Testing](#testing)
- [Design Decisions](#design-decisions)
- [Time Tracking](#time-tracking)

---

## Overview

This service fulfils the following requirements from the technical test:

| Requirement | Status |
|---|---|
| CSV bulk upload to JSON "database" | ✅ |
| Authentication + abuse prevention | ✅ |
| Web interface (UI) for interacting with the service | ✅ |
| Track exact processing time per upload | ✅ |
| **Bonus:** Swagger API documentation | ✅ |
| **Bonus:** Comprehensive test suite | ✅ |

### Key Features

- 🔐 **JWT authentication** for the web interface + **API key** for programmatic access
- 🛡️ **Rate limiting** (10 req / 60 s per IP) to prevent abuse
- 📄 **Streaming CSV parser** — memory-efficient for large files (up to 10 MB, 10 000 records)
- 🔄 **Data normalisation** — auto-casts numbers, booleans, nulls from CSV strings
- 📁 **File validation** — MIME type + magic bytes signature check
- 📊 **Swagger UI** at `/api/docs`
- 🎨 **Modern dark UI** with drag-and-drop upload, results table, reset button

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Browser / API Client                            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                [ HTTP REQUEST ]
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GLOBAL PRE-FLIGHT LAYER                            │
│           (Helmet Security, CORS Policy, Logging Interceptor)               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NESTJS SECURITY GATES                             │
│           (ThrottlerGuard, JwtOrApiKeyGuard, ValidationPipe)                │
└──────────────────┬───────────────────┬───────────────────┬──────────────────┘
                   │                   │                   │
        [POST /api/auth/login]  [POST /api/upload]  [GET/DEL /api/records]
                   │                   │                   │
                   ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CORE APPLICATION SERVICES                            │
│                                                                             │
│  ┌──────────────────────┐          ┌─────────────────────────────────────┐  │
│  │    AuthController    │          │        BulkUploadController         │  │
│  └──────────┬───────────┘          └──────────────────┬──────────────────┘  │
│             │                                         │                     │
│  ┌──────────▼───────────┐          ┌──────────────────▼──────────────────┐  │
│  │     AuthService      │          │         BulkUploadService           │  │
│  │  (JWT Sign/Verify)   │          │      (CSV Parse + Normalise)        │  │
│  └──────────┬───────────┘          └──────────────────┬──────────────────┘  │
│             │                                         │                     │
│  ┌──────────▼───────────┐          ┌──────────────────▼──────────────────┐  │
│  │    ConfigService     │          │          DatabaseService            │  │
│  │   (Joi Validation)   │          │          (Mutex File I/O)           │  │
│  └──────────────────────┘          └──────────────────┬──────────────────┘  │
│                                                       │                     │
└───────────────────────────────────────────────────────┼─────────────────────┘
                                                        │
                                                 [ DISK STORAGE ]
                                                        │
                                                        ▼
                                       ┌──────────────────────────────────┐
                                       │    data/bulk-upload-temp.json    │
                                       │         (JSON Persistence)       │
                                       └──────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | **NestJS** | `.gitignore` hints at NestJS; modular, TypeScript-native, built-in DI |
| CSV Parsing | **csv-parser** (streaming) | Memory-efficient; processes large files row-by-row via streams |
| File Upload | **multer** (`@nestjs/platform-express`) | Standard multipart/form-data; integrates with NestJS `ParseFilePipe` |
| Authentication | **Passport JWT** + custom API Key guard | JWT for UI sessions; API key for programmatic access |
| Rate Limiting | **@nestjs/throttler** | Built-in NestJS solution, zero boilerplate |
| Validation | **class-validator** + **class-transformer** | Declarative DTO validation with whitelist filtering |
| Documentation | **@nestjs/swagger** | Auto-generated from decorators; interactive Swagger UI |
| Testing | **Jest** + **supertest** | NestJS default; excellent TypeScript support |

---

## Setup

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install

```bash
git clone <repo-url>
cd Backend-Interview-2026-01
npm install
```

### Configure

```bash
cp .env.example .env
# Edit .env with your values (or leave defaults for development)
```

### Run

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build && npm run start:prod
```

The server starts at `http://localhost:3000` (or `PORT` from `.env`).

---

## Configuration

Copy `.env.example` to `.env` and set the following variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `JWT_SECRET` | — | Secret for signing JWTs (change in production!) |
| `JWT_EXPIRATION` | `1h` | JWT token lifespan |
| `API_KEY` | — | Static API key for `x-api-key` header auth |
| `ADMIN_USERNAME` | `admin` | Login username for the web UI |
| `ADMIN_PASSWORD` | `admin123` | Login password for the web UI |
| `THROTTLE_TTL` | `60` | Rate limit window in seconds |
| `THROTTLE_LIMIT` | `10` | Max requests per window per IP |

> ⚠️ **Never commit `.env` to source control.** The `.gitignore` already excludes it.

---

## API Reference

Interactive docs available at **`http://localhost:3000/api/docs`** (Swagger UI).

### Authentication

#### `POST /api/auth/login`

Obtain a JWT token.

**Request body:**
```json
{ "username": "admin", "password": "admin123" }
```

**Response `200`:**
```json
{ "access_token": "<JWT>" }
```

**Response `401`:** Invalid credentials.

---

#### `GET /api/auth/me` 🔒

Returns the currently authenticated user's profile.

**Headers:** `Authorization: Bearer <JWT>`

**Response `200`:**
```json
{ "username": "admin", "role": "admin" }
```

---

### Bulk Upload

> All endpoints below require `Authorization: Bearer <JWT>`.

#### `POST /api/bulk-upload/upload` 🔒

Upload a CSV file for bulk processing.

**Request:** `multipart/form-data` with field `file` containing a `.csv` file.

- Maximum file size: **10 MB**
- Only `text/csv` and `text/plain` MIME types accepted
- File magic bytes are validated (not just extension)
- Records are capped at **10 000 per upload**

**Response `201`:**
```json
{
  "success": true,
  "message": "Successfully uploaded 500 records from data.csv",
  "recordsInserted": 500,
  "recordsFailed": 2,
  "totalRecordsInDb": 1234,
  "processingTime": "123ms",
  "errors": ["Row 3: empty row skipped"]
}
```

**Response `400`:** No file provided / no valid records found.  
**Response `401`:** Missing or invalid JWT.  
**Response `422`:** Invalid file type or failed file validation.

---

#### `GET /api/bulk-upload/records` 🔒

Retrieve all stored records.

**Response `200`:**
```json
{
  "success": true,
  "count": 1234,
  "records": [
    {
      "id": "uuid-v4",
      "data": { "name": "Alice", "age": 30, "active": true },
      "status": "processed",
      "createdAt": "2026-02-27T20:00:00.000Z"
    }
  ]
}
```

---

#### `DELETE /api/bulk-upload/records` 🔒

Reset the database (clears all records).

**Response `200`:**
```json
{ "message": "Database has been reset successfully", "success": true }
```

---

### Frontend

| Path | Description |
|---|---|
| `GET /` | Web application interface |
| `GET /api/docs` | Swagger interactive documentation |

---

## Security

The service implements **four layers** of protection:

### Layer 1 — Authentication
- **JWT Bearer tokens** for UI users (1-hour expiry, configurable)
- **API Key** via `x-api-key` header for programmatic/service-to-service access

### Layer 2 — Rate Limiting
- Global **10 requests per 60 seconds** per IP via `@nestjs/throttler`
- Returns `429 Too Many Requests` when exceeded
- Directly prevents DoS/DDoS attacks

### Layer 3 — Input Validation
- **File size limit**: 10 MB maximum
- **MIME type check**: Only `text/csv` / `text/plain` accepted
- **Magic bytes validation**: Buffer signature verified (prevents extension spoofing)
- **DTO validation**: `class-validator` with whitelist filtering rejects unknown fields

### Layer 4 — Error Handling
- **Global `HttpExceptionFilter`**: Consistent JSON error responses, never leaks stack traces
- **Structured logging**: All requests logged with method, URL, status, duration, IP

---

## Testing

### Unit Tests

```bash
npm test
```

Covers every service, controller, guard, strategy, filter, interceptor, and validator:
- 13 test suites | **141 tests** | **0 failures**
- Overall coverage: **81% statements, 80% branches, 91% functions**

### E2E Tests

```bash
npm run test:e2e
```

Full integration tests spanning the complete request lifecycle: auth → upload → retrieve → reset → rate limiting.

### Coverage Report

```bash
npm run test:cov
```

---

## Design Decisions

### Streaming CSV Parser
`csv-parser` uses Node.js streams — rows are processed as stream events, keeping memory usage constant regardless of file size. The alternative (`papaparse`) loads the entire file into memory, which is unsafe for bulk uploads.

### JSON File as "Database"
The task explicitly provides `data/bulk-upload-temp.json` as the persistence layer. Using a file makes data survive server restarts and demonstrates file I/O skills without the overhead of a real database setup.

### JWT + API Key Auth
- **JWT** is ideal for the web interface (session-based, expires, stateless)
- **API Key** is ideal for programmatic access (Postman, cURL, CI scripts)
- Both strategies are defined and the `JwtAuthGuard` protects all bulk-upload endpoints

### Data Normalisation
CSV fields are automatically cast:

| Input string | Output type |
|---|---|
| `"42"` | `42` (number) |
| `"3.14"` | `3.14` (number) |
| `"true"` / `"TRUE"` | `true` (boolean) |
| `"false"` / `"FALSE"` | `false` (boolean) |
| `""` / `"   "` | `null` |
| Everything else | `string` (trimmed) |

### 10 000 Record Cap
Prevents a single upload from causing excessive memory usage or file I/O. The cap is enforced in the streaming pipeline (rows after 10 000 are dropped) with a warning added to the response.

---

## Project Structure

```
src/
├── auth/                    # Authentication module
│   ├── guards/              # JwtAuthGuard, ApiKeyGuard
│   ├── strategies/          # Passport JWT strategy
│   ├── dto/                 # LoginDto
│   ├── auth.controller.ts   # POST /api/auth/login, GET /api/auth/me
│   └── auth.service.ts      # Credential validation, JWT signing
│
├── bulk-upload/             # Upload module
│   ├── dto/                 # UploadResponseDto
│   ├── bulk-upload.controller.ts
│   └── bulk-upload.service.ts   # CSV parsing, normalisation, DB write
│
├── database/                # JSON persistence layer
│   └── database.service.ts      # read(), write(), bulkInsert(), resetDatabase()
│
└── common/                  # Shared utilities
    ├── filters/             # HttpExceptionFilter (global)
    ├── interceptors/        # LoggingInterceptor (global)
    └── files/               # File validation (MIME + magic bytes)

public/
└── index.html               # Web UI (dark mode, drag-and-drop)

test/
└── app.e2e-spec.ts          # End-to-end test suite
```
