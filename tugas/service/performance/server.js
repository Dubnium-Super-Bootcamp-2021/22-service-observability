const { createServer } = require('http');
const url = require('url');
const { stdout } = require('process');
const { summarySvc } = require('./performance.service');
const agg = require('./performance.agg');
const { config } = require('../config');
const { createTracer } = require('../lib/tracer');
const { createNodeLogger } = require('../lib/logger');

const logger = createNodeLogger('info', 'Performance Service');


let server;

function run(callback) {
  const tracer = createTracer('performance service');
  server = createServer((req, res) => {
    // cors
    const aborted = cors(req, res);
    if (aborted) {
      return;
    }

    function respond(statusCode, message) {
      res.statusCode = statusCode || 200;
      res.write(message || '');
      res.end();
    }

    try {
      const uri = url.parse(req.url, true);
      switch (uri.pathname) {
        case '/summary':
          if (req.method === 'GET') {
            return summarySvc(req, res, tracer);
          } else {
            logger.error('page not found');
            respond(404);
          }
          break;
        default:
          logger.error('page not found');
          respond(404);
      }
    } catch (err) {
      logger.error('unkown server error');
      respond(500, 'unkown server error');
    }
  });

  // run aggregation
  agg.run();

  // stop handler
  server.on('close', () => {
    agg.stop();
    if (callback) {
      callback();
    }
  });

  // run server
  const PORT = config.server?.port.performance;
  server.listen(PORT, () => {
    stdout.write(`🚀 performance service listening on port ${PORT}\n`);
  });
}

function cors(req, res) {
  // handle preflight request
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }
}

function stop() {
  if (server) {
    server.close();
  }
}

module.exports = {
  run,
  stop,
  cors,
};
