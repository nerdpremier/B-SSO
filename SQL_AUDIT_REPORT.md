# SQL Schema Audit Report - B-SSO (Behavioral Risk-Based Single Sign-On)

**Audit Date:** 2026-03-22
**Auditor:** Claude Code
**Scope:** Complete database schema, migrations, and query consistency

---

## Executive Summary

| Category | Status | Count |
|----------|--------|-------|
| Critical Issues | 🔴 3 | Missing tables, schema drift |
| High Issues | 🟠 4 | Missing indexes, performance risks |
| Medium Issues | 🟡 6 | Missing columns, consistency |
| Low Issues | 🟢 5 | Naming conventions, optimizations |

---

## 1. CRITICAL ISSUES

### 🔴 Issue 1: Schema File Incomplete - Missing Tables

**Description:** The `sso_schema.sql` file does not include all tables used by the application. Two critical tables are created dynamically at runtime:

**Missing Tables:**
1. **`behavior_risks`** - Created in `lib/risk-score.js:81-91`
2. **`stepup_challenges`** - Created in `lib/risk-score.js:130-140`

**Impact:**
- New deployments from scratch will fail when code tries to query these tables
- Database migrations are not trackable
- No visibility in schema documentation

**Evidence:**
```javascript
// lib/risk-score.js lines 75-91
await pool.query(
    `CREATE TABLE IF NOT EXISTS behavior_risks (
        id BIGSERIAL PRIMARY KEY,
        request_id TEXT,
        username TEXT NOT NULL,
        ...
    )`
);

// lib/risk-score.js lines 127-140
await pool.query(
    `CREATE TABLE IF NOT EXISTS stepup_challenges (
        id UUID PRIMARY KEY,
        username TEXT NOT NULL,
        ...
    )`
);
```

**Fix:** Add these tables to `sso_schema.sql`

---

### 🔴 Issue 2: Schema Drift - Missing Columns in login_risks

**Description:** The `login_risks` table definition in `sso_schema.sql` is missing 8 columns that are dynamically added via `ensureLoginRisksSchema()`:

**Missing Columns:**
| Column | Type | Used In |
|--------|------|---------|
| `pre_login_score` | DOUBLE PRECISION | assess.js:234, behavior.js:320-363 |
| `combined_score` | DOUBLE PRECISION | behavior.js:407-426 |
| `combined_action` | TEXT | auth.js:410, mfa.js:175, 364 |
| `session_jti` | TEXT | behavior.js:336-344, auth.js:499-504 |
| `last_behavior_at` | TIMESTAMPTZ | behavior.js:423 |
| `behavior_samples` | INTEGER | behavior.js:424 |

**Impact:**
- Fresh database deployments will have runtime schema alterations
- Schema is not self-documenting
- Potential for silent failures if runtime migrations fail

**Fix:** Include all columns in the CREATE TABLE statement

---

### 🔴 Issue 3: Column Type Mismatch - VARCHAR vs TEXT

**Description:** Schema defines `username` as `VARCHAR(32)` in some tables but uses `TEXT` in runtime-created tables, causing inconsistency.

**Tables with inconsistent username types:**
- `behavior_risks.username` - TEXT (should be VARCHAR(32))
- `stepup_challenges.username` - TEXT (should be VARCHAR(32))

**Fix:** Standardize all username columns to VARCHAR(32) with NOT NULL constraint

---

## 2. HIGH PRIORITY ISSUES

### 🟠 Issue 4: Missing Index on revoked_tokens

**Description:** The `session.js` query performs a LEFT JOIN on `revoked_tokens` filtering by `jti` and `expires_at`:

```sql
-- session.js:89-96
SELECT u.sessions_revoked_at, rt.jti AS revoked_jti
FROM users u
LEFT JOIN revoked_tokens rt
  ON rt.jti = $2 AND rt.expires_at > NOW()
WHERE u.username = $1
```

**Current Index:** `idx_revoked_tokens_expires ON revoked_tokens (expires_at)`

**Problem:** The index only covers `expires_at`, but the query filters on `jti` first. Without an index on `jti`, PostgreSQL must perform a sequential scan.

**Recommended Fix:**
```sql
-- Add composite index
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti_expires
ON revoked_tokens (jti, expires_at);
```

---

### 🟠 Issue 5: Missing Index on login_risks for session_jti queries

**Description:** Multiple queries in `behavior.js` query `login_risks` by `session_jti`:

```sql
-- behavior.js:336-344
SELECT id, pre_login_score FROM login_risks
WHERE username = $1 AND session_jti = $2 AND is_success = TRUE

-- behavior.js:379-387 (behavior_risks medium count)
SELECT COUNT(*)::int AS cnt FROM behavior_risks
WHERE username = $1 AND session_jti = $2 AND combined_action = 'medium'
```

**Current Indexes:** None covering (username, session_jti)

**Note:** The code attempts to create indexes at runtime in `lib/risk-score.js:53-65` but these are not in the schema file.

**Recommended Fix:**
```sql
-- Add these to sso_schema.sql
CREATE INDEX IF NOT EXISTS idx_login_risks_session_jti
ON login_risks (username, session_jti);

CREATE INDEX IF NOT EXISTS idx_login_risks_is_success
ON login_risks (username, is_success, created_at DESC);
```

---

### 🟠 Issue 6: Missing Foreign Key on login_risks.username

**Description:** The `login_risks` table stores `username` but has no FOREIGN KEY constraint to `users(username)`. This can lead to orphaned records if a user is deleted.

**Current Definition:**
```sql
CREATE TABLE IF NOT EXISTS login_risks (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(32) NOT NULL,  -- No FK constraint
    ...
);
```

**Recommended Fix:**
```sql
-- Add foreign key constraint
ALTER TABLE login_risks
ADD CONSTRAINT fk_login_risks_username
FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE;
```

**Note:** This may impact performance on high-volume inserts. Consider application-level enforcement if performance is critical.

---

### 🟠 Issue 7: No Index on behavior_risks for Medium Count Queries

**Description:** The escalation logic in `behavior.js:379-387` counts medium-risk events:

```sql
SELECT COUNT(*)::int AS cnt
FROM behavior_risks
WHERE username = $1
  AND session_jti = $2
  AND combined_action = 'medium'
  AND created_at > NOW() - INTERVAL '8 hours'
```

**Recommended Fix:**
```sql
CREATE INDEX IF NOT EXISTS idx_behavior_risks_escalation
ON behavior_risks (username, session_jti, combined_action, created_at);
```

---

## 3. MEDIUM PRIORITY ISSUES

### 🟡 Issue 8: Unused Columns Potentially

**Description:** Review the following columns for actual usage:

| Table | Column | Status |
|-------|--------|--------|
| `login_risks` | `device` | Used (inserted in assess.js:234) |
| `login_risks` | `total_mfa_attempts` | Used in auth.js, mfa.js |
| `behavior_risks` | `request_id` | Used, has index |

All columns appear to be in use. ✅

---

### 🟡 Issue 9: Missing NOT NULL Constraints

**Description:** Some columns should likely have NOT NULL constraints:

| Table | Column | Current | Recommended |
|-------|--------|---------|-------------|
| `behavior_risks` | `session_jti` | NOT NULL | Keep |
| `behavior_risks` | `behavior_score` | NULL | Keep (allows insert before engine response) |
| `stepup_challenges` | `session_jti` | NULL | Review - may need NOT NULL |

---

### 🟡 Issue 10: Query Pattern - Repeated SELECT pattern in behavior.js

**Description:** The `behavior.js` file has 3 nearly identical queries for looking up pre-login scores (lines 319-366). This pattern could be consolidated:

```javascript
// Lines 319-332 - by ID
// Lines 336-348 - by session_jti
// Lines 352-366 - fallback recent
```

**Recommendation:** Consider a single query with COALESCE or a view.

---

### 🟡 Issue 11: Index Naming Inconsistency

**Description:** Index naming conventions vary:

| Index | Naming |
|-------|--------|
| `idx_users_username` | ✅ Standard |
| `idx_email_verifications_user` | ⚠️ Should be `idx_email_verifications_user_id` |
| `idx_oauth_codes_client` | ⚠️ Should be `idx_oauth_codes_client_id` |
| `login_risks_session_jti_idx` | ⚠️ Different pattern (runtime created) |

---

### 🟡 Issue 12: Missing ON DELETE Behavior Documentation

**Description:** Foreign key constraints exist but ON DELETE behavior should be documented:

| Table | FK | ON DELETE |
|-------|-----|-----------|
| `email_verifications` | user_id | CASCADE ✅ |
| `sso_tokens` | user_id | CASCADE ✅ |
| `oauth_clients` | owner_username | CASCADE ✅ |
| `oauth_codes` | client_id | CASCADE ✅ |
| `oauth_tokens` | client_id | CASCADE ✅ |

All FKs have CASCADE which is appropriate for this domain.

---

## 4. LOW PRIORITY ISSUES

### 🟢 Issue 13: Potential Integer Overflow

**Description:** `login_risks.id` is `BIGSERIAL` but some code compares with `Number.MAX_SAFE_INTEGER`:

```javascript
// mfa.js:136
if (!Number.isInteger(parsedLogId) || parsedLogId <= 0 || parsedLogId > Number.MAX_SAFE_INTEGER)
```

**Impact:** Minimal - BIGINT can store up to 9 quintillion, unlikely to overflow.

---

### 🟢 Issue 14: Cleanup Query Pattern

**Description:** The cleanup queries in `lib/cleanup.js` delete rows without LIMIT. For large tables, this could cause:
- Long-running transactions
- Table bloat
- Replication lag

**Recommendation:** For production with high volume, consider:
```sql
-- Batch deletion with LIMIT
DELETE FROM rate_limit_events
WHERE id IN (
    SELECT id FROM rate_limit_events
    WHERE created_at < NOW() - INTERVAL '2 hours'
    LIMIT 10000
);
```

---

### 🟢 Issue 15: No Unique Constraint on rate_limit_events

**Description:** The `rate_limit_events` table has no unique constraints. This is by design (sliding window) but consider if deduplication is needed.

---

## 5. CORRECT AND WELL-DESIGNED ELEMENTS

### ✅ Parameterized Queries
All SQL queries use parameterized statements with `$1, $2...` placeholders. No SQL injection vulnerabilities detected.

### ✅ Transaction Management
Proper transaction handling with BEGIN/COMMIT/ROLLBACK in critical paths:
- `auth.js` login flow
- `mfa.js` verification flow
- `oauth.js` authorization flow

### ✅ Advisory Locks
Proper use of PostgreSQL advisory locks in `assess.js:189-192`:
```sql
SELECT pg_advisory_xact_lock(('x' || substr(md5($1), 1, 16))::bit(64)::bigint)
```

### ✅ Atomic CTE Pattern
The `rate-limit.js` uses atomic CTE for rate limiting - excellent pattern for concurrency safety.

### ✅ Index Coverage for Common Queries
Most frequent queries have appropriate indexes:
- `users.username` - indexed ✅
- `users.email` - indexed (functional index on LOWER) ✅
- `oauth_tokens.token_hash` - unique constraint (indexed) ✅
- `oauth_codes.code_hash` - unique constraint (indexed) ✅

---

## 6. RECOMMENDED MIGRATION SCRIPT

```sql
-- ============================================
-- B-SSO Schema Completion Migration
-- Run this after sso_schema.sql on new deployments
-- ============================================

-- 1. Add missing columns to login_risks
ALTER TABLE login_risks
    ADD COLUMN IF NOT EXISTS pre_login_score DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS combined_score DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS combined_action TEXT,
    ADD COLUMN IF NOT EXISTS session_jti TEXT,
    ADD COLUMN IF NOT EXISTS last_behavior_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS behavior_samples INTEGER DEFAULT 0;

-- 2. Create behavior_risks table
CREATE TABLE IF NOT EXISTS behavior_risks (
    id BIGSERIAL PRIMARY KEY,
    request_id TEXT,
    username VARCHAR(32) NOT NULL,
    session_jti TEXT NOT NULL,
    behavior_score DOUBLE PRECISION,
    combined_score DOUBLE PRECISION,
    combined_action TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavior_risks_session
ON behavior_risks (username, session_jti, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_behavior_risks_escalation
ON behavior_risks (username, session_jti, combined_action, created_at);

-- 3. Create stepup_challenges table
CREATE TABLE IF NOT EXISTS stepup_challenges (
    id UUID PRIMARY KEY,
    username VARCHAR(32) NOT NULL,
    session_jti TEXT,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stepup_challenges_user_time
ON stepup_challenges (username, created_at DESC);

-- 4. Add missing indexes on login_risks
CREATE INDEX IF NOT EXISTS idx_login_risks_session_jti
ON login_risks (username, session_jti);

CREATE INDEX IF NOT EXISTS idx_login_risks_is_success
ON login_risks (username, is_success, created_at DESC);

-- 5. Add missing index on revoked_tokens
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti_expires
ON revoked_tokens (jti, expires_at);

-- 6. Add foreign key constraint (optional - may impact performance)
-- ALTER TABLE login_risks
-- ADD CONSTRAINT fk_login_risks_username
-- FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE;
```

---

## 7. ACTION ITEMS SUMMARY

| Priority | Action | Owner |
|----------|--------|-------|
| **P0** | Update `sso_schema.sql` with complete schema | DBA |
| **P0** | Create migration script for existing deployments | DBA |
| **P1** | Add index `idx_revoked_tokens_jti_expires` | DBA |
| **P1** | Add index `idx_behavior_risks_escalation` | DBA |
| **P2** | Standardize column naming conventions | Developer |
| **P2** | Document runtime schema migrations | Architect |
| **P3** | Review cleanup batch sizing | Developer |

---

## 8. VERIFICATION CHECKLIST

- [ ] Running `sso_schema.sql` + migration creates all required tables
- [ ] Application starts without runtime schema errors
- [ ] All queries execute with index scans (no seq scans on large tables)
- [ ] Foreign key constraints prevent orphaned records
- [ ] Cleanup jobs complete without long-running transactions

---

## Appendix: Table Reference

| Table | Purpose | Row Est. | Has Complete Schema |
|-------|---------|----------|---------------------|
| users | Core user accounts | ~10K-100K | ✅ Yes |
| email_verifications | Email verification tokens | ~1K | ✅ Yes |
| login_risks | Risk assessment records | ~100K+ | ⚠️ Missing columns |
| user_devices | Remembered devices | ~50K | ✅ Yes |
| revoked_tokens | Session revocation | ~10K | ✅ Yes |
| sso_tokens | One-time SSO tokens | ~5K | ✅ Yes |
| rate_limit_events | Rate limiting | ~100K+ | ✅ Yes |
| oauth_clients | OAuth applications | ~1K | ✅ Yes |
| oauth_codes | Authorization codes | ~5K | ✅ Yes |
| oauth_tokens | Access/refresh tokens | ~50K | ✅ Yes |
| behavior_risks | Post-login behavior | ~500K+ | ❌ Missing from schema |
| stepup_challenges | Step-up MFA | ~1K | ❌ Missing from schema |

---

*End of Audit Report*
