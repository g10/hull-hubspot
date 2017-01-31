import CacheManager from "cache-manager";
import Hull from "hull";

import BatchController from "./controller/batch";
import MonitorController from "./controller/monitor";
import UsersController from "./controller/users";
import FetchAllController from "./controller/fetch-all";
import SyncController from "./controller/sync";
import NotifyController from "./controller/notify";

import InstrumentationAgent from "./util/instrumentation-agent";
import KueAdapter from "./util/queue/adapter/kue";

if (process.env.LOG_LEVEL) {
  Hull.logger.transports.console.level = process.env.LOG_LEVEL;
}

const instrumentationAgent = new InstrumentationAgent();

const queueAdapter = new KueAdapter(({
  prefix: process.env.KUE_PREFIX || "hull-hubspot",
  redis: process.env.REDIS_URL
}));

const cacheManager = CacheManager.caching({
  store: "memory",
  max: process.env.SHIP_CACHE_MAX || 100,
  ttl: process.env.SHIP_CACHE_TTL || 60
});

const shipCache = new Hull.ShipCache(cacheManager, process.env.SHIP_CACHE_PREFIX || "hull-hubspot");

const controllers = {
  batchController: new BatchController(),
  monitorController: new MonitorController(),
  fetchAllController: new FetchAllController(),
  usersController: new UsersController(),
  notifyController: new NotifyController(),
  syncController: new SyncController()
};

// FIXME: change to job per file arch
const jobs = {
  handleBatchExtractJob: controllers.batchController.handleBatchExtractJob.bind(controllers.batchController),
  fetchAllJob: controllers.fetchAllController.fetchAllJob.bind(controllers.fetchAllController),
  saveContactsJob: controllers.usersController.saveContactsJob.bind(controllers.usersController),
  sendUsersJob: controllers.usersController.sendUsersJob.bind(controllers.usersController),
  syncJob: controllers.syncController.syncJob.bind(controllers.syncController),
  startSyncJob: controllers.syncController.startSyncJob.bind(controllers.syncController),
  checkTokenJob: controllers.monitorController.checkTokenJob.bind(controllers.monitorController),
};

export default { queueAdapter, controllers, instrumentationAgent, shipCache, jobs };
