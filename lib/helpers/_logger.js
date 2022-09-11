const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const helpers = require('.');

const LoggerConfig = {
  BASE_DIR: path.join(__dirname, '/../../.logs/'),
  DEFAULT_FILE_EXTENSION: 'log',
  DEFAULT_COMPRESSED_FILE_EXTENSION: 'gz.b64',
};

const _logger = (config) => ({
  log: async (...args) => (
    new Promise((resolve) => {
      const [arg, ...restArgs] = args;
      const dateTime = helpers.formatDateTime(new Date());

      if (config.custom && config.color) {
        console.log(
          config.color,
          `[${dateTime}] [UPTIME_MONITOR] [${
            config.flag.toUpperCase()
          }] ${arg}`,
          ...restArgs
        );

        resolve();

        return;
      }

      console.log(
        `[${dateTime}] [UPTIME_MONITOR] ${arg}`,
        ...restArgs
      );

      resolve();
    })
  ),
  info: async (...args) => (
    new Promise((resolve) => {
      const [arg, ...restArgs] = args;

      const dateTime = helpers.formatDateTime(new Date());

      if (config && config.custom && config.color && config.flag) {
        console.log(
          config.color,
          `[${dateTime}] [UPTIME_MONITOR] [${
            config.flag.toUpperCase()
          }] [INFO] ${arg}`,
          ...restArgs
        );

        resolve();

        return;
      }

      console.info(
        '\x1b[34m%s\x1b[0m',
        `[${dateTime}] [UPTIME_MONITOR] [INFO] ${arg}`,
        ...restArgs
      );

      resolve();
    })
  ),
  warn: async (...args) => (
    new Promise((resolve) => {
      const [arg, ...restArgs] = args;

      const dateTime = helpers.formatDateTime(new Date());

      if (config && config.custom && config.color && config.flag) {
        console.log(
          config.color,
          `[${dateTime}] [UPTIME_MONITOR] [${
            config.flag.toUpperCase()
          }] [WARN] ${arg}`,
          ...restArgs
        );

        resolve();

        return;
      }

      console.warn(
        '\x1b[33m%s\x1b[0m',
        `[${dateTime}] [UPTIME_MONITOR] [WARN] ${arg}`,
        ...restArgs
      );

      resolve();
    })
  ),
  error: async (...args) => (
    new Promise((resolve) => {
      const [arg, ...restArgs] = args;

      const dateTime = helpers.formatDateTime(new Date());

      if (config && config.custom && config.color && config.flag) {
        console.log(
          config.color,
          `[${dateTime}] [UPTIME_MONITOR] [${
            config.flag.toUpperCase()
          }] [ERROR] ${arg}`,
          ...restArgs
        );

        resolve();

        return;
      }

      console.error(
        '\x1b[32m%s\x1b[0m',
        `[${dateTime}] [UPTIME_MONITOR] [ERROR] ${arg}`,
        ...restArgs
      );

      resolve();
    })
  ),
  debug: async (...args) => (
    new Promise((resolve) => {
      const dateTime = helpers.formatDateTime(new Date());

      console.debug(
        `[${dateTime}] [UPTIME_MONITOR] [DEBUG]`,
        ...args
      );

      resolve();
    })
  ),
  append: async (file, str, callback) => {
    await helpers.makeDirectoryIfNotExists(LoggerConfig.BASE_DIR);

    const buildedPath = `${LoggerConfig.BASE_DIR}${file}.${LoggerConfig.DEFAULT_FILE_EXTENSION}`;

    fs.open(buildedPath, 'a', (openFileErr, fileDescriptor) => {
      if (openFileErr || !fileDescriptor) {
        callback(`Could not open file "${buildedPath}" for appending`);
        return;
      };

      fs.appendFile(fileDescriptor, `${str}\n`, (appendFileErr) => {
        if (appendFileErr) {
          callback('Error appending the file');
          return;
        }

        fs.close(fileDescriptor, (closeFileErr) => {
          if (closeFileErr) {
            callback('Error closing file that was being appended');
            return;
          }

          callback(false);
        });
      });
    });
  },
  list: (config, callback) => {
    const { includeCompressedLogs } = config;
    
    const buildedPath = `${LoggerConfig.BASE_DIR}/`;

    fs.readdir(buildedPath, (err, data) => {
      if (err != null || (data && data.length === 0)) {
        callback(true, data);
        return;
      };

      const trimmedFileNames = data
        .filter((fileName) => (
          fileName.includes(`.${LoggerConfig.DEFAULT_FILE_EXTENSION}`)
          || (
            includeCompressedLogs
            && fileName.includes(`.${LoggerConfig.DEFAULT_COMPRESSED_FILE_EXTENSION}`)
          )
        ))
        .map((fileName) => {
          if (
            includeCompressedLogs
            && fileName.includes(`.${LoggerConfig.DEFAULT_COMPRESSED_FILE_EXTENSION}`)
          ) {
            return fileName.replace(`.${LoggerConfig.DEFAULT_COMPRESSED_FILE_EXTENSION}`, '');
          }

          return fileName.replace(`.${LoggerConfig.DEFAULT_FILE_EXTENSION}`, '');
        });

      callback(false, trimmedFileNames);
    });
  },
  compress: (config, callback) => {
    const { source, destination } = config;

    const sourceFile = `${source}.${LoggerConfig.DEFAULT_FILE_EXTENSION}`;
    const destinationFile = `${destination}.${LoggerConfig.DEFAULT_COMPRESSED_FILE_EXTENSION}`;

    const buildedSourceFilePath = `${LoggerConfig.BASE_DIR}${sourceFile}`;

    fs.readFile(buildedSourceFilePath, 'utf8', (readErr, inputString) => {
      if (readErr) {
        callback(readErr);
        return;
      }

      zlib.gzip(inputString, (gzipErr, buffer) => {
        if (gzipErr) {
          callback(gzipErr);
          return;
        }

        const buildedDestinationFilePath = `${LoggerConfig.BASE_DIR}${destinationFile}`;

        fs.open(buildedDestinationFilePath, 'wx', (fileOpenErr, fileDescriptor) => {
          if (fileOpenErr) {
            callback(fileOpenErr);
            return;
          }

          fs.writeFile(fileDescriptor, buffer.toString('base64'), (writeFileErr) => {
            if (writeFileErr) {
              callback(writeFileErr);
              return;
            }

            fs.close(fileDescriptor, (closeFileErr) => {
              if (closeFileErr) {
                callback(closeFileErr);
                return;
              }

              callback(false);
            });
          });
        });
      });
    });
  },
  decompress: (config, callback) => {
    const { fileId } = config;

    const buildedFileNamePath = `${LoggerConfig.BASE_DIR}${fileId}.${LoggerConfig.DEFAULT_COMPRESSED_FILE_EXTENSION}`;
 
    fs.readFile(buildedFileNamePath, 'utf8', (readFileErr, str) => {
      if (readFileErr) {
        callback(readFileErr);
        return;
      }

      const inputBuffer = Buffer.from(str, 'base64');

      zlib.unzip(inputBuffer, (unzipErr, outputBuffer) => {
        if (unzipErr) {
          callback(unzipErr);
          return;
        }

        const outputString = outputBuffer.toString();

        callback(false, outputString);
      });
    });
  },
  truncate: (config, callback) => {
    const { fileId } = config;

    const buildedFilePath = `${LoggerConfig.BASE_DIR}${fileId}.${LoggerConfig.DEFAULT_FILE_EXTENSION}`;

    fs.truncate(buildedFilePath, 0, (err) => {
      if (err) {
        callback(err);
        return;
      }

      callback(false);
    });
  },
});

module.exports = _logger;
