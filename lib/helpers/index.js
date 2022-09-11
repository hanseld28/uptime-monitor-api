const fs = require('fs');
const crypto = require('crypto');
const config = require('../../config');
const https = require('https');

const helpers = {
  validate: (params = {}, callback) => {
    const {
      data,
      name,
      type,
      optional,
      defaultValue,
    } = params;

    const value = data[name];

    if (typeof(value) === type) {
      const result = callback(value);
      return result;
    }

    if (type === 'array' && value instanceof Array) {
      const result = callback(value);
      return result;
    }

    if (optional) {
      return {
        value: defaultValue,
        error: false,
      };
    }

    return {
      value: defaultValue,
      error: true,
      message: params.defaultMessage || 'Required field'
    };
  },
  parseJsonToObject: (json) => {
    try {
      return JSON.parse(json);
    } catch(e) {
      return {};
    }
  },
  parseObjectToJson: (obj) => {
    return JSON.stringify(obj);
  },
  hash: (str) => {
    if (typeof(str) === 'string' && str.length > 0) {
      const hashedStr = crypto.createHmac('sha256', config.hashingSecret)
        .update(str)
        .digest('hex');

      return hashedStr;
    }

    return false;
  },
  formatDateTime: (date) => {
    const theMonth = date.getMonth() + 1;
    const myMonth = ((theMonth < 10) ? '0' : '') + theMonth.toString();

    const theDate = date.getDate();
    const myDate = ((theDate < 10) ? '0' : '') + theDate.toString();

    const theHour = date.getHours();
    const myHour = ((theHour < 10) ? '0' : '') + theHour.toString();

    const theMinute = date.getMinutes();
    const myMinute = ((theMinute < 10) ? '0' : '') + theMinute.toString();

    const theSecond = date.getSeconds();
    mySecond = ((theSecond < 10) ? '0' : '') + theSecond.toString();

    const dateString = (
      `${date.getFullYear()}-${myMonth}-${myDate} ${myHour}:${myMinute}:${mySecond}`
    );

    return dateString;
  },
  getWithErrorOrDefault: (field, defaultValue = undefined) => {
    return field['error'] === true
      ? field
      : defaultValue
  },
  getValueFrom: (field) => {
    return field['value'];
  },
  getTokenFrom: (headers) => {
    return typeof(headers?.token) === 'string'
        ? headers?.token
        : undefined;
  },
  hasValue: (field) => (
    !!helpers.getValueFrom(field)
  ),
  createRandomString: (strLength) => {
    const validatedStringLength = typeof(strLength) === 'number' && strLength > 0
      ? strLength
      : false;

    if (!validatedStringLength) {
      return false;
    }

    const POSSIBLE_CHARACTERS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const randomizedString = ('$')
      .repeat(strLength)
      .split('')
      .reduce((previous) => {
        const randomCharacter = POSSIBLE_CHARACTERS.charAt(
          Math.floor(
            Math.random() * POSSIBLE_CHARACTERS.length
          )
        );

        return previous.concat(randomCharacter);
      }, '');

      return randomizedString;
  },
  sendTwilioSms: (data, callback) => {
    const phoneField = helpers.validate(
      { data, name: 'phone', type: 'string', defaultValue: undefined },
      (value) => (
        value && value.trim().length > 11
          ? { value: value.trim() }
          : {}
      )
    );

    const messageField = helpers.validate(
      { data, name: 'message', type: 'string', defaultValue: undefined },
      (value) => (
        value && value.trim()
          ? { value: value.trim() }
          : {}
      )
    );

    const invalidFields = [
      phoneField,
      messageField,
    ].filter((field) => (
      field.value === null || !field.value
    ));

    if (invalidFields.length > 0) {
      callback({
        error: true,
        message: 'Given parameters were missing or invalid',
      });

      return;
    }

    const phone = helpers.getValueFrom(phoneField);
    const message = helpers.getValueFrom(messageField);

    const payload = {
      'From': config.twilio.fromPhone,
      'To': `+${phone}`,
      'Body': message,
    };

    const stringPayload =  helpers.stringifyForQueryParams(payload);

    const requestDetails = {
      protocol: 'https:',
      hostname: 'api.twilio.com',
      method: 'POST',
      path: `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
      auth: `${config.twilio.accountSid}:${config.twilio.authToken}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload),
      },
    };

    const req = https.request(requestDetails, (res) => {
      const { statusCode } = res;

      const result = [200, 201].includes(statusCode)
        ? {
          error: false,
        } : {
          error: true,
          message: `Status code returned was ${statusCode}`
        };

      callback(result);
    });

    req.on('error', (err) => {
      callback({
        error: true,
        message: err,
      });
    });

    req.write(stringPayload);

    req.end();
  },
  makeDirectoryIfNotExists: (path) => {
    return new Promise((resolve) => {
      fs.mkdir(path, { recursive: true }, (err) => {
        if (err) {
          resolve(false);
          return;
        }
  
        resolve(true);
      });
    });
  },
};

module.exports = helpers;
