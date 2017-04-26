import Hull from "hull";
import { Cache, Queue } from "hull/lib/infra";

import BatchController from "./controller/batch";
import MonitorController from "./controller/monitor";
import UsersController from "./controller/users";
import FetchAllController from "./controller/fetch-all";
import SyncController from "./controller/sync";
import NotifyController from "./controller/notify";
import * as newJobs from "./jobs";

const { LOG_LEVEL, SHIP_CACHE_MAX = 100, SHIP_CACHE_TTL = 60, KUE_PREFIX = "hull-hubspot", REDIS_URL = "127.0.0.1", SECRET = "1234", PORT = 8082 } = process.env;

if (LOG_LEVEL) {
  Hull.logger.transports.console.level = LOG_LEVEL;
}

Hull.logger.transports.console.json = true;

const cache = new Cache({
  store: "memory",
  max: SHIP_CACHE_MAX,
  ttl: SHIP_CACHE_TTL
});

const queue = new Queue("kue", {
  prefix: KUE_PREFIX,
  redis: {
    host: REDIS_URL
  }

});

const connector = new Hull.Connector({ cache, queue, hostSecret: SECRET, port: PORT });

const controllers = {
  batchController: new BatchController(),
  monitorController: new MonitorController(),
  fetchAllController: new FetchAllController(),
  usersController: new UsersController(),
  notifyController: new NotifyController(),
  syncController: new SyncController()
};

const jobs = {
  handleBatchExtractJob: controllers.batchController.handleBatchExtractJob,
  fetchAllJob: controllers.fetchAllController.fetchAllJob,
  saveContactsJob: controllers.usersController.saveContactsJob,
  sendUsersJob: controllers.usersController.sendUsersJob,
  syncJob: controllers.syncController.syncJob,
  startSyncJob: controllers.syncController.startSyncJob,
  checkTokenJob: controllers.monitorController.checkTokenJob,
  ...newJobs
};

export default { connector, controllers, jobs, queue, cache };
