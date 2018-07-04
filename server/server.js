// @flow
import type { $Application } from "express";

const cors = require("cors");
const { notificationHandler, batchHandler } = require("hull").handlers;
const {
  credsFromQueryFullBody,
  credsFromQueryFullFetch
} = require("hull").utils;

const notificationsConfiguration = require("./notifications-configuration");

const actions = require("./actions");

function server(app: $Application, deps: Object): $Application {
  app.post("/fetch-all", ...credsFromQueryFullBody(), actions.fetchAll);
  app.post("/sync", ...credsFromQueryFullBody(), actions.fetch);

  app.use("/batch", batchHandler(notificationsConfiguration));

  app.use("/smart-notifier", notificationHandler(notificationsConfiguration));

  app.post(
    "/monitor/checkToken",
    ...credsFromQueryFullBody(),
    actions.checkToken
  );

  app.all(
    "/schema/contact_properties",
    ...credsFromQueryFullFetch(),
    cors(),
    actions.getContactProperties
  );

  app.all("/status", ...credsFromQueryFullFetch(), actions.statusCheck);

  app.use("/auth", actions.oauth(deps));

  return app;
}

module.exports = server;
