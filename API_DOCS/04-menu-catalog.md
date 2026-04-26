# Menu Catalog APIs

## 1. Module Purpose

This module defines what the business can sell.

It covers:

- menu items
- categories
- submenus
- add-ons
- combos
- item variants and pricing-related structure

This module is important because it affects ordering, guest ordering, billing, reporting, and inventory recipe mapping.

## 2. Route Bases

- `/api/menus`
- `/api/categories`
- `/api/submenus`
- `/api/addons`
- `/api/combos`

## 3. Common Access Pattern

Usually requires:

- `Authorization`
- `x-branch-id`

Permissions:

- `menu:view`
- `menu:edit`

## 4. Menu Items

### `GET /api/menus`

Returns menu item list for selected branch.

Typical uses:

- admin menu management
- waiter ordering screen preload

### `GET /api/menus/:id`

Returns one menu item.

### `POST /api/menus`

Creates menu item.

Common request fields:

- `name`
- `category`
- `subMenu`
- `type`
- `kotType`
- `price`
- `maxPrice`
- `preparationTimeMinutes`
- `addOns`
- `imageUrl`
- `variants`

Variant-related fields may include:

- `variants[].type`
- `variants[].name`
- `variants[].actualPrice`
- `variants[].discount`
- `variants[].price`

Important business meaning:

- menu item is not just display data
- it also influences order calculations and kitchen behavior

### `PUT /api/menus/:id`

Updates menu item.

### `DELETE /api/menus/:id`

Deletes menu item if controller allows.

## 5. Categories

### `GET /api/categories`
### `POST /api/categories`
### `PUT /api/categories/:id`
### `DELETE /api/categories/:id`

Used to create top-level menu grouping.

## 6. SubMenus

### `GET /api/submenus`
### `POST /api/submenus`
### `PUT /api/submenus/:id`
### `DELETE /api/submenus/:id`

Used to create secondary grouping within menu navigation or structure.

## 7. AddOns

### `GET /api/addons`
### `POST /api/addons`
### `PUT /api/addons/:id`
### `DELETE /api/addons/:id`

Used for:

- extra toppings
- extra sides
- additional paid modifiers

## 8. Combos

### `GET /api/combos`
### `POST /api/combos`
### `PUT /api/combos/:id`
### `DELETE /api/combos/:id`

Used for bundled offers and grouped sellable items.

## 9. Cross-Module Dependencies

This module affects:

- staff ordering
- guest ordering
- bills
- discounts/pricing behavior
- inventory recipes
- analytics for top dishes

## 10. Debugging Checklist

If menu issues appear in ordering, inspect:

1. menu item record
2. variant mapping
3. add-on mapping
4. recipe linkage
5. frontend payload shape

## 11. High-Risk Notes

- Menu pricing changes can affect live billing.
- Variant misconfiguration can cause order-total mismatches.
