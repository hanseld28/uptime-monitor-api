const helpers = require('../../helpers');
const _dataSource = require('../../_dataSource');
const logger = require('../../helpers/logger');
const tokensHandler = require('../tokens');

const usersHandler = {
  users: (data, callback) => {
    const ACCEPTABLE_METHODS = ['get', 'post', 'put', 'delete'];

    const method = typeof(data.method) === 'string'
      ? data.method.toLowerCase()
      : undefined;

    if (!ACCEPTABLE_METHODS.includes(method)) {
      callback({ ...data, status: 405 });
      return;
    }

    usersHandler._users[data.method](data, callback);
  },
  _users: {
    get: (data, callback) => {
      const { headers, query } = data;

      const phoneField = helpers.validate(
        { data: query, name: 'phone', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 11
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'Phone number must have at least 11 numbers',
            }
        )
      );

      if (!helpers.hasValue(phoneField)) {
        callback({ ...data, status: 400 }, {
          error: true,
          message: 'Phone number query parameter is missing or invalid',
        });

        return;
      }

      const phone = helpers.getValueFrom(phoneField);

      const token = helpers.getTokenFrom(headers);

      tokensHandler._tokens.verify({ id: token, phone}, (tokenIsValid) => {
        if (!tokenIsValid) {
          callback({ ...data, status: 403 }, {
            error: true,
            message: 'Missing required token in header, or token is invalid',
          });

          return;
        }

        _dataSource.read('users', phone, (readErr, foundUser) => {
          if (readErr) {
            callback({ ...data, status: 404 });
            return;
          }

          delete foundUser.hashedPassword;

          callback({ ...data, status: 200 }, {
            ...foundUser,
          });
        });
      });
    },
    post: (data, callback) => {
      const { payload } = data;

      const firstNameField = helpers.validate(
        { data: payload, name: 'firstName', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 0
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'First name is required',
            }
        )
      );
      const lastNameField = helpers.validate(
        { data: payload, name: 'lastName', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 0
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'Last name is required',
            }
        )
      );
      const phoneField = helpers.validate(
        { data: payload, name: 'phone', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 11
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'Phone number must have at least 11 numbers',
            }
        )
      );
      const passwordField = helpers.validate(
        { data: payload, name: 'password', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 7
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'Password must have at least 8 characters',
            }
        )
      );
      const tosAgreementField = helpers.validate(
        { data: payload, name: 'tosAgreement', type: 'boolean', defaultValue: false },
        (value) => (
          value
            ? {
              value: true,
              error: false,
            }
            : {
              error: true,
              message: 'Terms of service agreement must be accepted to proceed',
            }
        )
      );

      const invalidFields = [
        firstNameField,
        lastNameField,
        phoneField,
        passwordField,
        tosAgreementField,
      ].filter((field) => (
        !helpers.hasValue(field)
      ));

      if (invalidFields.length > 0) {
        callback({ ...data, status: 400 }, {
          result: [{
            firstName: helpers.getWithErrorOrDefault(firstNameField),
            lastName: helpers.getWithErrorOrDefault(lastNameField),
            phone: helpers.getWithErrorOrDefault(phoneField),
            password: helpers.getWithErrorOrDefault(passwordField),
            tosAgreement: helpers.getWithErrorOrDefault(tosAgreementField),
          }],
        });
        return;
      }

      const phone = helpers.getValueFrom(phoneField);

      _dataSource.read('users', phone, (readErr) => {
        if (!readErr) {
          callback({ ...data, status: 400 }, {
            result: [{
              phone: {
                error: true,
                message: 'An user with that phone number already exists',
              },
            }],
          });

          return;
        }

        const hashedPassword = helpers.hash(
          helpers.getValueFrom(passwordField)
        );

        if (hashedPassword) {
          const user = {
            firstName: helpers.getValueFrom(firstNameField),
            lastName: helpers.getValueFrom(lastNameField),
            phone,
            password: hashedPassword,
            tosAgreement: helpers.getValueFrom(tosAgreementField),
          };

          _dataSource.create('users', phone, user, (createErr) => {
            if (createErr !== false) {
              callback({ ...data, status: 500 }, {
                error: true,
                message: 'Could not create the new user',
              });

              logger.error('[Error on creating user: ', createErr);

              return;
            }

            callback({ ...data, status: 200 });
          });

          return;
        }

        callback({ ...data, status: 500 }, {
          error: true,
          message: 'Could not hash the user\'s password',
        });
      });
    },
    put: (data, callback) => {
      const { headers, payload } = data;

      const phoneField = helpers.validate(
        { data: payload, name: 'phone', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 11
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'Phone number must have at least 11 numbers',
            }
        )
      );

      if (phoneField.value === null || !phoneField.value) {
        callback({ ...data, status: 400 }, {
          error: true,
          message: 'Missing required field',
        });
        return;
      }

      const passwordField = helpers.validate(
        { data: payload, name: 'password', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 7
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'Password must have at least 8 characters',
            }
        )
      );

      const firstNameField = helpers.validate(
        { data: payload, name: 'firstName', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 0
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'First name is required',
            }
        )
      );

      const lastNameField = helpers.validate(
        { data: payload, name: 'lastName', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 0
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'Last name is required',
            }
        )
      );

      const invalidFields = [
        firstNameField,
        lastNameField,
        passwordField,
      ].filter((field) => (
        field.value === null || !field.value
      ));

      if (invalidFields.length === 3) {
        callback({ ...data, status: 400 }, {
          error: true,
          message: 'Missing fields to update'
        });
        return;
      }

      const phone = helpers.getValueFrom(phoneField);

      const token = helpers.getTokenFrom(headers);

      tokensHandler._tokens.verify({ id: token, phone}, (tokenIsValid) => {
        if (!tokenIsValid) {
          callback({ ...data, status: 403 }, {
            error: true,
            message: 'Missing required token in header, or token is invalid',
          });

          return;
        }

        _dataSource.read('users', phone, (readErr, foundUserData) => {
          if (readErr && !foundUserData) {
            callback({ ...data, status: 404 }, {
              error: true,
              message: 'The specified user does not exist',
            });
            return;
          }

          const updatedUserData = Object.assign({}, foundUserData);

          if (helpers.hasValue(firstNameField)) {
            updatedUserData.firstName = helpers.getValueFrom(firstNameField);
          }

          if (helpers.hasValue(lastNameField)) {
            updatedUserData.lastName = helpers.getValueFrom(lastNameField);
          }

          if (helpers.hasValue(passwordField)) {
            const password = helpers.getValueFrom(passwordField);
            updatedUserData.hashedPassword = helpers.hash(password);
          }

          _dataSource.update('users', phone, updatedUserData, (updateErr) => {
            if (updateErr) {
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
    },
    delete: (data, callback) => {
      const { headers, query } = data;

      const phoneField = helpers.validate(
        { data: query, name: 'phone', type: 'string', defaultValue: undefined },
        (value) => (
          value.trim().length > 11
            ? {
              value: value.trim(),
              error: false,
            }
            : {
              error: true,
              message: 'Phone number must have at least 11 numbers',
            }
        )
      );

      if (!helpers.hasValue(phoneField)) {
        callback({ ...data, status: 400 }, {
          error: true,
          message: 'Phone number query parameter is missing or invalid',
        });

        return;
      }

      const phone = helpers.getValueFrom(phoneField);

      const token = helpers.getTokenFrom(headers);

      tokensHandler._tokens.verify({ id: token, phone}, (tokenIsValid) => {
        if (!tokenIsValid) {
          callback({ ...data, status: 403 }, {
            error: true,
            message: 'Missing required token in header, or token is invalid',
          });

          return;
        }

        _dataSource.read('users', phone, (readErr, foundUser) => {
          if (readErr) {
            callback({ ...data, status: 404 }, {
              error: true,
              message: 'Could not find the specified user',
            });
            return;
          }

          _dataSource.delete('users', phone, (deleteErr) => {
            if (deleteErr) {
              callback({ ...data, status: 500 }, {
                error: true,
                message: 'Could not delete the specified user',
              });
              return;
            }

            const userChecksField = helpers.validate(
              { data: foundUser, name: 'checks', type: 'array', defaultValue: undefined },
              (value) => (
                value.length > 0
                  ? { value }
                  : {}
              )
            );

            if (!helpers.hasValue(userChecksField)) {
              callback({ ...data, status: 200 });

              return;
            }

            const userChecks = helpers.getValueFrom(userChecksField);

            const result = userChecks.reduce((previousResult, currentCheck) => {
              _dataSource.delete('checks', currentCheck.id, (deleteCheckErr) => {
                if (deleteCheckErr) {
                  previousResult.deletionErrors = true;

                  return;
                }

                previousResult.checksDeleted += 1;
              });

              return previousResult;
            }, {
              deletionErrors: false,
              checksDeleted: 0,
            });

            if (result.deletionErrors) {
              const numberOfNonDeletedChecks = userChecks.length - result.checksDeleted;

              callback({ ...data, status: 500 }, {
                error: true,
                message: `Errors encountered while attempting to delete all of the user's checks: ${numberOfNonDeletedChecks} checks may not have been deleted successfully`,
              });

              return;
            }

            callback({ ...data, status: 200 });
          });
        });
      });
    },
  },
};

module.exports = usersHandler;
