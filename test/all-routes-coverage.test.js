const test = require('node:test');
const assert = require('node:assert/strict');
const { routeDefinitions } = require('../src/routes');

test('all 43 API route definitions export valid Express routers with valid handlers', () => {
  assert.equal(routeDefinitions.length, 43, 'Should have exactly 43 registered route modules');

  routeDefinitions.forEach(({ path, router }) => {
    assert.ok(router, `Router for ${path} should be defined`);
    assert.ok(Array.isArray(router.stack), `Router for ${path} should have a valid stack array`);
    assert.ok(router.stack.length > 0, `Router for ${path} should have registered route layers`);

    // Verify each layer inside router stack has valid route handlers
    router.stack.forEach((layer, index) => {
      if (layer.route) {
        assert.ok(layer.route.path, `Route layer ${index} in ${path} should have a path`);
        assert.ok(Array.isArray(layer.route.stack), `Route ${layer.route.path} in ${path} should have a stack`);

        layer.route.stack.forEach((handlerLayer, handlerIndex) => {
          assert.equal(
            typeof handlerLayer.handle,
            'function',
            `Handler ${handlerIndex} on route ${layer.route.path} in ${path} must be a valid function`
          );
        });
      }
    });
  });
});
