# Finance APIs

## 1. Module Purpose

This module handles operational finance features inside the application.

It covers:

- purchases
- purchase returns
- sales returns
- incomes
- expenses
- payments
- taxes
- daybook
- sales invoice listing
- billing summary

This module is highly sensitive because even small mistakes can distort business reporting and cash understanding.

## 2. Route Bases

- `/api/purchases`
- `/api/purchase-returns`
- `/api/sales-returns`
- `/api/incomes`
- `/api/expenses`
- `/api/payments`
- `/api/daybook`
- `/api/taxes`
- `/api/finance/sales-invoices`
- `/api/billing`

## 3. Common Access Pattern

Usually requires:

- `Authorization`
- `x-branch-id`

Common permissions:

- `billing:view`
- `billing:edit`

## 4. Core Finance Principle In This Codebase

Important rule:

- the backend should own the final financial calculations

That means frontend should send business inputs such as:

- items
- rates
- discount intent
- tax intent
- payment method

But the backend should remain responsible for:

- totals
- due amounts
- paid amounts
- payment status
- invoice math

## 5. Purchases

### `GET /api/purchases`

Lists purchase records.

### `POST /api/purchases`

Creates purchase.

Typical fields:

- `billDate`
- `paymentMethod`
- `paymentStatus`
- `paidAt`
- `items`
- `attachments`

Important meaning:

- purchase creation may affect stock
- purchase values affect finance reporting

### `PUT /api/purchases/:id`

Updates purchase.

Developer caution:

- purchase updates are more dangerous than simple CRUD because they may require stock and finance consistency

### `DELETE /api/purchases/:id`

Deletes or voids purchase depending on controller behavior.

## 6. Purchase Returns

### `GET /api/purchase-returns`
### `POST /api/purchase-returns`
### `PUT /api/purchase-returns/:id`
### `DELETE /api/purchase-returns/:id`

These routes handle reverse movement against purchases and may also affect stock/finance interpretation.

## 7. Sales Returns

### `GET /api/sales-returns`
### `POST /api/sales-returns`
### `PUT /api/sales-returns/:id`
### `DELETE /api/sales-returns/:id`

These routes affect refund/return style flows tied to customer-side sales.

## 8. Incomes

### `GET /api/incomes`
### `POST /api/incomes`
### `PUT /api/incomes/:id`
### `DELETE /api/incomes/:id`

Used for non-order income style entries or operational inflows.

## 9. Expenses

### `GET /api/expenses`
### `POST /api/expenses`
### `PUT /api/expenses/:id`
### `DELETE /api/expenses/:id`

Typical fields:

- `title`
- `amount`
- `paymentMethod`
- `paidAt`

## 10. Payments

### `GET /api/payments`
### `POST /api/payments`
### `PUT /api/payments/:id`
### `DELETE /api/payments/:id`

Typical fields:

- `direction`
- `amount`
- `txnDate`
- `paymentMethod`
- `entryType`
- `paymentStatus`
- `partyType`
- `attachments`

Important meaning:

- payments are generic cash-in/cash-out style records
- these routes are used in finance screens and dashboard calculations

## 11. Daybook

### `GET /api/daybook/summary`

Returns summary for the current operational day/session context.

### `GET /api/daybook/history`

Returns daybook close history.

### `POST /api/daybook/close`

Closes daybook with optional remarks.

Important meaning:

- this is operationally close to end-of-day finance discipline

## 12. Taxes

### `GET /api/taxes`
### `POST /api/taxes`
### `PUT /api/taxes/:id`
### `DELETE /api/taxes/:id`

Used for tax rate definitions and finance calculations/display.

## 13. Sales Invoices

### `GET /api/finance/sales-invoices`

Lists sales invoices.

Important meaning:

- this is a more canonical sales-finance source than loosely derived legacy history patterns

## 14. Billing Summary

### `GET /api/billing/summary`

Returns billing summary metrics.

## 15. Cross-Module Dependencies

Finance connects directly to:

- orders
- bills
- sales invoices
- inventory purchases
- dashboards
- reports
- activity logs

## 16. Debugging Checklist

If finance totals are wrong, inspect:

1. request payload shape
2. validation rules
3. finance calculation utilities
4. purchase/payment controller logic
5. bill checkout computation
6. invoice persistence logic
7. report source path

## 17. High-Risk Notes

- Never move calculation authority back to frontend.
- Purchase, return, and payment changes should always be checked against reporting impact.
- Daybook and dashboard consistency should be verified after finance refactors.
