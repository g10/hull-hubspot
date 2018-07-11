// @flow
import type { $Application } from "express";

const cors = require("cors");
const { notificationHandler, batchHandler } = require("hull").handlers;
const { credsFromQueryMiddlewares } = require("hull").utils;

const notificationsConfiguration = require("./notifications-configuration");

const actions = require("./actions");

function server(app: $Application, deps: Object): $Application {
  app.post("/fetch-all", ...credsFromQueryMiddlewares(), actions.fetchAll);
  app.post("/sync", ...credsFromQueryMiddlewares(), actions.fetch);

  app.use("/batch", batchHandler(notificationsConfiguration));

  app.use("/smart-notifier", notificationHandler(notificationsConfiguration));

  app.post(
    "/monitor/checkToken",
    ...credsFromQueryMiddlewares(),
    actions.checkToken
  );

  app.all(
    "/schema/contact_properties",
    ...credsFromQueryMiddlewares(),
    cors(),
    actions.getContactProperties
  );

  app.all("/status", ...credsFromQueryMiddlewares(), actions.statusCheck);

  app.use("/auth", actions.oauth(deps));

  return app;
}

module.exports = server;
