const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/notifications/pushRoutes');

test('pushRoutes has correct middleware protection for all authenticated routes', () => {
  const routesToCheck = [
    { path: '/subscribe', method: 'post' },
    { path: '/unsubscribe', method: 'post' },
    { path: '/toggle', method: 'patch' },
    { path: '/test', method: 'post' }
  ];

  routesToCheck.forEach(({ path, method }) => {
    // Find matching route in router stack
    const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods[method]
    );

    assert.ok(layer, `Route ${method.toUpperCase()} ${path} should exist`);

    const middlewareNames = layer.route.stack.map((handler) => handler.name);

    // Verify auth and branchScope are present
    const authIndex = middlewareNames.indexOf('auth');
    const branchScopeIndex = middlewareNames.indexOf('branchScope');

    assert.ok(authIndex !== -1, `Route ${method.toUpperCase()} ${path} is missing 'auth' middleware`);
    assert.ok(branchScopeIndex !== -1, `Route ${method.toUpperCase()} ${path} is missing 'branchScope' middleware`);
    assert.ok(
      authIndex < branchScopeIndex,
      `Route ${method.toUpperCase()} ${path} should apply 'auth' before 'branchScope'`
    );
  });
});
