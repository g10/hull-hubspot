// @flow
import type { $Application } from "express";

const cors = require("cors");
const { smartNotifierHandler } = require("hull/lib/utils");

const notificationsConfiguration = require("./notifications-configuration");

const actions = require("./actions");

function server(app: $Application, deps: Object): $Application {
  // app.use(appMiddleware());

  app.post("/fetch-all", actions.fetchAll);
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
  );

  app.post("/monitor/checkToken", actions.checkToken);

  app.all("/schema/contact_properties", cors(), actions.getContactProperties);

  app.all("/status", actions.statusCheck);

  app.use("/auth", actions.oauth(deps));

  return app;
}

module.exports = server;
