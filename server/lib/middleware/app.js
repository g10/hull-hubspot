/* @flow */
import type { $Request, $Response, NextFunction } from "express";

const HubspotClient = require("../hubspot-client");
const HubspotAgent = require("../hubspot-agent");
const SyncAgent = require("../sync-agent");
const ProgressAgent = require("../progress-agent");

function middlewareFactory() {
  return function middleware(req: $Request, res: $Response, next: NextFunction) {
    req.hull.shipApp = req.hull.shipApp || {};

    if (!req.hull || !req.hull.ship) {
      return next();
    }
    const hubspotClient = new HubspotClient(req.hull);
    const hubspotAgent = new HubspotAgent(req.hull.client, hubspotClient, req.hull.ship, req.hull.metric, req.hull.helpers);
    const syncAgent = new SyncAgent(hubspotAgent, req.hull);
    const progressAgent = new ProgressAgent(req.hull);

    req.hull.shipApp = {
      hubspotClient,
      hubspotAgent,
      syncAgent,
      progressAgent
    };

    return next();
  };
}

module.exports = middlewareFactory;
