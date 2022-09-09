const logger = require('./lib/helpers/logger');
const server = require('./lib/server');

const app = {
  start: () => {
    server.start();
  },
};

app.start();

process.on('SIGINT', () => {
  logger.info('Shutting down (CTRL-C)');
  process.exit();
});

([
  'uncaughtException',
  'unhandledRejection'
].forEach((eventName) => {
  process.on(eventName, (err) => {
    logger.error('Error: ', err);
  });
}));

module.exports = app;
