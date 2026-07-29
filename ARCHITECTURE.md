# HotelOms Backend Architecture & System Specifications

This document serves as the canonical technical guide and audit reference for senior engineers onboarding onto the HotelOms backend. It details design patterns, data flows, security boundaries, database structures, and validation paradigms implemented across the service.

---

## 1. System Topology & Router Composition

The backend is built around a centralized routing architecture mapping features to modular routing layers. These are registered programmatically with system-level middleware gates.

```
Incoming Request
  │
  ├──► requestContext (Generates request UUID & attaches req.log)
  │
  ├──► express-rate-limit (Applies global or route-specific limits)
  │
  ├──► auth (Hybrid session verification for Firebase / JWT)
  │
  ├──► branchScope (Multi-tenant check: resolves branch ID, tenant org, checks subscription status)
  │
  └──► Route Modules (Protected by permission checks and feature limit gates)
```

### Route Indexing & Middleware Composition (`routes/index.js`)
Routes are registered under the `/api` namespace. Plan feature restrictions are enforced directly at the routing level:
* `/api/inventory/*` -> Gated via `checkFeature('inventory')`
* `/api/daybook/*`, `/api/purchases/*`, `/api/expenses/*`, `/api/incomes/*`, `/api/sales-returns/*`, `/api/payments/*` -> Gated via `checkFeature('accounting')`

---

## 2. Model & Collection Directory Catalog

The database layout splits schemas into **Platform Control** models (shared system metadata) and **Tenant Operations** models (branch-isolated data).

### Platform Control Models (`models/platform/*`)
| Model Class | Persistence Collection | Purpose |
|:---|:---|:---|
| `Plan` | `plans` | Configures system-wide subscription pricing, resource limits, and toggled features. |
| `PlatformAdmin` | `platformadmins` | System administrators who bypass branch-level rules to perform platform maintenance. |
| `PlatformAuditLog` | `platformauditlogs` | Log records of actions taken by platform admins (e.g. updating plans, archiving branches). |
| `Subscription` | `subscriptions` | Active subscription details mapped to a single `branchId` (limits, features, expiry date). |
| `SubscriptionHistory` | `subscriptionhistories` | Historically tracked records of plan changes, remarks, and upgrades. |

### Core Infrastructure Models (`models/core/*`)
| Model Class | Persistence Collection | Purpose |
|:---|:---|:---|
| `Organization` | `organizations` | High-level business entity/tenant (contains multiple branches). |
| `Branch` | `branches` | Individual physical location of an organization. |
| `Supplier` | `suppliers` | Supplier details, opening balances, and branch mappings. |
| `Counter` | `counters` | Monotonically increasing sequence counters for invoices and bills. |
| `IdempotencyRequest` | `idempotencyrequests` | Persistence table for verifying and replaying duplicate requests. |

### User & Authorization Models (`models/users/*`)
| Model Class | Persistence Collection | Purpose |
|:---|:---|:---|
| `User` | `users` | Global user record (emails, phone numbers, Firebase UUID link, platform status). |
| `UserBranchRole` | `userbranchroles` | Maps users to a specific branch with standard roles (`admin`, `manager`, `waiter`, `kitchen`) and custom permissions overrides. |
| `Role` | `roles` | Custom roles configured at the branch level. |
| `Department` | `departments` | Staff department listings. |
| `DeletedUser` | `deletedusers` | Archival record of deleted user accounts for audit traceability. |

### Operation & Transaction Models
| Domain Area | Models | Purpose |
|:---|:---|:---|
| **Menu Catalogue** | `MenuItem`, `Category`, `SubMenu`, `AddOn`, `Combo`, `Recipe` | Defines catalog items, combos, variants, and recipes mapping menu items to ingredients. |
| **Realtime Tables** | `Table`, `TableType`, `Space`, `QrCode` | Physical table positions, workspace groups, and QR code identifiers for ordering. |
| **Order Processing** | `Order` | Stores order items, guest tags, spice levels, statuses, and transactional records. |
| **Finance Ledgers** | `SalesInvoice`, `Payment`, `Expense`, `Income`, `Purchase`, `PurchaseReturn`, `SalesReturn`, `JournalVoucher`, `CashBankAccount`, `DaybookSession`, `DaybookClose` | Full accounting ledgers, cash drawer sessions, income/expense entries, and audits. |
| **Observability** | `ActivityLog`, `Notification`, `PushSubscription` | System alerts, activity logs, and FCM registration tokens. |

---

## 3. Financial Safety & Rounding Precision

JavaScript floating-point mathematics (`0.1 + 0.2 !== 0.3`) present significant risks in financial ledgers. To guarantee computational correctness, calculations are handled in cents (integers) using [mathUtils.js](file:///Users/sumitraj/Documents/HotelOms/backend/src/utils/mathUtils.js).

### Precise Arithmetic (`utils/mathUtils.js`)
* **Rounding**: Multiplies amounts by `100`, rounds to the nearest integer, and divides by `100` to truncate floating-point remainders:
  ```javascript
  static roundAmount(amount) {
    if (amount == null || isNaN(amount)) return 0;
    return Math.round(Number(amount) * 100) / 100;
  }
  ```
* **Addition & Subtraction**: Converts values to cents before performing operations to eliminate precision issues:
  ```javascript
  static add(...amounts) {
    let sumInCents = 0;
    for (const amt of amounts) {
      if (amt != null && !isNaN(amt)) {
        sumInCents += Math.round(Number(amt) * 100);
      }
    }
    return sumInCents / 100;
  }
  ```

---

## 4. Checkout Computation & Invoice Reconciliation

Financial calculations are centralized in `utils/orders/checkout.js` and `utils/finance/calculations.js`. Clients cannot modify totals, discounts, or tax amounts.

### Checkout Calculations (`utils/orders/checkout.js`)
When checking out an order:
1. **Invoice Totals**: Resolves taxable amounts, computes percentages or flat discounts, adds tax rates, and handles tip allocations.
2. **Normalized Payments**: Groups split payments (e.g. paying part cash, part card) and validates that non-negative bounds are maintained.
3. **Change Calculation**: Safely computes `changeDue` based on the difference between total paid and invoice totals.
4. **Payment Documents Generation**: Emits payment logs allocating the received amounts across multiple payment models (`buildPaymentDocuments`).

### Reconciliation Flow (`reconcileInvoiceSettlement`)
When partial payments are made against an invoice over time, the system reconciles payments by tracking cumulative paid totals vs previous totals:
```javascript
const cumulativeSettlement = deriveSettlement({
  grandTotal: invoiceTotals.grandTotal,
  amountPaid: previousAmountPaid + currentRequestPaid,
  requestedStatus
});
const incrementalApplied = Math.max(0, cumulativeSettlement.amountPaid - previousAmountPaid);
```
This ensures the system never logs more payments than the grand total.

---

## 5. Multi-Tenant Branch Scoping & Security

Branch boundaries are enforced at the database query level to protect tenant data.

### Request Context Hydration (`middleware/branchScope.js`)
The `branchScope` middleware matches the client's `x-branch-id` header against user membership records:
1. If the header is provided, it validates the user is active in that branch.
2. If omitted, the request is rejected with a `400` status requiring branch selection (unless a single membership exists, in which case it defaults to it).
3. Hydrates `req.branchId`, `req.branchRole`, `req.branchPermissions`, and `req.orgId`.
4. Executes subscription status and expiry checks: writes (POST/PUT/PATCH/DELETE) are blocked if the subscription has expired or is inactive.

### Permissions Validation (`middleware/requirePermission.js`)
Permissions combine static role defaults (e.g., `admin` having `*`) with custom overrides in the `UserBranchRole` document:
- Custom user permissions are merged with the default permissions matching the user's role.
- If a user has `*` or the explicit action string, access is granted; otherwise, a `403 Forbidden` is returned.

---

## 6. Concurrency Control & Mongo Transactions

Concurrency conflicts (e.g., duplicate billing or double-spending stock) are prevented using MongoDB sessions and conditional updates.

```
       Client 1                                   Client 2
          │                                          │
          ├─► [Read currentStock: 10]                 ├─► [Read currentStock: 10]
          │                                          │
          ├─► [Transaction 1 Start]                  ├─► [Transaction 2 Start]
          │                                          │
          ├─► [Update: Decrement 10]                 │
          │   currentStock == 10? YES                │
          │   Updates to 0                           │
          │                                          ├─► [Update: Decrement 5]
          │                                          │   currentStock == 10? NO
          │                                          │   (Fails due to version mismatch)
          ▼                                          ▼
     Committed                                    Aborted
```

### Stock Allocation (`controllers/orders/orderController.js`)
1. Resolves recipes and ingredient needs based on ordered menu items.
2. Starts a session transaction: `await mongoose.startSession()`.
3. Verifies stock availability inside the transaction.
4. Performs conditional updates to decrement inventory atomically:
   ```javascript
   const result = await Ingredient.updateOne(
     { _id: ingId, currentStock: { $gte: quantity } },
     { $inc: { currentStock: -quantity } }
   ).session(session);
   if (result.modifiedCount === 0) {
     throw new Error('Insufficient stock or concurrent update occurred');
   }
   ```
5. If any step fails, the transaction is aborted and changes roll back.

---

## 7. The Idempotency Layer

The idempotency middleware ensures that client retries do not result in duplicate transactions or duplicate side effects in the database.

### Operation Sequence (`utils/http/idempotency.js`)
1. **Header Identification**: Checks for the presence of the `x-idempotency-key` header.
2. **Payload Hash**: Generates a SHA-256 fingerprint of the request body. Object key sorting ensures the same payload produces the same hash regardless of order.
3. **Database Check**: Looks up the request key in `IdempotencyRequest`.
   * **No Record**: Saves a new record with status `'pending'`.
   * **Status Pending**: A duplicate request is in progress; rejects with a `409` conflict error.
   * **Status Completed**: The action was previously executed; replays the cached status and response body.
   * **Hash Conflict**: Key was reused with a different request payload; rejects with a `409` conflict error.

---

## 8. Realtime Integration (WebSockets & FCM)

Realtime communication uses WebSockets for active UI updates and FCM for push notifications.

### WebSocket Rooms Namespace (`utils/realtime/socket.js`)
Sockets are authenticated using tokens passed in query params or headers:
- Sockets join rooms using the format `role:{roleName}:branch:{branchId}` based on verified membership details.
- Event handlers emit target events directly to these isolated rooms (e.g. `orders:new`, `orders:update`, `tables:update`).

### Push Notification State Scoping (`controllers/notifications/pushController.js`)
- Users register device FCM tokens under `PushSubscription`.
- Token registrations and status toggling require validation via `branchScope`.
- Push notifications record activity logs using the hydrated `req.branchId` context.
