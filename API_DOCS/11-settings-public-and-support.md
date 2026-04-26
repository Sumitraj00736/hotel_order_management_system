# Settings Public And Support APIs

## 1. Module Purpose

This module handles configuration and externally visible business information.

It covers:

- branch/business settings
- tax settings
- notification settings
- invoice settings
- KOT settings
- printer settings
- public cafe data
- website settings
- support feedback

## 2. Route Bases

- `/api/settings`
- `/api/public`
- `/api/support`

## 3. Settings API

Usually requires:

- `Authorization`
- `x-branch-id`

### Restaurant Details

- `GET /api/settings/restaurant-details`
- `PUT /api/settings/restaurant-details`

Purpose:

- store branch/business display and operational details

### Tax Rates

- `GET /api/settings/tax-rates`
- `PUT /api/settings/tax-rates`

Purpose:

- maintain branch-level tax configuration used by invoices and calculations

### Notifications

- `GET /api/settings/notifications`
- `PUT /api/settings/notifications`

Purpose:

- store notification-related config

### Invoice

- `GET /api/settings/invoice`
- `PUT /api/settings/invoice`

Purpose:

- control invoice presentation/config

### KOT

- `GET /api/settings/kot`
- `PUT /api/settings/kot`

Purpose:

- control kitchen order ticket settings

### Printer

- `GET /api/settings/printer`
- `PUT /api/settings/printer`

Purpose:

- store printer config for operational printing paths

## 4. Public API

### `GET /api/public/cafes/:slug`

Public route for cafe website/public business data.

This is usually the entry point for public-facing or guest-facing business identity data.

### `GET /api/public/website-settings`

Authenticated route for reading website settings in current branch context.

### `PUT /api/public/website-settings`

Authenticated route for updating website settings.

Common permissions:

- `website:view`
- `website:edit`

## 5. Support API

### `GET /api/support`

Lists support feedback/tickets.

### `POST /api/support`

Creates support feedback/ticket.

This may be used by admins or internal support workflows depending on frontend implementation.

## 6. Cross-Module Dependencies

This module affects:

- invoice rendering
- tax behavior
- printing behavior
- public website pages
- guest-facing brand presentation

## 7. Debugging Checklist

If branch settings do not reflect in UI, inspect:

1. settings route/controller
2. frontend settings fetch
3. selected branch header
4. public website settings route

## 8. High-Risk Notes

- Settings bugs often look like frontend bugs even when the source is backend config shape.
- Tax and invoice setting changes should be tested together with billing output.
