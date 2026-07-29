const test = require('node:test');
const assert = require('node:assert/strict');

// Import helpers from controllers
const { buildInventoryConflictMessage } = require('../src/controllers/inventory/inventoryController');

test('buildInventoryConflictMessage formats negative delta stock shortage correctly', () => {
  const msg = buildInventoryConflictMessage({
    ingredient: { name: 'Cheese', unit: 'kg' },
    requestedDelta: -5,
    currentStock: 2
  });

  assert.equal(msg, 'Insufficient stock for Cheese (need 5kg, have 2kg)');
});

test('buildInventoryConflictMessage handles missing ingredient', () => {
  const msg = buildInventoryConflictMessage({
    ingredient: null,
    requestedDelta: -1,
    currentStock: 0
  });

  assert.equal(msg, 'Ingredient not found');
});

test('buildInventoryConflictMessage handles generic concurrent change for positive delta', () => {
  const msg = buildInventoryConflictMessage({
    ingredient: { name: 'Tomato', unit: 'kg' },
    requestedDelta: 10,
    currentStock: 5
  });

  assert.equal(msg, 'Inventory changed for Tomato. Please retry.');
});
