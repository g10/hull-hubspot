/* @flow */
const express = require("express");
const queueUiRouter = require("hull/lib/infra/queue/ui-router");
const cors = require("cors");
const { notifHandler, responseMiddleware } = require("hull/lib/utils");

const requireConfiguration = require("./lib/middleware/require-configuration");
const appMiddleware = require("./lib/middleware/app");

const actions = require("./actions");

function server(app: express, deps: Object): express {
  const { queue, hostSecret } = deps;

  app.use(appMiddleware());

  app.post("/fetch-all", requireConfiguration, actions.fetchAll, responseMiddleware());
  app.post("/sync", requireConfiguration, actions.fetch);

  app.use("/batch", requireConfiguration, notifHandler({
    handlers: {
      "user:update": actions.handleBatch,
    }
  }));

  app.use("/notify", actions.notify());

  app.use("/smart-notifier", actions.notify({
    type: "next",
    size: parseInt(process.env.FLOW_CONTROL_SIZE, 10) || 100,
    in: parseInt(process.env.FLOW_CONTROL_IN, 10) || 10,
    in_time: parseInt(process.env.FLOW_CONTROL_IN_TIME, 10) || 10
  }));

  app.post("/monitor/checkToken", requireConfiguration, actions.checkToken, responseMiddleware());

  app.all("/schema/contact_properties", cors(), requireConfiguration, actions.getContactProperties, responseMiddleware());

  app.post("/migrate", requireConfiguration, (req, res, next) => {
    req.shipApp.syncAgent.migrateSettings().then(next, next);
  }, responseMiddleware());

  app.all("/status", actions.statusCheck);

  app.use("/auth", actions.oauth(deps));

  if (queue.adapter.app) {
    app.use("/kue", queueUiRouter({ hostSecret, queue }));
  }
  return app;
}

module.exports = server;
