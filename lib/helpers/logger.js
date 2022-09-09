const helpers = require('.');

const logger = {
  log: async (...args) => (
    new Promise((resolve, reject) => {
      const [arg, ...restArgs] = args;

      const dateTime = helpers.formatDateTime(new Date());

      console.log(`[${dateTime}] [UPTIME_MONITOR] ${arg}`, ...restArgs);

      resolve();
    })
  ),
  info: async (...args) => (
    new Promise((resolve, reject) => {
      const [arg, ...restArgs] = args;

      const dateTime = helpers.formatDateTime(new Date());

      console.info(`[${dateTime}] [UPTIME_MONITOR] [INFO] ${arg}`, ...restArgs);

      resolve();
    })
  ),
  warn: async (...args) => (
    new Promise((resolve, reject) => {
      const [arg, ...restArgs] = args;

      const dateTime = helpers.formatDateTime(new Date());

      console.warn(`[${dateTime}] [UPTIME_MONITOR] [WARN] ${arg}`, ...restArgs);

      resolve();
    })
  ),
  error: async (...args) => (
    new Promise((resolve, reject) => {
      const [arg, ...restArgs] = args;

      const dateTime = helpers.formatDateTime(new Date());

      console.error(`[${dateTime}] [UPTIME_MONITOR] [ERROR] ${arg}`, ...restArgs);

      resolve();
    })
  ),
  debug: async (...args) => (
    new Promise((resolve, reject) => {
      const [arg, ...restArgs] = args;

      const dateTime = helpers.formatDateTime(new Date());

      console.debug(`[${dateTime}] [UPTIME_MONITOR] [DEBUG] ${arg}`, ...restArgs);

      resolve();
    })
  ),
};

module.exports = logger;
