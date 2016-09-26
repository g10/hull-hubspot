import Hull from "hull";
import raven from "raven";

import BatchSyncHandler from "./lib/batch-sync-handler";
import WebApp from "./app/web-app";
import WebAppRouter from "./router/web-app-router";
import WebStaticRouter from "./router/web-static-router";
import WebOauthRouter from "./router/web-oauth-router";
import bootstrap from "./bootstrap";

const { queueAdapter, controllers, instrumentationAgent } = bootstrap;

const hostSecret = process.env.SECRET || "1234";
const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const port = process.env.PORT || 8082;

const app = WebApp();

if (instrumentationAgent.raven) {
  app.use(raven.middleware.express.requestHandler(instrumentationAgent.raven));
}

app.use("/", WebAppRouter({ ...controllers, Hull, hostSecret, queueAdapter }))
  .use("/", WebStaticRouter({ Hull }))
  .use("/", WebOauthRouter({ Hull, hostSecret, clientID, clientSecret }));

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
