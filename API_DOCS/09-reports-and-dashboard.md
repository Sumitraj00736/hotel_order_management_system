# Reports And Dashboard APIs

## 1. Module Purpose

This module serves management and oversight views.

It provides:

- summary metrics
- analytics
- stock reporting
- transaction history
- order dashboards
- overview dashboards
- finance dashboards
- aggregated dashboard payloads

## 2. Route Bases

- `/api/reports`
- `/api/dashboard`

## 3. Common Access Pattern

Usually requires:

- `Authorization`
- `x-branch-id`

## 4. Reports API

### `GET /api/reports/summary`

High-level operational summary.

### `GET /api/reports/overview`

General overview report.

### `GET /api/reports/analytics`

Analytics-focused dataset.

### `GET /api/reports/history`

History-style listing endpoint for business review.

### `GET /api/reports/stock`

Stock report endpoint.

### `GET /api/reports/transactions`

Transaction history endpoint.

Typical uses:

- finance/history table
- CSV export style behavior

### `GET /api/reports/order-dashboard`

Order-specific dashboard metrics.

### `GET /api/reports/overview-dashboard`

High-level overview dashboard metrics.

### `GET /api/reports/finance-dashboard`

Finance-focused dashboard metrics and trends.

## 5. Dashboard API

### `GET /api/dashboard`

Returns composite dashboard payload.

May accept query flags such as:

- `ordersLimit`
- `includeAnalytics`
- `includeStock`
- `includeHistory`
- `includeNotifications`

## 6. Cross-Module Dependencies

Reporting depends on data coming from:

- orders
- sales invoices
- payments
- purchases
- returns
- expenses
- incomes
- inventory
- notifications

## 7. Important Architectural Rule

Reporting should prefer canonical sources where possible.

Examples:

- invoice-backed sales reporting is safer than mixed legacy history logic
- active-only finance records should be used in many summaries

## 8. Debugging Checklist

If report numbers differ from screen-to-screen, inspect:

1. which controller produced the number
2. whether source is order-based or invoice-based
3. whether voided/inactive records are excluded
4. whether branch filter is correctly applied
5. whether date field differs across modules

## 9. High-Risk Notes

- Reporting drift can exist even when CRUD screens look correct.
- Dashboard speed optimizations should not silently reduce correctness.
