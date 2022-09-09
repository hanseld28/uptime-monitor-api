const helpers = require('../../helpers');
const _dataSource = require('../../_dataSource');
const config = require('../../../config');
const logger = require('../../helpers/logger');
const tokensHandler = require('../tokens');

const checksHandler = {
  checks: (data, callback) => {
    const ACCEPTABLE_METHODS = ['get', 'post', 'put', 'delete'];

    const method = typeof(data.method) === 'string'
      ? data.method.toLowerCase()
      : undefined;

    if (!ACCEPTABLE_METHODS.includes(method)) {
      callback({ ...data, status: 405 });
      return;
    }

    checksHandler._checks[data.method](data, callback);
  },
  _checks: {
    get: (data, callback) => {
      const { headers, query } = data;

      const idField = helpers.validate(
        { data: query, name: 'id', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length === 20
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'ID must be valid',
            }
        )
      );

      if (!helpers.hasValue(idField)) {
        callback({ ...data, status: 400 }, {
          error: true,
          message: 'ID query parameter is missing, or invalid',
        });

        return;
      }

      const id = helpers.getValueFrom(idField);

      _dataSource.read('checks', id, (checkReadErr, foundCheckData) => {
        if (checkReadErr) {
          callback({ ...data, status: 404 });
          return;
        }

        const token = helpers.getTokenFrom(headers);

        const phone = foundCheckData?.user?.phone;

        tokensHandler._tokens.verify({ id: token, phone}, (tokenIsValid) => {
          if (!tokenIsValid) {
            callback({ ...data, status: 403 }, {
              error: true,
              message: 'Missing required token in header, or token is invalid',
            });

            return;
          }

          callback({ ...data, status: 200 }, {
            ...foundCheckData,
          });
        });
      });
    },
    post: (data, callback) => {
      const { headers, payload } = data;

      const protocolField = helpers.validate(
        { data: payload, name: 'protocol', type: 'string', defaultValue: undefined },
        (value) => (
          ['https', 'http'].includes(value)
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'Protocol must be one of these: "https" or "http"',
            }
        )
      );

      const urlField = helpers.validate(
        { data: payload, name: 'url', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 0
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'URL must be valid',
            }
        )
      );

      const methodField = helpers.validate(
        { data: payload, name: 'method', type: 'string', defaultValue: undefined },
        (value) => (
          ['get', 'post', 'put', 'delete'].includes(value)
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'Method must be one of these: "get", "post", "put" or "delete"',
            }
        )
      );

      const successCodesField = helpers.validate(
        { data: payload, name: 'successCodes', type: 'array', defaultValue: undefined },
        (value) => (
          value.length > 0
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'Success codes list cannot be empty',
            }
        )
      );

      const timeoutSecondsField = helpers.validate(
        { data: payload, name: 'timeoutSeconds', type: 'number', defaultValue: undefined },
        (value) => (
          value % 1 === 0 && value >= 1 && value <= 5
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'Timeout in seconds must be >= 1 and <= 5',
            }
        )
      );

      const invalidFields = [
        protocolField,
        urlField,
        methodField,
        successCodesField,
        timeoutSecondsField,
      ].filter((field) => (
        !helpers.hasValue(field)
      ));

      if (invalidFields.length > 0) {
        callback({ ...data, status: 400 }, {
          error: true,
          message: 'Missing required fields, or fields are invalid',
          result: [{
            protocol: helpers.getWithErrorOrDefault(protocolField),
            url: helpers.getWithErrorOrDefault(urlField),
            method: helpers.getWithErrorOrDefault(methodField),
            successCodes: helpers.getWithErrorOrDefault(successCodesField),
            timeoutSeconds: helpers.getWithErrorOrDefault(timeoutSecondsField),
          }],
        });
        return;
      }

      const token = helpers.getTokenFrom(headers);

      _dataSource.read('tokens', token, (readTokenErr, foundToken) => {
        if(readTokenErr) {
          callback({ ...data, status: 403 });
          return;
        }

        const foundUserPhone = foundToken.phone;

        tokensHandler._tokens.verify({ id: token, phone: foundUserPhone}, (tokenIsValid) => {
          if (!tokenIsValid) {
            callback({ ...data, status: 403 }, {
              error: true,
              message: 'Missing required token in header, or token is invalid',
            });

            return;
          }

          _dataSource.read('users', foundUserPhone, (readUserErr, foundUser) => {
            if (readUserErr) {
              callback({ ...data, status: 403 });
              return;
            }

            const checksField = helpers.validate(
              { data: foundUser, name: 'checks', type: 'array', optional: true, defaultValue: [] },
              (value) => ({
                value,
                error: false,
              })
            );

            const userChecks = helpers.getValueFrom(checksField);

            if (userChecks.length >= config.maxChecks) {
              callback({ ...data, status: 400 }, {
                error: true,
                message: `The user already has the maximum number of checks (${config.maxChecks})`,
              });
              return;
            }

            const checkId = helpers.createRandomString(20);

            const newCheckObject = {
              id: checkId,
              user: {
                phone: foundUserPhone,
              },
              protocol: helpers.getValueFrom(protocolField),
              url: helpers.getValueFrom(urlField),
              method: helpers.getValueFrom(methodField),
              successCodes: helpers.getValueFrom(successCodesField),
              timeoutSeconds: helpers.getValueFrom(timeoutSecondsField),
            };

            _dataSource.create('checks', checkId, newCheckObject, (createCheckErr) => {
              if (createCheckErr) {
                callback({ ...data, status: 500 }, {
                  error: true,
                  message: 'Could not create the new check',
                });
                return;
              }

              const updatedUserData = {
                ...foundUser,
                checks: [
                  ...userChecks,
                  { id: checkId },
                ],
              };

              _dataSource.update('users', foundUserPhone, updatedUserData, (updateUserErr) => {
                if (updateUserErr) {
                  callback({ ...data, status: 500 }, {
                    error: true,
                    message: 'Could not update the user with the new check',
                  });
                  return;
                }

                callback({ ...data, status: 201 }, {
                  result: [
                    newCheckObject,
                  ],
                });
              });
            });
          });
        });
      });
    },
    put: (data, callback) => {
      const { headers, payload } = data;

      const idField = helpers.validate(
        { data: payload, name: 'id', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length === 20
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'ID must be valid',
            }
        )
      );

      const protocolField = helpers.validate(
        { data: payload, name: 'protocol', type: 'string', defaultValue: undefined },
        (value) => (
          ['https', 'http'].includes(value)
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'Protocol must be one of these: "https" or "http"',
            }
        )
      );

      const urlField = helpers.validate(
        { data: payload, name: 'url', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 0
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'URL must be valid',
            }
        )
      );

      const methodField = helpers.validate(
        { data: payload, name: 'method', type: 'string', defaultValue: undefined },
        (value) => (
          ['get', 'post', 'put', 'delete'].includes(value)
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'Method must be one of these: "get", "post", "put" or "delete"',
            }
        )
      );

      const successCodesField = helpers.validate(
        { data: payload, name: 'successCodes', type: 'array', defaultValue: undefined },
        (value) => (
          value.length > 0
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'Success codes list cannot be empty',
            }
        )
      );

      const timeoutSecondsField = helpers.validate(
        { data: payload, name: 'timeoutSeconds', type: 'number', defaultValue: undefined },
        (value) => (
          value % 1 === 0 && value >= 1 && value <= 5
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'Timeout in seconds must be >= 1 and <= 5',
            }
        )
      );

      if (idField.value === null || !idField.value) {
        callback({ ...data, status: 400 }, {
          error: true,
          message: 'Missing required field',
        });
        return;
      }

      const invalidFields = [
        protocolField,
        urlField,
        methodField,
        successCodesField,
        timeoutSecondsField,
      ].filter((field) => (
        field.value === null || !field.value
      ));

      if (invalidFields.length === 5) {
        callback({ ...data, status: 400 }, {
          error: true,
          message: 'Missing fields to update'
        });
        return;
      }

      const id = helpers.getValueFrom(idField);

      _dataSource.read('checks', id, (checkReadErr, foundCheckData) => {
        if (checkReadErr) {
          callback({ ...data, status: 400 }, {
            error: true,
            message: 'Check ID did not exist',
          });
          return;
        }

        const token = helpers.getTokenFrom(headers);

        tokensHandler._tokens.verify({ id: token, phone: foundCheckData?.user?.phone}, (tokenIsValid) => {
          if (!tokenIsValid) {
            callback({ ...data, status: 403 }, {
              error: true,
              message: 'Missing required token in header, or token is invalid',
            });

            return;
          }

          const updatedCheckData = Object.assign({}, foundCheckData);

          if (helpers.hasValue(protocolField)) {
            updatedCheckData.protocol = helpers.getValueFrom(protocolField);
          }

          if (helpers.hasValue(urlField)) {
            updatedCheckData.url = helpers.getValueFrom(urlField);
          }

          if (helpers.hasValue(methodField)) {
            updatedCheckData.method = helpers.getValueFrom(methodField);
          }

          if (helpers.hasValue(successCodesField)) {
            updatedCheckData.successCodes = helpers.getValueFrom(successCodesField);
          }

          if (helpers.hasValue(timeoutSecondsField)) {
            updatedCheckData.timeoutSeconds = helpers.getValueFrom(timeoutSecondsField);
          }

          _dataSource.update('checks', id, updatedCheckData, (updateCheckErr) => {
            if (updateCheckErr) {
              callback({ ...data, status: 500 }, {
                error: true,
                message: 'Could not update the check',
              });

              return;
            }

            callback({ ...data, status: 200 });
          })
        });
      });
    },
    delete: (data, callback) => {
      const { headers, query } = data;

      const idField = helpers.validate(
        { data: query, name: 'id', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length === 20
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'ID must be valid',
            }
        )
      );

      if (idField.value === null || !idField.value) {
        callback({ ...data, status: 400 }, {
          error: true,
          message: 'Missing required field',
        });
        return;
      }

      const checkId = helpers.getValueFrom(idField);

      _dataSource.read('checks', checkId, (checkReadErr, foundCheckData) => {
        if (checkReadErr) {
          callback({ ...data, status: 400 }, {
            error: true,
            message: 'The specified check ID does not exist',
          });
          return;
        }

        const token = helpers.getTokenFrom(headers);

        tokensHandler._tokens.verify({ id: token, phone: foundCheckData?.user?.phone }, (tokenIsValid) => {
          if (!tokenIsValid) {
            callback({ ...data, status: 403 }, {
              error: true,
              message: 'Missing required token in header, or token is invalid',
            });

            return;
          }

          _dataSource.delete('checks', checkId, (deleteCheckErr) => {
            if (deleteCheckErr) {
              callback({ ...data, status: 500 }, {
                error: true,
                message: 'Could not delete the check data',
              });

              return;
            }

            _dataSource.read('users', foundCheckData?.user?.phone, (readUserErr, foundUser) => {
              if (readUserErr) {
                callback({ ...data, status: 404 }, {
                  error: true,
                  message: 'Could not find the user who created the check, so could not remove the check from the list of checks on the user',
                });

                return;
              }

              const updatedUserChecksListWithoutRemovedCheck = foundUser?.checks
                ?.filter((relatedCheck) => (
                  relatedCheck.id !== checkId
                ));

              const updatedUserData = {
                ...foundUser,
                checks: updatedUserChecksListWithoutRemovedCheck,
              };

              _dataSource.update('users', foundUser.phone, updatedUserData, (updateUserErr) => {
                if (updateUserErr) {
                  callback({ ...data, status: 500 }, {
                    error: true,
                    message: 'Could not update the user',
                  });
                  return;
                }

                callback({ ...data, status: 200 });
              });
            });
          });
        });
      });
    },
  }
};

module.exports = checksHandler