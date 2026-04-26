# Inventory And Suppliers APIs

## 1. Module Purpose

This module controls stock-related business logic and supplier master data.

It covers:

- ingredient units
- ingredients
- restocking
- stock transactions
- recipes
- suppliers
- supplier ledger access

This is one of the most sensitive operational areas because incorrect stock logic can distort purchasing, costing, availability, and order fulfillment.

## 2. Route Bases

- `/api/inventory`
- `/api/suppliers`

## 3. Common Access Pattern

Usually requires:

- `Authorization`
- `x-branch-id`

Permissions:

- `inventory:view`
- `inventory:edit`

## 4. Ingredient Units

### `GET /api/inventory/ingredient-units`

Returns measurement unit list.

### `POST /api/inventory/ingredient-units`

Creates unit.

Typical examples:

- kg
- gram
- litre
- piece

### `PUT /api/inventory/ingredient-units/:id`

Updates unit.

### `DELETE /api/inventory/ingredient-units/:id`

Deletes unit if not blocked by active usage.

## 5. Ingredients

### `GET /api/inventory/ingredients`

Lists ingredients.

### `POST /api/inventory/ingredients`

Creates ingredient.

Typical fields:

- `name`
- `unit`
- `currentStock`
- `reorderLevel`

Important meaning:

- `currentStock` is operationally sensitive
- manual stock entry should be treated carefully

### `PUT /api/inventory/ingredients/:id`

Updates ingredient details.

This may affect:

- stock visibility
- reorder calculations
- recipe consumption assumptions

### `POST /api/inventory/ingredients/:id/restock`

Restocks ingredient.

Required:

- `amount`

Important meaning:

- restock should create clear stock history/audit trail

### `DELETE /api/inventory/ingredients/:id`

Deletes ingredient if usage/history rules allow.

## 6. Stock Transactions

### `GET /api/inventory/transactions`

Returns stock transaction history.

Used for:

- audit
- debugging stock mismatch
- purchase vs stock verification

## 7. Recipes

### `POST /api/inventory/recipes`

Creates or updates recipe mapping for a menu item.

Required fields:

- `menuItem`
- `ingredients`
- `ingredients[].ingredient`
- `ingredients[].quantity`

Important meaning:

- recipes are the bridge between selling items and consuming stock

### `GET /api/inventory/recipes/:menuItem`

Returns recipe for one menu item.

### `GET /api/inventory/recipes`

Lists recipes.

### `DELETE /api/inventory/recipes/:id`

Deletes recipe.

## 8. Suppliers

### `GET /api/suppliers`
### `POST /api/suppliers`
### `PUT /api/suppliers/:id`
### `DELETE /api/suppliers/:id`

Used for supplier master data management.

Typical supplier fields may include:

- name
- phone
- email
- address

### `GET /api/suppliers/:id/ledger`

Returns supplier-specific ledger/history style financial view.

## 9. Cross-Module Dependencies

Inventory and suppliers connect directly to:

- menu recipes
- purchases
- purchase returns
- order stock deduction
- stock reports

## 10. Debugging Checklist

If stock numbers look wrong, inspect:

1. ingredient record
2. stock transactions
3. purchase create/update flow
4. purchase return flow
5. recipe mapping
6. order consumption logic

## 11. High-Risk Notes

- Manual stock mutation is always risky.
- Recipe updates can silently change future stock deduction behavior.
- Purchase changes should be checked together with stock transaction impact.
