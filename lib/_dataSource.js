const fs = require('fs');
const path = require('path');
const helpers = require('./helpers');

const _dataSource = {
  BASE_DIR: path.join(__dirname, '/../.data/'),
  DEFAULT_FILE_EXTENSION: 'json',
  create: (dir, file, data, callback) => {
    const buildedPath = `${_dataSource.BASE_DIR}${dir}/${file}.${_dataSource.DEFAULT_FILE_EXTENSION}`;
    const flags = 'wx';

    fs.open(buildedPath, flags, (err, fileDescriptor) => {
      if (err || !fileDescriptor) {
        callback('Could not create new file, it may already exist');
        return;
      }

      const stringData = helpers.parseObjectToJson(data);

      fs.writeFile(fileDescriptor, stringData, (writeErr) => {
        if (writeErr) {
          callback('Error writing to new file');
          return;
        }

        fs.close(fileDescriptor, (closeErr) => {
          if (closeErr) {
            callback('Error closing new file');
            return;
          }

          callback(false);
        });
      });
    });
  },
  read: (dir, file, callback) => {
    const buildedPath = `${_dataSource.BASE_DIR}${dir}/${file}.${_dataSource.DEFAULT_FILE_EXTENSION}`;
    const encoding = 'utf8';

    fs.readFile(buildedPath, encoding, (err, data) => {
      if (err !== null) {
        callback(true, data);
        return;
      }

      const parsedData = helpers.parseJsonToObject(data);
      callback(false, parsedData);
    });
  },
  update: (dir, file, data, callback) => {
    const buildedPath = `${_dataSource.BASE_DIR}${dir}/${file}.${_dataSource.DEFAULT_FILE_EXTENSION}`;
    const flags = 'r+';

    fs.open(buildedPath, flags, (err, fileDescriptor) => {
      if (err || !fileDescriptor) {
        callback('Could not open the file for updating, it may not exist yet');
        return;
      }

      const stringData = helpers.parseObjectToJson(data);

      fs.ftruncate(fileDescriptor, (truncateErr) => {
        if (truncateErr) {
          callback('Error truncating file');
          return;
        }

        fs.writeFile(fileDescriptor, stringData, (writeErr) => {
          if (writeErr) {
            callback('Error writing to existing file');
            return;
          }

          fs.close(fileDescriptor, (closeErr) => {
            if (closeErr) {
              callback('Error closing the file');
              return;
            }

            callback(false);
          });
        });
      });
    });
  },
  delete: (dir, file, callback) => {
    const buildedPath = `${_dataSource.BASE_DIR}${dir}/${file}.${_dataSource.DEFAULT_FILE_EXTENSION}`;

    fs.unlink(buildedPath, (err) => {
      if (err) {
        callback('Error deleting file');
        return;
      }

      callback(false);
    });
  },
  list: (dir, callback) => {
    const buildedPath = `${_dataSource.BASE_DIR}${dir}/`;

    fs.readdir(buildedPath, (err, data) => {
      if (err != null || (data && data.length === 0)) {
        callback(true, data);
        return;
      };

      const trimmedFileNames = data.map((fileName) => (
        fileName.replace(`.${_dataSource.DEFAULT_FILE_EXTENSION}`, '')
      ));

      callback(false, trimmedFileNames);
    });
  }
};


module.exports = _dataSource;