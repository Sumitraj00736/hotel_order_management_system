# Customer APIs

## 1. Module Purpose

This module manages customer records and customer reward settings.

It supports:

- customer creation
- customer updates
- customer deletion
- customer listing
- reward settings configuration

## 2. Route Base

- `/api/customers`

## 3. Common Access Pattern

Requires:

- `Authorization`
- `x-branch-id`

Permissions:

- `customers:view`
- `customers:edit`

## 4. Endpoint Reference

### `GET /api/customers`

Returns customer list for current branch context.

Typical uses:

- customer management page
- order assignment
- loyalty lookup

### `POST /api/customers`

Creates customer record.

At minimum:

- `name`

Typical additional fields may include:

- `phone`
- `email`
- `address`

### `PUT /api/customers/:id`

Updates customer data.

### `DELETE /api/customers/:id`

Deletes customer if controller allows.

Developer caution:

- review whether dependent history/reporting data references this customer

### `GET /api/customers/rewards`

Returns rewards settings.

### `PUT /api/customers/rewards`

Updates rewards configuration.

## 5. Cross-Module Dependencies

Customer data may be used by:

- orders
- bills
- sales invoices
- reporting
- loyalty/rewards

## 6. Debugging Checklist

If customer-linked sales or reward data looks wrong, inspect:

1. customer record
2. order customer linkage
3. invoice linkage
4. report source path

## 7. High-Risk Notes

- Customer deletion can be more dangerous than it appears if reports or invoices still reference those records.
