const config = require('../../config');
const getLogger = require('../helpers/_logger');
const _dataSource = require('./_dataSource');
const https = require('https');
const http = require('http');
const helpers = require('../helpers');
const url = require('url');

const _logger = getLogger({
  custom: true,
  flag: 'WORKERS',
  color: '\x1b[31m%s\x1b[0m',
});

const workers = {
  log: (data, fileNameGetter) => {
    const logDataString = JSON.stringify(data);
    const logFileName = fileNameGetter(data);

    _logger.append(logFileName, logDataString, (err) => {
      if (err) {
        _logger.error(`Logging to file failed: ${err}`);
        return;
      }

      _logger.info('Logging to file succeeded');
    });
  },
  alertUserToStatusChange: (updatedCheckData) => {
    const message = `[UPTIME MONITOR] Alert: Your check for ${
      updatedCheckData.method.toUpperCase()
    } ${updatedCheckData.protocol}://${
      updatedCheckData.url
    } is currently ${updatedCheckData.state.toLowerCase()}`;

    const messagePayload = {
      phone: updatedCheckData.user.phone,
      message,
    };
    
    helpers.sendTwilioSms(messagePayload, (sendMessageResult) => {
      if (sendMessageResult.error) {
        _logger.warn(
          `Could not send SMS alert to user who had a state change in their check: ${
            sendMessageResult.message
          }`
        );
        return;
      }

      _logger.info(
        `[SUCCESS] User was alerted to a status change in their check, via SMS: ${message}`
      );

    });

     
  },
  processCheckOutcome: (checkData, checkOutcome) => {
    const currentState = (
      !checkOutcome.error
      && checkOutcome?.response?.code
      && checkData?.successCodes?.includes(
        checkOutcome.response.code
      )
    ) ? 'UP' : 'DOWN';

    const alertWarranted = (
      checkData.lastChecked
      && checkData.state !== currentState
    );

    const timeOfCheck = Date.now();

    const updatedCheckData = {
      ...checkData,
      state: currentState,
      lastChecked: timeOfCheck,
    };

    const logData = {
      check: updatedCheckData,
      outcome: checkOutcome,
      state: currentState,
      alert: alertWarranted,
      time: timeOfCheck,
    };

    workers.log(logData, (data) => (
      data.check.id
    ));

    _dataSource.update('checks', updatedCheckData.id, updatedCheckData, (updateErr) => {
      if (updateErr) {
        _logger.error('Error trying to save updates to one of the checks');
        return;
      }

      if (alertWarranted) {
        workers.alertUserToStatusChange(updatedCheckData);
        return;
      }

      _logger.info(`Check outcome ${updatedCheckData.id} has not changed, no alert needed`);
    });
  },
  performCheck: (checkData) => {
    const checkOutcome = {
      error: false,
      message: undefined,
      response: {
        code: undefined,
      },
    };

    let outcomeSent = false;

    const {
      hostname: hostName,
      path,
    } = url.parse(
      `${checkData.protocol}://${checkData.url}`,
      true
    );

    const requestDetails = {
      protocol: `${checkData.protocol}:`,
      hostname: hostName,
      method: checkData.method.toUpperCase(),
      path,
      timeout: checkData.timeoutSeconds * 1000,
    };

    const _moduleToUse = (
      checkData.protocol === 'http'
        ? http
        : https
    );

    const req = _moduleToUse.request(requestDetails, (res) => {
      const status = res.statusCode;

      checkOutcome.response.code = status;

      if (!outcomeSent) {
        workers.processCheckOutcome(checkData, checkOutcome);
        outcomeSent = true;
      }
    })

    req.on('error', (err) => {
      checkOutcome.error = {
        error: true,
        value: err,
      };

      if (!outcomeSent) {
        workers.processCheckOutcome(checkData, checkOutcome);
        outcomeSent = true;
      }
    });

    req.on('timeout', (err) => {
      checkOutcome.error = {
        error: true,
        value: 'timeout',
      };

      if (!outcomeSent) {
        workers.processCheckOutcome(checkData, checkOutcome);
        outcomeSent = true;
      }
    });

    req.end();
  },
  validateCheckData: (checkData) => {
    const checkDataField = helpers.validate(
      { data: { check: checkData }, name: 'check', type: 'object' },
      (value) => (
        value !== null
          ? { value }
          : { value: {} }
      )
    );

    const check = helpers.getValueFrom(checkDataField);

    const idField = helpers.validate(
      { data: check, name: 'id', type: 'string', defaultValue: undefined },
      (value) => (
        value.trim().length === 20
          ? { value: value.trim() }
          : {}
      )
    );

    const phoneField = helpers.validate(
      { data: check.user, name: 'phone', type: 'string', defaultValue: undefined },
      (value) => (
        value.trim().length > 11
          ? { value: value.trim() }
          : {}
      )
    );

    const protocolField = helpers.validate(
      { data: check, name: 'protocol', type: 'string', defaultValue: undefined },
      (value) => (
        ['https', 'http'].includes(value)
          ? { value }
          : {}
      )
    );

    const urlField = helpers.validate(
      { data: check, name: 'url', type: 'string', defaultValue: undefined },
      (value) => (
        value.trim().length > 0
          ? { value }
          : {}
      )
    );

    const methodField = helpers.validate(
      { data: check, name: 'method', type: 'string', defaultValue: undefined },
      (value) => (
        ['get', 'post', 'put', 'delete'].includes(value)
          ? { value  }
          : {}
      )
    );

    const successCodesField = helpers.validate(
      { data: check, name: 'successCodes', type: 'array', defaultValue: undefined },
      (value) => (
        value.length > 0
          ? { value }
          : {}
      )
    );

    const timeoutSecondsField = helpers.validate(
      { data: check, name: 'timeoutSeconds', type: 'number', defaultValue: undefined },
      (value) => (
        value % 1 === 0 && value >= 1 && value <= 5
          ? { value } : {}
      )
    );

    const stateField = helpers.validate(
      { data: check, name: 'state', type: 'string', defaultValue: undefined },
      (value) => (
        ['UP', 'DOWN'].includes(value)
        ? { value }
        : { value: 'DOWN' }
      )
    );

    const lastCheckedField = helpers.validate(
      { data: check, name: 'lastChecked', type: 'number', defaultValue: undefined },
      (value) => (
        value > 0
          ? { value }
          : {}
      )
    );

    const invalidFields = [
      idField,
      phoneField,
      protocolField,
      urlField,
      methodField,
      successCodesField,
      timeoutSecondsField,
    ].filter((field) => (
      !helpers.hasValue(field)
    ));

    if (invalidFields.length > 0) {
      _logger.error('Error: one of the checks is not properly formatted. Skipping it...')
      return;
    }

    workers.performCheck(check);
  },
  gatherAllChecks: () => {
    _dataSource.list('checks', (listErr, identifiers) => {
      if (listErr) {
        _logger.info('Could not find any checks to process');
        return;
      }

      identifiers.forEach((checkId) => {
        _dataSource.read('checks', checkId, (readErr, checkData) => {
          if (readErr) {
            _logger.error('Error reading one of check\'s data');
            return;
          }

          workers.validateCheckData(checkData);
        });
      });
    });
  },
  loop: () => {
    setInterval(() => {
      workers.gatherAllChecks();
    }, config.workers.check.intervalMilliseconds);
  },
  logRotationLoop: () => {
    setInterval(() => {
      workers.rotateLogs();
    }, config.workers.logging.intervalMilliseconds);
  },
  rotateLogs: () => {
    _logger.list({ includeCompressedLogs: false }, (listErr, logs) => {
      if (listErr || (logs && logs.length === 0)) {
        _logger.error('Error could not find any logs to rotate');
        return;
      }

      logs.forEach((logName) => {
        const logId = logName.replace(`.${_logger.DEFAULT_FILE_EXTENSION}`);
        const newFileId = `${logId}-${Date.now()}`;

        const compressConfig = {
          source: logId,
          destination: newFileId,
        };

        _logger.compress(compressConfig, (compressErr) => {
          if (compressErr) {
            _logger.error(`Error compressing one of the log files: ${compressErr}`);
            return;
          }

          _logger.truncate({ fileId: logId }, (truncateErr) => {
            if (truncateErr) {
              _logger.error('Error truncating log file');
              return;
            }

            _logger.info('Success truncating log file');
          });
        });
      });
    });
  },
  start: () => {
    _logger.log('Background workers are running');

    workers.gatherAllChecks();
    workers.loop();
    workers.rotateLogs();
    workers.logRotationLoop();
  },
};

module.exports = workers;
