const helpers = require('../../helpers');
const getLogger = require('../../helpers/_logger');
const _dataSource = require('../../core/_dataSource');

const _logger = getLogger();

const tokensHandler = {
  tokens: (data, callback) => {
    const ACCEPTABLE_METHODS = ['get', 'post', 'put', 'delete'];

    const method = typeof(data.method) === 'string'
      ? data.method.toLowerCase()
      : undefined;

    if (!ACCEPTABLE_METHODS.includes(method)) {
      callback({ ...data, status: 405 });
      return;
    }

    tokensHandler._tokens[data.method](data, callback);
  },
  _tokens: {
    get: (data, callback) => {
      const { query } = data;

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

      _dataSource.read('tokens', helpers.getValueFrom(idField), (readErr, foundToken) => {
        if (readErr) {
          callback({ ...data, status: 404 });
          return;
        }

        callback({ ...data, status: 200 }, foundToken);
      });
    },
    post: (data, callback) => {
      const { payload } = data;

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

      const invalidFields = [
        phoneField,
        passwordField,
      ].filter((field) => (
        !helpers.hasValue(field)
      ));

      if (invalidFields.length > 0) {
        callback({ ...data, status: 400 }, {
          result: [{
            phone: helpers.getWithErrorOrDefault(phoneField),
            password: helpers.getWithErrorOrDefault(passwordField)
          }],
        });
        return;
      }

      const phone = helpers.getValueFrom(phoneField);

      _dataSource.read('users', phone, (readErr, foundUser) => {
        if (readErr) {
          callback({ ...data, status: 404 }, {
            error: true,
            message: 'Could not find the specified user',
          });
          return;
        }

        const foundUserHashedPassword = foundUser.password;

        const password = helpers.getValueFrom(passwordField);
        const hashedPassword = helpers.hash(password);

        if (hashedPassword !== foundUserHashedPassword) {
          callback({ ...data, status: 400 }, {
            error: true,
            message: 'Password did not match the specified user\'s stored password',
          });
          return;
        }

        const tokenId = helpers.createRandomString(20);
        const expires = Date.now() + (1000 * 60 * 60);

        const token = {
          id: tokenId,
          phone,
          expires,
        };

        _dataSource.create('tokens', tokenId, token, (createErr) => {
          if (createErr) {
            callback({ ...data, status: 500 }, {
              error: true,
              message: 'Could not create the new token',
            });
            return;
          }

          callback({ ...data, status: 200 }, {
            ...token,
          });
        });
      });
    },
    put: (data, callback) => {
      const { payload } = data;

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

      const extendField = helpers.validate(
        { data: payload, name: 'extend', type: 'boolean', defaultValue: false },
        (value) => (
          value
            ? {
              value,
              error: false,
            }
            : {
              error: true,
              message: 'Extend must be true to update token',
            }
        )
      );

      const invalidFields = [
        idField,
        extendField,
      ].filter((field) => (
        !helpers.hasValue(field)
      ));

      if (invalidFields.length > 0) {
        callback({ ...data, status: 400 }, {
          result: [{
            id: helpers.getWithErrorOrDefault(idField),
            extend: helpers.getWithErrorOrDefault(extendField)
          }],
        });
        return;
      }

      const id = helpers.getValueFrom(idField);

      _dataSource.read('tokens', id, (readErr, foundToken) => {
        if (readErr) {
          callback({ ...data, status: 404 }, {
            error: true,
            message: 'Specified token does not exist',
          });
          return;
        }

        const dateNow = Date.now();

        if (foundToken.expires < dateNow) {
          callback({ ...data, status: 400 }, {
            error: true,
            message: 'The token has already expired, and cannot be extended',
          })
          return;
        }

        const newExpiration = dateNow + 1000 * 60 * 60;

          const updatedToken = {
            ...foundToken,
            expires: newExpiration,
          };

          _dataSource.update('tokens', id, updatedToken, (updateErr) => {
            if (updateErr) {
              callback({ ...data, status: 500 }, {
                error: true,
                message: 'Could not update the token\'s expiration',
              })
              return;
            }

            callback({ ...data, status: 200 });
          });
      });
    },
    delete: (data, callback) => {
      const { query } = data;

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
          message: 'ID query parameter is missing or invalid',
        });

        return;
      }

      const id = helpers.getValueFrom(idField);

      _dataSource.read('tokens', id, (readErr) => {
        if (readErr) {
          callback({ ...data, status: 404 }, {
            error: true,
            message: 'Could not find the specified token',
          });
          return;
        }

        _dataSource.delete('tokens', id, (deleteErr) => {
          if (deleteErr) {
            callback({ ...data, status: 500 }, {
              error: true,
              message: 'Could not delete the specified token',
            });
            return;
          }

          callback({ ...data, status: 200 });
        });
      });
    },
    verify: (params, callback) => {
      const { id, phone } = params;

      _dataSource.read('tokens', id, (err, foundToken) => {
        if (err) {
          _logger.warn('Specified token does not exist');

          callback(false);

          return;
        }

        if (foundToken.phone !== phone) {
          _logger.warn('Token\'s phone does not match with existing token');

          callback(false);

          return;
        }

        if (foundToken.expires < Date.now()) {
          _logger.warn('The token has already expired');

          callback(false);

          return;
        }

        callback(true);
      });
    }
  }
};

module.exports = tokensHandler;
