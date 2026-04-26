# Tables Spaces And QR APIs

## 1. Module Purpose

This module manages the restaurant’s physical service layout.

It covers:

- tables
- table types
- spaces
- QR code listing/management

This module is closely tied to dine-in order flow.

## 2. Route Bases

- `/api/tables`
- `/api/table-types`
- `/api/spaces`
- `/api/qr-codes`

## 3. Common Access Pattern

Usually requires:

- `Authorization`
- `x-branch-id`

Permissions:

- `tables:view`
- `tables:edit`

## 4. Tables API

### `GET /api/tables`

Returns list of tables for selected branch.

Typical uses:

- floor management
- waiter seat mapping
- occupancy display

### `GET /api/tables/:id`

Returns a single table.

### `POST /api/tables`

Creates table.

Common fields:

- `tableNumber`
- `name`
- `type`
- `spaceId`
- `tableTypeId`
- `capacity`
- `charge`
- `row`
- `column`

Important meaning:

- this is operational layout data
- wrong table setup creates order assignment confusion

### `PUT /api/tables/:id`

Updates table metadata or state.

May include:

- `status`
- `name`
- `type`
- `spaceId`
- `tableTypeId`
- `capacity`
- `charge`
- `row`
- `column`
- `isTrashed`

### `PATCH /api/tables/:id/free`

Force-frees table.

Important note:

- this is operationally sensitive
- should be used only when restoring state or fixing stuck occupancy

### `DELETE /api/tables/:id`

Deletes table if allowed.

## 5. Table Types API

### `GET /api/table-types`
### `POST /api/table-types`
### `PUT /api/table-types/:id`
### `DELETE /api/table-types/:id`

Used for business-facing grouping like:

- regular
- VIP
- booth
- family table

## 6. Spaces API

### `GET /api/spaces`
### `POST /api/spaces`
### `PUT /api/spaces/:id`
### `DELETE /api/spaces/:id`

Used for zone grouping like:

- indoor
- rooftop
- garden
- non-AC
- AC hall

## 7. QR Codes API

### `GET /api/qr-codes`

Returns QR code list or metadata.

This usually supports guest self-ordering and table-specific public access flow.

## 8. Cross-Module Dependencies

This module affects:

- orders
- guest ordering
- table occupancy logic
- billing flow for dine-in
- QR-based public table access

## 9. Debugging Checklist

If a table appears stuck or wrong in UI, inspect:

1. table record
2. active order linked to table
3. table-freeing logic
4. guest table status flow

## 10. High-Risk Notes

- Table state bugs create direct live-service disruption.
- Never change table status handling without checking order lifecycle implications.
