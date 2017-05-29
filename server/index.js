/* @flow */
import Hull from "hull";
import { Cache, Queue } from "hull/lib/infra";
import express from "express";
import redisStore from "cache-manager-redis";

import server from "./server";
import worker from "./worker";

const {
  LOG_LEVEL,
  SHIP_CACHE_TTL = 180,
  KUE_PREFIX = "hull-hubspot",
  REDIS_URL = "127.0.0.1",
  CACHE_REDIS_URL = "127.0.0.1",
  SECRET = "1234",
  PORT = 8082
} = process.env;

if (LOG_LEVEL) {
  Hull.logger.transports.console.level = LOG_LEVEL;
}

const cache = new Cache({
  store: redisStore,
  url: CACHE_REDIS_URL,
  ttl: SHIP_CACHE_TTL
});

const queue = new Queue("kue", {
  prefix: KUE_PREFIX,
  redis: REDIS_URL
});

const app = express();
const connector = new Hull.Connector({ cache, queue, hostSecret: SECRET, port: PORT });

connector.setupApp(app);

if (process.env.SERVER || process.env.COMBINED) {
  server(app, { queue });
  connector.startApp(app);
}

if (process.env.WORKER || process.env.COMBINED) {
  worker(connector);
  connector.startWorker();
}

