const getLogger = require('./lib/helpers/_logger');
const server = require('./lib/server');
const workers = require('./lib/core/workers');

const _logger = getLogger();

const app = {
  start: () => {
    server.start();
    workers.start();
  },
};

app.start();

process.on('SIGINT', () => {
  _logger.info('Shutting down (CTRL-C)');
  process.exit();
});

([
  'uncaughtException',
  'unhandledRejection'
].forEach((eventName) => {
  process.on(eventName, (err) => {
    _logger.error('Error: ', err);
  });
}));

module.exports = app;
