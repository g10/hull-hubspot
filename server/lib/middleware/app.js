import HubspotClient from "../hubspot-client";
import HubspotAgent from "../hubspot-agent";
import SyncAgent from "../sync-agent";
import ProgressAgent from "../progress-agent";

export default function () {
  return function middleware(req, res, next) {
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
