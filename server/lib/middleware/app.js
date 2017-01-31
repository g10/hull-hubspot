import HubspotClient from "../hubspot-client";
import HullAgent from "../../util/hull-agent";
import HubspotAgent from "../hubspot-agent";
import QueueAgent from "../../util/queue/queue-agent";
import SyncAgent from "../sync-agent";
import ProgressAgent from "../progress-agent";

export default function ({ queueAdapter, shipCache, instrumentationAgent }) {
  return function middleware(req, res, next) {
    req.shipApp = req.shipApp || {};

    if (!req.hull || !req.hull.ship) {
      return next();
    }
// req.shipApp.mapping = new Mapping(req.hull.ship);

    const hubspotClient = new HubspotClient({ ship: req.hull.ship, hullClient: req.hull.client, instrumentationAgent });
    const hullAgent = new HullAgent(req.hull.ship, req.hull.client, req.query, req.hostname, shipCache);
    const hubspotAgent = new HubspotAgent(hullAgent, req.hull.client, hubspotClient, req.hull.ship, instrumentationAgent);
    const syncAgent = new SyncAgent(hullAgent, hubspotAgent, req.hull.ship, instrumentationAgent);
    const queueAgent = new QueueAgent(queueAdapter, req);
    const progressAgent = new ProgressAgent(hullAgent, req.hull.client);

    req.shipApp = {
      hubspotClient,
      hullAgent,
      hubspotAgent,
      syncAgent,
      queueAgent,
      progressAgent,
      shipCache,
      instrumentationAgent
    };

    return next();
  };
}
