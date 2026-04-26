# Auth And Profile APIs

## 1. Module Purpose

This module is responsible for:

- owner/business registration
- credential login
- Firebase login
- password reset flow
- profile bootstrap for logged-in users
- waiter analytics tied to logged-in identity

This module is the entry point into the rest of the application because almost every protected feature depends on a valid authenticated identity and an active branch context.

## 2. Route Bases

- `/api/auth`
- `/api/profile`

## 3. Main Middleware And Rules

### Auth routes

Some auth routes are public, but still protected by:

- payload validation
- rate limiting on sensitive endpoints

### Profile routes

Profile routes require:

- `Authorization`
- `x-branch-id`

They also depend on:

- valid session resolution
- active branch membership resolution

## 4. Endpoint Reference

### `POST /api/auth/register`

#### Purpose

Creates a new top-level account and starts business setup.

#### Typical request fields

- `name`
- `email`
- `phone`
- `password`
- `cafeName`
- `branchName`

#### Important rules

- email must be valid
- password rules are validated at route level
- this is more than just “create a user”; it is part of initial tenant/business creation flow

#### Developer notes

If registration behavior changes, inspect:

- auth controller
- user creation logic
- branch/organization initialization logic

### `POST /api/auth/login`

#### Purpose

Logs a user in using credentials.

#### Supported identity inputs

- `email`
- `phone`
- `identifier`

#### Required fields

- `password`

#### Important rules

- rate limiter applies
- the route validates that at least one supported identity field exists
- login success must map user identity into backend session flow

#### Developer notes

This route is critical because frontend bootstrapping, socket auth, and protected APIs all depend on it.

### `POST /api/auth/firebase-login`

#### Purpose

Logs a user in using Firebase-issued identity token.

#### Required fields

- `idToken`

#### Important rules

- rate-limited
- route validation rejects empty token
- backend should still enforce active membership constraints

#### Developer notes

This route is important because the app supports hybrid auth behavior. If session mismatch happens between frontend and backend, inspect this route together with shared auth/session utilities.

### `POST /api/auth/forgot-password`

#### Purpose

Starts password reset flow.

#### Required fields

- `email`

#### Developer notes

Used for recovery, not authenticated session usage.

### `POST /api/auth/reset-password`

#### Purpose

Completes password reset using issued token.

#### Required fields

- `token`
- `password`

#### Important rules

- password minimum length validation applies

### `POST /api/auth/check-phone`

#### Purpose

Checks phone-related auth conditions.

#### Required fields

- `phone`

#### Developer notes

Useful in hybrid phone/auth or pre-check flows.

## 5. Profile Endpoints

### `GET /api/profile/me`

#### Purpose

Returns currently authenticated user profile in branch context.

#### Typical uses

- frontend auth bootstrap
- user header/profile widget
- role-aware rendering
- permission-aware UI logic

#### Important behavior

- identity alone is not enough
- branch membership context matters

### `GET /api/profile/waiter/analytics`

#### Purpose

Returns waiter-specific analytics for the logged-in user.

#### Typical uses

- waiter dashboard metrics
- staff performance summary

#### Important behavior

- backend should only return analytics relevant to authenticated identity and active branch

## 6. How This Module Connects To Other Modules

This module connects directly to:

- users
- roles/permissions
- branch membership
- orders
- dashboards
- socket auth
- notifications

If auth breaks, almost every other module becomes unusable or unsafe.

## 7. Debugging Checklist For New Developers

If login or profile loading is broken, check in this order:

1. route validator chain
2. auth controller
3. auth middleware
4. branch scope middleware
5. token storage / session handling on frontend
6. user membership data

## 8. High-Risk Notes

- Changes in auth can cause hidden failures across frontend session restore, API access, and realtime connections.
- Always verify both credential login and Firebase login if making auth changes.
