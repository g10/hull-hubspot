/* @flow */
const { Connector } = require("hull");

const appMiddleware = require("./lib/middleware/app");

const jobs = require("./jobs");

function workerJobs(connector: Connector) {
  connector.worker(jobs).use(appMiddleware());

  return connector;
}

module.exports = workerJobs;
