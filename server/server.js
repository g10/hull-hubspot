// @flow
import type { $Application } from "express";

const queueUiRouter = require("hull/lib/infra/queue/ui-router");
const cors = require("cors");
const { smartNotifierHandler, responseMiddleware } = require("hull/lib/utils");

const notificationsConfiguration = require("./notifications-configuration");
const requireConfiguration = require("./lib/middleware/require-configuration");

const actions = require("./actions");

function server(app: $Application, deps: Object): $Application {
  const { queue, hostSecret } = deps;

  // app.use(appMiddleware());

  app.post(
    "/fetch-all",
    requireConfiguration,
    actions.fetchAll,
    responseMiddleware()
  );
  app.post("/sync", actions.fetch);

  app.use(
    "/batch",
    smartNotifierHandler({
      handlers: notificationsConfiguration
    })
  );

  app.use(
    "/smart-notifier",
    smartNotifierHandler({
      handlers: notificationsConfiguration
    })
    // actions.notify({
    //   type: "next",
    //   size: parseInt(process.env.FLOW_CONTROL_SIZE, 10) || 100,
    //   in: parseInt(process.env.FLOW_CONTROL_IN, 10) || 10,
    //   in_time: parseInt(process.env.FLOW_CONTROL_IN_TIME, 10) || 10
    // })
  );

  app.post(
    "/monitor/checkToken",
    requireConfiguration,
    actions.checkToken,
    responseMiddleware()
  );

  app.all(
    "/schema/contact_properties",
    cors(),
    requireConfiguration,
    actions.getContactProperties,
    responseMiddleware()
  );

  app.all("/status", actions.statusCheck);

  app.use("/auth", actions.oauth(deps));

  if (queue.adapter.app) {
    app.use("/kue", queueUiRouter({ hostSecret, queue }));
  }
  return app;
}

module.exports = server;
