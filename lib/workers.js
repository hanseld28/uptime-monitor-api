const path = require('path');
const fs = require('fs');
const _dataSource = require('./_dataSource');
const https = require('https');
const http = require('http');
const helpers = require('./helpers');
const url = require('url');
const logger = require('./helpers/logger');

const workers = {
  processCheckOutcome: (checkData, checkOutcome) => {
    // TODO: implement the check outcome process
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
      { data: check, name: 'phone', type: 'string', defaultValue: undefined },
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
      { data: payload, name: 'url', type: 'string', defaultValue: undefined },
      (value) => (
        value.trim().length > 0
          ? { value }
          : {}
      )
    );

    const methodField = helpers.validate(
      { data: payload, name: 'method', type: 'string', defaultValue: undefined },
      (value) => (
        ['get', 'post', 'put', 'delete'].includes(value)
          ? { value  }
          : {}
      )
    );

    const successCodesField = helpers.validate(
      { data: payload, name: 'successCodes', type: 'array', defaultValue: undefined },
      (value) => (
        value.length > 0
          ? { value }
          : {}
      )
    );

    const timeoutSecondsField = helpers.validate(
      { data: payload, name: 'timeoutSeconds', type: 'number', defaultValue: undefined },
      (value) => (
        value % 1 === 0 && value >= 1 && value <= 5
          ? { value } : {}
      )
    );

    const statusField = helpers.validate(
      { data: check, name: 'status', type: 'string', defaultValue: undefined },
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
      statusField,
      lastCheckedField,
    ].filter((field) => (
      !helpers.hasValue(field)
    ));

    if (invalidFields.length > 0) {
      logger.error('Error: one of the checks is not properly formatted. Skipping it...')
      return;
    }

    workers.performCheck(check);
  },
  gatherAllChecks: () => {
    _dataSource.list('checks', (listErr, identifiers) => {
      if (listErr) {
        logger.info('[WORKER] Could not find any checks to process');
        return;
      }

      identifiers.forEach((checkId) => {
        _dataSource.read('checks', checkId, (readErr, checkData) => {
          if (readErr) {
            logger.error('[WORKER] Error reading one of check\'s data');
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
    }, 1000 * 60);
  },
  start: () => {
    workers.gatherAllChecks();
    workers.loop();
  },
};

module.exports = workers;
