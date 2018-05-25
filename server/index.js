/* @flow */
const Hull = require("hull");
const { Cache, Queue } = require("hull/lib/infra");
const KueAdapter = require("hull/lib/infra/queue/adapter/kue");
const express = require("express");
const redisStore = require("cache-manager-redis");

const server = require("./server");
const worker = require("./worker");

const {
  LOG_LEVEL,
  SHIP_CACHE_TTL = 180,
  KUE_PREFIX = "hull-hubspot",
  REDIS_URL = "127.0.0.1",
  CACHE_REDIS_URL = "127.0.0.1",
  SECRET = "1234",
  PORT = 8082,
  OVERRIDE_FIREHOSE_URL
} = process.env;

if (LOG_LEVEL) {
  Hull.logger.transports.console.level = LOG_LEVEL;
}

const cache = new Cache({
  store: redisStore,
  url: CACHE_REDIS_URL,
  ttl: SHIP_CACHE_TTL
});

const kueAdapter = new KueAdapter({
  prefix: KUE_PREFIX,
  redis: REDIS_URL
});
const queue = new Queue(kueAdapter);

const app = express();
const connector = new Hull.Connector({
  cache,
  queue,
  hostSecret: SECRET,
  port: PORT,
  clientConfig: {
    firehoseUrl: OVERRIDE_FIREHOSE_URL
  }
});

const deps = {
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  queue,
  hostSecret: SECRET
};

connector.setupApp(app);

if (process.env.SERVER || process.env.COMBINED) {
  server(app, deps);
  connector.startApp(app);
}

if (process.env.WORKER || process.env.COMBINED) {
  worker(connector);
  connector.startWorker();
  connector.startWorker("fetch");
}
