const test = require('node:test');
const assert = require('node:assert/strict');

const ActivityLog = require('../src/models/notifications/ActivityLog');
const { listActivityLogs } = require('../src/controllers/notifications/activityLogController');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('listActivityLogs applies action and entityType filters with pagination', async () => {
  const original = {
    find: ActivityLog.find,
    countDocuments: ActivityLog.countDocuments
  };

  const recorded = { filter: null, sort: null, skip: null, limit: null, populate: null };

  ActivityLog.find = (filter) => {
    recorded.filter = filter;
    return {
      sort(value) {
        recorded.sort = value;
        return this;
      },
      skip(value) {
        recorded.skip = value;
        return this;
      },
      limit(value) {
        recorded.limit = value;
        return this;
      },
      populate(value) {
        recorded.populate = value;
        return Promise.resolve([{ _id: 'log-1', action: 'payment.create', entityType: 'payment' }]);
      }
    };
  };
  ActivityLog.countDocuments = async (filter) => {
    assert.deepEqual(filter, recorded.filter);
    return 1;
  };

  const req = {
    branchId: 'branch-1',
    query: {
      action: 'payment.create',
      entityType: 'payment',
      search: 'created',
      page: '2',
      limit: '20'
    }
  };
  const res = createResponse();

  try {
    await listActivityLogs(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(recorded.filter.branchId, 'branch-1');
    assert.equal(recorded.filter.action, 'payment.create');
    assert.equal(recorded.filter.entityType, 'payment');
    assert.equal(recorded.sort.createdAt, -1);
    assert.equal(recorded.skip, 20);
    assert.equal(recorded.limit, 20);
    assert.equal(recorded.populate, 'performedBy');
    assert.equal(res.body.total, 1);
    assert.equal(res.body.page, 2);
    assert.equal(res.body.limit, 20);
    assert.deepEqual(res.body.data, [{ _id: 'log-1', action: 'payment.create', entityType: 'payment' }]);
  } finally {
    ActivityLog.find = original.find;
    ActivityLog.countDocuments = original.countDocuments;
  }
});
