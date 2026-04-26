const test = require('node:test');
const assert = require('node:assert/strict');

const requestContext = require('../src/middleware/requestContext');

test('requestContext assigns request id, logger, and response header', () => {
  const headers = {};
  const req = {
    method: 'GET',
    originalUrl: '/api/test',
    header(name) {
      return name.toLowerCase() === 'x-request-id' ? 'req-123' : undefined;
    }
  };
  const res = {
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    }
  };

  let called = false;
  requestContext(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(req.requestId, 'req-123');
  assert.equal(headers['x-request-id'], 'req-123');
  assert.equal(typeof req.startedAt, 'number');
  assert.equal(typeof req.log.info, 'function');
  assert.equal(typeof req.log.warn, 'function');
  assert.equal(typeof req.log.error, 'function');
});
