/* @flow */
import express from "express";
import queueUiRouter from "hull/lib/infra/queue/ui-router";

import WebAppRouter from "./router/web-app-router";
import WebOauthRouter from "./router/web-oauth-router";

import BatchController from "./controller/batch";
import MonitorController from "./controller/monitor";
import UsersController from "./controller/users";
import FetchAllController from "./controller/fetch-all";
import SyncController from "./controller/sync";
import NotifyController from "./controller/notify";


const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const hostSecret = process.env.SECRET;

export default function server(app: express, { queue }: Object): express {
  const controllers = {
    batchController: BatchController,
    monitorController: MonitorController,
    fetchAllController: FetchAllController,
    usersController: UsersController,
    notifyController: NotifyController,
    syncController: SyncController
  };

  app.use("/", WebAppRouter({ ...controllers }))
    .use("/", WebOauthRouter({ clientID, clientSecret }));

  app.use("/kue", queueUiRouter({ hostSecret, queue }));
  return app;
}
