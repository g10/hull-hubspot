/* @flow */
import { Connector } from "hull";

import AppMiddleware from "./lib/middleware/app";

import MonitorController from "./controller/monitor";
import UsersController from "./controller/users";
import FetchAllController from "./controller/fetch-all";
import SyncController from "./controller/sync";
import * as newJobs from "./jobs";

export default function workerJobs(connector: Connector) {
  let jobs = {
    fetchAllJob: FetchAllController.fetchAllJob,
    saveContactsJob: UsersController.saveContactsJob,
    sendUsersJob: UsersController.sendUsersJob,
    syncJob: SyncController.syncJob,
    startSyncJob: SyncController.startSyncJob,
    checkTokenJob: MonitorController.checkTokenJob,
    ...newJobs
  };

  if (process.env.EXCLUDE_FETCH_JOBS) {
    delete jobs.fetchAllJob;
  }

  if (process.env.FETCH_JOBS_ONLY) {
    jobs = {
      fetchAllJob: FetchAllController.fetchAllJob,
    };
  }

  connector.worker(jobs)
    .use(AppMiddleware());

  return connector;
}
