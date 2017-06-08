const Connector = require("hull").Connector;
const express = require("express");

const server = require("../server/server").default;
const worker = require("../server/worker").default;

module.exports = function bootstrap() {
  const app = express();
  const connector = new Connector({ hostSecret: "1234", port: 8000, clientConfig: { protocol: "http" } });
  connector.setupApp(app);
  server(app, { queue: connector.queue });
  worker(connector);

  connector.startWorker();
  return connector.startApp(app);
};

