/* @flow */
import { Connector } from "hull";

import AppMiddleware from "./lib/middleware/app";

import BatchController from "./controller/batch";
import MonitorController from "./controller/monitor";
import UsersController from "./controller/users";
import FetchAllController from "./controller/fetch-all";
import SyncController from "./controller/sync";
import * as newJobs from "./jobs";

export default function workerJobs(connector: Connector) {
  const jobs = {
    handleBatchExtractJob: BatchController.handleBatchExtractJob,
    fetchAllJob: FetchAllController.fetchAllJob,
    saveContactsJob: UsersController.saveContactsJob,
    sendUsersJob: UsersController.sendUsersJob,
    syncJob: SyncController.syncJob,
    startSyncJob: SyncController.startSyncJob,
    checkTokenJob: MonitorController.checkTokenJob,
    ...newJobs
  };

  connector.worker(jobs)
    .use(AppMiddleware());

  return connector;
}
