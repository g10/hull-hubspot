import Hull from "hull";
import raven from "raven";

import bootstrap from "./bootstrap";
import BatchSyncHandler from "./util/handler/batch-sync";
import WebApp from "./app/web-app";
import WebAppRouter from "./router/web-app-router";
import WebOauthRouter from "./router/web-oauth-router";
import WebStaticRouter from "./util/router/static";
import WebKueRouter from "./util/router/kue";

const { queueAdapter, controllers, instrumentationAgent, shipCache } = bootstrap;

const hostSecret = process.env.SECRET || "1234";
const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const port = process.env.PORT || 8082;

if (process.env.COMBINED) {
  require("./worker"); // eslint-disable-line global-require
}

const app = WebApp();

if (instrumentationAgent.raven) {
  app.use(raven.middleware.express.requestHandler(instrumentationAgent.raven));
}

app.use("/", WebAppRouter({ ...controllers, Hull, hostSecret, queueAdapter, shipCache, instrumentationAgent }))
  .use("/", WebStaticRouter({ Hull }))
  .use("/", WebOauthRouter({ Hull, hostSecret, clientID, clientSecret, shipCache, instrumentationAgent }))
  .use("/kue", WebKueRouter({ shipConfig: { hostSecret }, queueAdapter }));

if (instrumentationAgent.raven) {
  app.use(raven.middleware.express.errorHandler(instrumentationAgent.raven));
}

app.listen(port, () => {
  Hull.logger.info("webApp.listen", port);
});

function exitNow() {
  console.warn("Exiting now !");
  process.exit(0);
}

function handleExit() {
  console.log("Exiting... waiting 30 seconds workers to flush");
  setTimeout(exitNow, 30000);
  BatchSyncHandler.exit()
    .then(exitNow);
}

process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);
