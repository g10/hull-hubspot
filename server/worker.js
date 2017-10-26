/* @flow */
import { Connector } from "hull";

import appMiddleware from "./lib/middleware/app";

import * as jobs from "./jobs";

export default function workerJobs(connector: Connector) {
  connector.worker(jobs)
    .use(appMiddleware());

  return connector;
}
