const environments = {
  development: {
    envName: 'development',
    host: '127.0.0.1',
    httpPort: 3000,
    httpsPort: 3001,
    hashingSecret: 'UPTM_DEV_SECRET',
    maxChecks: 5,
    twilio: {
      accountSid: '<YOUR ACCOUNT SID>',
      authToken: '<YOUR AUTH TOKEN>',
      fromPhone: '<YOUR GENERATED PHONE>',
    },
  },
  production: {
    envName: 'production',
    host: '127.0.0.1',
    httpPort: 5000,
    httpsPort: 5001,
    hashingSecret: 'UPTM_PROD_SECRET',
    maxChecks: 5,
    twilio: {
      accountSid: '<YOUR ACCOUNT SID>',
      authToken: '<YOUR AUTH TOKEN>',
      fromPhone: '<YOUR GENERATED PHONE>',
    },
  },
};

const currentEnvironment = typeof(process.env.NODE_ENV) === 'string'
  ? process.env.NODE_ENV.toLocaleLowerCase()
  : '';

const environmentToExport = typeof(environments[currentEnvironment]) === 'object'
  ? environments[currentEnvironment]
  : environments.development;

module.exports = environmentToExport;
