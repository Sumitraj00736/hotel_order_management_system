# Notifications Push Promotions And Activity APIs

## 1. Module Purpose

This module handles communication and observability-related application behavior.

It covers:

- in-app notifications
- push notification setup and test
- activity/audit logs
- promotions for staff

## 2. Route Bases

- `/api/notifications`
- `/api/push`
- `/api/activity-logs`
- `/api/promotions`

## 3. Notifications API

### `GET /api/notifications`

Returns notifications for logged-in user/branch context.

### `PATCH /api/notifications/:id/read`

Marks one notification as read.

### `PATCH /api/notifications/read/all`

Marks all as read.

## 4. Push API

### `GET /api/push/public-key`

Returns push public key needed by client subscription logic.

### `GET /api/push/config`

Returns Firebase/push client config payload.

### `GET /api/push/status`

Checks current push subscription state by `deviceId`.

### `POST /api/push/subscribe`

Creates or updates push subscription.

Required fields:

- `fcmToken`
- `deviceId`

Optional:

- `enabled`
- `platform`

### `POST /api/push/unsubscribe`

Removes or disables push subscription.

Accepts:

- `deviceId`
- or `fcmToken`

### `PATCH /api/push/toggle`

Changes enabled state.

Required:

- `deviceId`
- `enabled`

### `POST /api/push/test`

Sends test push notification.

Important meaning:

- useful for operational verification and notification troubleshooting

## 5. Activity Logs API

### `GET /api/activity-logs`

Returns structured activity log data.

Common business meaning:

- admin audit trail
- mutation trace
- investigation support

Potential filters include:

- `action`
- `entityType`

## 6. Promotions API

### `GET /api/promotions/me`

Returns promotions relevant to the logged-in user.

### `GET /api/promotions/:id`

Returns promotion records for a selected user.

### `POST /api/promotions/:id`

Creates promotion record.

Typical fields:

- `title`
- `amount`
- `effectiveDate`
- `note`

## 7. Cross-Module Dependencies

This module connects to:

- auth/session
- realtime/socket behavior
- admin settings
- staff data
- audit and observability

## 8. Debugging Checklist

If notifications or logs are missing, inspect:

1. auth/session resolution
2. branch context
3. push controller
4. push service
5. notification controller
6. activity log utility
7. frontend socket/push client

## 9. High-Risk Notes

- Silent notification failures are hard to notice without good logs.
- Activity logging should not be removed from sensitive mutation flows.
