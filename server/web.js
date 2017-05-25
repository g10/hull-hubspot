/* @flow */
import express from "express";

import WorkerJobs from "./worker-jobs";
import bootstrap from "./bootstrap";
import WebAppRouter from "./router/web-app-router";
import WebOauthRouter from "./router/web-oauth-router";
import WebKueRouter from "./router/kue";

const { connector, controllers, queue } = bootstrap;

const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

if (process.env.COMBINED) {
  WorkerJobs(bootstrap);
}

const app = express();

connector.setupApp(app);

app.use("/", WebAppRouter({ ...controllers }))
  .use("/", WebOauthRouter({ clientID, clientSecret }))
  .use("/kue", WebKueRouter({ hostSecret: process.env.SECRET }, queue));

connector.startApp(app);
