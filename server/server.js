/* @flow */
import express from "express";
import queueUiRouter from "hull/lib/infra/queue/ui-router";
import cors from "cors";
import { notifHandler, responseMiddleware } from "hull/lib/utils";

import requireConfiguration from "./lib/middleware/require-configuration";
import appMiddleware from "./lib/middleware/app";

import * as actions from "./actions";

export default function server(app: express, deps: Object): express {
  const { queue, hostSecret } = deps;

  app.use(appMiddleware());

  app.post("/fetch-all", requireConfiguration, actions.fetchAll, responseMiddleware());
  app.post("/sync", requireConfiguration, actions.fetch, responseMiddleware());

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
