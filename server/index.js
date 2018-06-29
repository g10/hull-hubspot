/* @flow */
const Hull = require("hull");
const { Cache } = require("hull/lib/infra");
const express = require("express");
const redisStore = require("cache-manager-redis");

const server = require("./server");

const {
  LOG_LEVEL,
  SHIP_CACHE_TTL = 180,
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

const app = express();
const connector = new Hull.Connector({
  cache,
  hostSecret: SECRET,
  port: PORT,
  clientConfig: {
    firehoseUrl: OVERRIDE_FIREHOSE_URL
  }
});

const deps = {
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  hostSecret: SECRET
};

connector.setupApp(app);

if (process.env.SERVER || process.env.COMBINED) {
  server(app, deps);
  connector.startApp(app);
}
