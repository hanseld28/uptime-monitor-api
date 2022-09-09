const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const { StringDecoder } = require('string_decoder');
const config = require('../config');
const router = require('./router');
const handlers = require('./handlers');
const logger = require('./helpers/logger');
const helpers = require('./helpers');

const httpServerOptions = {
  host: config.host,
  port: config.httpPort,
};

const httpsServerOptions = {
  host: config.host,
  port: config.httpsPort,
};

const httpsServerConfig = {
  key: fs.readFileSync('./https/key.pem'),
  cert: fs.readFileSync('./https/cert.pem'),
};

const dispatch = (req, res) => {
  const {
    pathname: path,
    query,
  } = url.parse(req.url, true);

  const trimmedPath = path.replace(/^\/+|\/+$/g, '');

  const method = req.method.toLowerCase();

  const headers = req.headers;

  const decoder = new StringDecoder('utf-8');
  let buffer = '';

  req.on('data', (chunk) => {
    buffer += decoder.write(chunk);
  });

  req.on('end', () => {
    buffer += decoder.end();

    logger.log(
      `Received request: [${
        method
      }] ${
        trimmedPath
      } -> parameters = ${
        helpers.parseObjectToJson(query)
      } -> headers = ${
        helpers.parseObjectToJson(headers)
      } -> payload = ${
        buffer
      }`
    );

    const chosenHandler = typeof(router[trimmedPath]) !== 'undefined'
      ? router[trimmedPath]
      : handlers.notFound;

    const data = {
      trimmedPath,
      query,
      method,
      headers,
      payload: helpers.parseJsonToObject(buffer),
      res,
    };

    chosenHandler(data, (response, payload) => {
      const validatedStatusCode = typeof(response.status) === 'number'
        ? response.status
        : 200;

      const validatedPayload = typeof(payload) === 'object'
        ? payload
        : {};

      const payloadString = helpers.parseObjectToJson(validatedPayload);

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(validatedStatusCode);
      res.end(payloadString);

      logger.log(`Returning this response: ${validatedStatusCode} ${payloadString}`);
    })
  });
};

const httpServer = http.createServer(dispatch);

const httpsServer = https.createServer(httpsServerConfig, dispatch);

const server = {
  start: () => {
    httpServer.listen(httpServerOptions, () => {
      logger.log(`HTTP server listen on ${config.host}:${config.httpPort} in ${config.envName} mode`);
    });

    httpServer.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        logger.warn(`Address ${config.host}:${config.httpPort} already in use`);
      }
    });

    httpsServer.listen(httpsServerOptions, () => {
      logger.log(`HTTPS server listen on ${config.host}:${config.httpsPort} in ${config.envName} mode`);
    });

    httpsServer.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        logger.warn(`Address ${config.host}:${config.httpPort} already in use`);
      }
    })
  },
};

module.exports = server;
