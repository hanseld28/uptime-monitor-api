const users = require('./users');
const tokens = require('./tokens');
const checks = require('./checks');

const handlers = {
  ping: (data, callback) => {
    callback({ ...data, status: 200 }, {
      status: 'UP',
    });
  },
  ...users,
  ...tokens,
  ...checks,
  notFound: (data, callback) => {
    callback({ ...data, status: 404 });
  },
};

module.exports = handlers;
