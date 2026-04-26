# Orders Bills And Guest APIs

## 1. Module Purpose

This is the core restaurant operations module.

It covers:

- order creation
- order viewing
- order update
- kitchen/service status progression
- bill generation
- bill payment
- guest-facing public ordering

If this module is unstable, the product is unstable, because this is where live restaurant operations happen.

## 2. Route Bases

- `/api/orders`
- `/api/bills`
- `/api/guest`

## 3. Access Model

### Staff routes

Usually require:

- `Authorization`
- `x-branch-id`

Common permissions:

- `orders:view`
- `orders:edit`
- `orders:checkout:view`
- `orders:checkout:edit`

### Guest routes

Do not use staff auth, but still depend on branch resolution and validation.

## 4. Orders API

### `GET /api/orders`

#### Purpose

Returns order list for branch context.

#### Common usage patterns

- active kitchen queue
- waiter order history
- paginated admin listing
- date-range filtered orders

#### Important behavior

- should remain branch-scoped
- may include pagination/query-based filtering

### `GET /api/orders/:id`

#### Purpose

Returns one full order.

#### Typical uses

- order detail screen
- bill preparation
- staff service follow-up

### `POST /api/orders`

#### Purpose

Creates a new staff-side order.

#### Important request fields

- `table`
- `items`
- `items[].menuItem`
- `items[].quantity`
- `items[].isComplimentary`
- `items[].variantId`
- `items[].variantName`
- `items[].variantPrice`
- `items[].itemNote`
- `orderType`
- `customerId`
- `staffId`
- `customerName`
- `spiceLevel`
- `specialInstructions`

#### Important backend behavior

- route validates item structure
- backend computes totals
- lifecycle starts in controlled status
- inventory coupling may happen based on recipes
- table occupancy may be updated depending on flow

#### Why this endpoint is sensitive

An order touches:

- menu correctness
- kitchen flow
- table state
- billing later
- reporting later

### `PUT /api/orders/:id`

#### Purpose

Updates an existing order.

#### Important rules

- not every order is editable at every stage
- backend enforces lifecycle restrictions
- totals should be recalculated on backend

#### Typical update use cases

- add/remove items
- fix quantity
- add special note
- update spice level

### `PATCH /api/orders/:id/status`

#### Purpose

Moves order through service lifecycle.

#### Common statuses

- `pending`
- `preparing`
- `ready`
- `served`

#### Important behavior

- transitions are controlled by backend rules
- invalid transition should be rejected
- some transitions may affect downstream views and table logic

## 5. Bills API

### `GET /api/bills/:id`

#### Purpose

Builds bill payload for a given order.

#### Typical uses

- cashier page
- bill preview
- printable invoice/bill

#### Important backend behavior

- bill math must come from backend
- order data and invoice logic should stay aligned

### `POST /api/bills/:id/pay`

#### Purpose

Settles an order and records payment outcome.

#### Important request fields

- `paymentMethod`
- additional split-payment or settlement fields depending on frontend flow

#### Important backend behavior

- backend should normalize settlement
- backend should calculate paid/due/change correctly
- finance records may be created from this step

#### Why this is very sensitive

This endpoint sits at the boundary between operations and finance.

## 6. Guest API

### `GET /api/guest/menu`

#### Purpose

Returns public guest-facing menu.

#### Typical query context

- `slug`

#### Important behavior

- only guest-available menu data should be exposed
- branch resolution should be safe

### `GET /api/guest/tables/:tableId/status`

#### Purpose

Returns guest-visible status for a table.

### `POST /api/guest/orders`

#### Purpose

Creates order from guest/public ordering flow.

#### Important request fields

- `table`
- `items`
- `guestName`
- `specialInstructions`
- `spiceLevel`

#### Important behavior

- rate-limited
- validated
- branch resolved through guest path, not staff header

## 7. Cross-Module Dependencies

Orders and billing connect directly to:

- tables
- menu
- inventory
- customers
- payments
- sales invoices
- reports
- dashboard
- notifications
- realtime events

## 8. Debugging Checklist

If order or billing flow looks wrong, inspect:

1. route validation
2. order controller
3. order lifecycle utility
4. bill controller
5. checkout computation utility
6. sales invoice creation/update behavior
7. stock deduction behavior

## 9. High-Risk Notes

- Never trust frontend totals for final checkout truth.
- Order status changes should never be made casually.
- Table-freeing logic can break live operations if done incorrectly.
