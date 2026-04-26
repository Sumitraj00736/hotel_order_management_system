# Users Roles And Departments APIs

## 1. Module Purpose

This module manages the internal people structure of the system.

It covers:

- staff creation
- staff profile updates
- role assignment
- permission-carrying role management
- department grouping
- staff status changes

This is one of the foundations of access control because permissions ultimately shape who can do what in the system.

## 2. Route Bases

- `/api/users`
- `/api/roles`
- `/api/departments`

## 3. Common Access Pattern

Most routes in this module require:

- `Authorization`
- `x-branch-id`

Common permissions:

- `staff:view`
- `staff:edit`

## 4. Users API

### `GET /api/users`

#### Purpose

Lists users in the current branch context.

#### Typical uses

- admin staff listing
- role assignment screens
- staff management tools

#### Important behavior

- branch scoping matters
- only relevant users should appear for selected branch

### `GET /api/users/:id`

#### Purpose

Returns one staff user record.

#### Typical uses

- profile detail view
- edit modal preload

### `POST /api/users`

#### Purpose

Creates a new staff account.

#### Common fields

- `name`
- `email`
- `phone`
- `password`
- `role`
- `roleId`
- `dateOfJoining`
- `salary`
- `shiftStart`
- `shiftEnd`

#### Important rules

- email validation applies
- password minimum rules apply
- role assignment may be direct name or role ID depending on payload pattern

#### Business note

Creating a staff user is not only a profile action; it also affects access control and operational visibility in dashboards and staff analytics.

### `PUT /api/users/:id`

#### Purpose

Updates user profile and role-related fields.

#### Typical update areas

- contact info
- role mapping
- shift times
- salary metadata

### `PATCH /api/users/:id/status`

#### Purpose

Changes user status.

#### Why this matters

Status changes can affect:

- login eligibility
- branch membership behavior
- staff visibility
- active workforce dashboards

### `PATCH /api/users/:id/role`

#### Purpose

Updates role assignment separately from broader profile changes.

#### Why separate endpoint exists

Role changes are sensitive and often deserve explicit, narrow operations instead of being hidden inside a general profile update.

### `DELETE /api/users/:id`

#### Purpose

Deletes or archives user depending on controller behavior.

#### Developer caution

Before changing delete behavior, review:

- audit logging
- dependent records
- branch membership history

## 5. Roles API

### `GET /api/roles`

Lists roles.

### `POST /api/roles`

Creates a role.

Typical payload includes:

- role name
- permission list

### `PUT /api/roles/:id`

Updates role details and permissions.

### `DELETE /api/roles/:id`

Deletes role if allowed.

#### Developer caution

Deleting a role can have wider consequences than it first appears because staff access, route permissions, and UI visibility may all depend on it.

## 6. Departments API

### `GET /api/departments`

Lists departments.

### `POST /api/departments`

Creates department.

### `PUT /api/departments/:id`

Updates department.

### `DELETE /api/departments/:id`

Deletes department if allowed.

## 7. How This Module Connects To Other Features

This module affects:

- auth
- branch scope
- permissions
- profile module
- waiter analytics
- promotions
- activity logs
- notifications

## 8. Debugging Checklist

If staff cannot access a screen or API, check:

1. auth token validity
2. branch membership status
3. selected branch header
4. role assignment
5. permission mapping
6. route-level `requirePermission`

## 9. High-Risk Notes

- Permission changes can silently break many features at once.
- A role update may succeed technically but still create business bugs if permissions become incomplete.
