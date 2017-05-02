/* @flow */
import { helpersMiddleware } from "hull/lib/utils";

import AppMiddleware from "./lib/middleware/app";

module.exports = function workerJobs(options: any = {}) {
  const { connector, jobs } = options;
  connector.worker(jobs)
    .use(helpersMiddleware()) // workaround over bug in hull-node
    .use(AppMiddleware());

  connector.startWorker();
};
