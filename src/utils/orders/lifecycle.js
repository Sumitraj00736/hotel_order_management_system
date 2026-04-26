const ACTIVE_EDITABLE_STATUSES = new Set(['pending', 'preparing', 'ready', 'served']);
const ALLOWED_STATUS_TRANSITIONS = new Set(['pending', 'preparing', 'ready', 'served', 'cancelled']);

const isEditableOrderStatus = (status) => ACTIVE_EDITABLE_STATUSES.has(String(status || '').toLowerCase());

const isAllowedOrderStatusTransition = (status) =>
  ALLOWED_STATUS_TRANSITIONS.has(String(status || '').toLowerCase());

module.exports = {
  ACTIVE_EDITABLE_STATUSES,
  ALLOWED_STATUS_TRANSITIONS,
  isEditableOrderStatus,
  isAllowedOrderStatusTransition
};
