import Hull from "hull";

import bootstrap from "./bootstrap";
import WorkerApp from "./util/app/worker";
import AppMiddleware from "./lib/middleware/app";

const { queueAdapter, instrumentationAgent, shipCache, jobs } = bootstrap;

const hostSecret = process.env.SECRET || "1234";

new WorkerApp({ queueAdapter, instrumentationAgent, jobs })
  .use(Hull.Middleware({ hostSecret, shipCache }))
  .use(AppMiddleware({ queueAdapter, shipCache, instrumentationAgent }))
  .process();

Hull.logger.info("workerApp.process");

function exitNow() {
  console.warn("Exiting now !");
  process.exit(0);
}

function handleExit() {
  console.log("Exiting... waiting 30 seconds workers to flush");
  setTimeout(exitNow, 30000);
  queueAdapter.exit().then(exitNow);
}

process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);
