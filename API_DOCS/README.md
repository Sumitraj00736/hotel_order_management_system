# Backend API Docs

This folder is the long-form backend API reference for developers working on the Hotel OMS project.

The goal of this documentation is not just to list endpoints. It is meant to help a new developer understand:

- how the backend is organized
- how requests move through middleware
- which headers are required
- how branch scoping works
- how permissions are enforced
- what each feature area is responsible for
- what the important business rules are
- where to look in code when behavior is unclear

This documentation should be treated as the human-friendly companion to the actual code.

The runtime source of truth is still the backend code inside:

- `backend/src/routes`
- `backend/src/controllers`
- `backend/src/middleware`
- `backend/src/models`
- `backend/src/utils`

## 1. Backend Structure At A Glance

The backend is broadly organized like this:

1. `routes`
   - Defines public API surface
   - Applies auth, branch, permission, and validation middleware

2. `controllers`
   - Handles request orchestration
   - Calls models/utilities
   - Applies business flow rules

3. `middleware`
   - Handles shared cross-cutting concerns such as:
   - authentication
   - branch selection
   - request validation
   - permission enforcement
   - request tracing

4. `models`
   - Mongoose schemas for persistent data

5. `utils`
   - Shared business helpers
   - calculation utilities
   - lifecycle guards
   - observability helpers
   - notification and realtime helpers

## 2. Global API Base

All application APIs are mounted under:

```text
/api
```

Examples:

- `/api/auth/login`
- `/api/orders`
- `/api/purchases`
- `/api/reports/summary`

## 3. Common Request Types

There are 3 practical categories of API access in this backend.

### A. Public APIs

These do not require a login token.

Examples:

- public cafe page data
- public slug lookup

### B. Guest APIs

These also do not require a staff login, but they are not fully unrestricted public business APIs.

They usually work through:

- guest branch resolution
- cafe slug context
- public table ordering flow

Examples:

- guest menu
- guest table status
- guest order creation

### C. Staff/Admin APIs

These are protected APIs used by:

- admin dashboard
- waiter app
- kitchen app
- finance screens
- settings pages

They usually require:

- `Authorization: Bearer <token>`
- `x-branch-id: <branchId>`

## 4. Common Headers

### Authorization Header

Most protected APIs require:

```text
Authorization: Bearer <token>
```

This token is resolved by the backend auth middleware.

### Branch Header

Most branch-sensitive APIs require:

```text
x-branch-id: <branchId>
```

This is important because the system is branch-aware.

The same user may have access to:

- one branch
- multiple branches
- different roles across branches

So branch selection is not optional for most operational APIs.

## 5. Middleware Flow

Most protected APIs follow a flow similar to this:

1. request reaches route
2. `auth` validates session/user identity
3. `branchScope` resolves active branch membership
4. `requirePermission` checks feature-level access
5. `validate` checks request payload/params/query
6. controller executes business logic
7. response is returned

Some routes do not use every step, but this is the common pattern.

## 6. Validation Rules

Validation happens near the route layer using `express-validator` plus the shared validation middleware.

This means:

- malformed requests should fail early
- controllers receive cleaner payloads
- frontend/backend contract is more explicit

When debugging validation failures, inspect:

- route validator chains
- `backend/src/middleware/validate.js`

## 7. Permission Model

The backend uses permission-based access, not only simple role names.

Examples of permissions used in routes:

- `orders:view`
- `orders:edit`
- `orders:checkout:view`
- `orders:checkout:edit`
- `menu:view`
- `menu:edit`
- `inventory:view`
- `inventory:edit`
- `billing:view`
- `billing:edit`
- `staff:view`
- `staff:edit`
- `customers:view`
- `customers:edit`
- `tables:view`
- `tables:edit`
- `website:view`
- `website:edit`

This is important because two users with similar-looking roles may still differ by permission set.

## 8. Branch Scope Rules

Branch behavior is one of the most important architectural concepts in this backend.

Branch-aware APIs should not leak or mutate data outside the active branch context.

That means:

- list queries should be branch-filtered
- update queries should be branch-filtered
- delete/void operations should be branch-filtered
- dashboard/reporting queries should be branch-filtered
- branch membership status must be respected

If a developer changes business logic and forgets branch filtering, that can create cross-branch data leaks or incorrect reporting.

## 9. Business-Critical Modules

The highest-risk modules in the system are:

1. orders
2. billing / checkout
3. inventory
4. finance
5. reporting
6. auth / permissions

Changes in these areas should always be reviewed carefully.

## 10. How To Use This Docs Folder

Each file in this folder is grouped by feature and includes:

- route bases
- endpoint list
- required auth and headers
- important request fields
- behavior notes
- risk notes
- where the feature connects to other modules

## 11. Recommended Reading Order For New Developers

If you are new to the codebase, read in this order:

1. auth and profile
2. users, roles, departments
3. orders, bills, guest
4. menu catalog
5. tables, spaces, QR
6. inventory and suppliers
7. finance
8. reports and dashboard
9. notifications and activity logs
10. settings, public, support

This order helps because the early files explain the identity and operational core first.

## 12. Postman Collection

The main API collection is:

- [merorestro.postman_collection.json](/Users/sumitraj/Documents/HotelOms/backend/merorestro.postman_collection.json)

Use it for request testing.

Use this docs folder for understanding the architecture and business meaning of each API.

## 13. Feature Reference Files

- [01-auth-and-profile.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/01-auth-and-profile.md)
- [02-users-roles-departments.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/02-users-roles-departments.md)
- [03-orders-bills-and-guest.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/03-orders-bills-and-guest.md)
- [04-menu-catalog.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/04-menu-catalog.md)
- [05-tables-spaces-and-qr.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/05-tables-spaces-and-qr.md)
- [06-customers.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/06-customers.md)
- [07-inventory-and-suppliers.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/07-inventory-and-suppliers.md)
- [08-finance.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/08-finance.md)
- [09-reports-and-dashboard.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/09-reports-and-dashboard.md)
- [10-notifications-and-promotions.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/10-notifications-and-promotions.md)
- [11-settings-public-and-support.md](/Users/sumitraj/Documents/HotelOms/backend/API_DOCS/11-settings-public-and-support.md)
