/**
 * Handles operation for automatic sync changes of hubspot profiles
 * to hull users.
 */
export default class SyncStrategy {

  syncAction(req, res, next) {
    return req.shipApp.queueAgent.create("startSyncJob")
      .then(next, next);
  }

  startSyncJob(req) {
    const count = 100;
    const lastFetchAt = req.shipApp.hubspotAgent.getLastFetchAt();
    const stopFetchAt = req.shipApp.hubspotAgent.getStopFetchAt();
    req.hull.client.logger.info("syncAction.lastFetchAt", lastFetchAt);
    return req.shipApp.queueAgent.create("syncJob", {
      lastFetchAt,
      stopFetchAt,
      count
    })
    .then(() => req.shipApp.hullAgent.updateShipSettings({
      last_fetch_at: stopFetchAt
    }));
  }

  syncJob(req) {
    const { hubspotAgent, syncAgent } = req.shipApp;
    const { lastFetchAt, stopFetchAt } = req.payload;

    const count = req.payload.count || 100;
    const offset = req.payload.offset || 0;
    const page = req.payload.page || 1;
    req.shipApp.instrumentationAgent.metricVal("ship.incoming.fetch.page", page, req.hull.client.configuration());
    req.hull.client.logger.debug("syncJob.getRecentContacts", { lastFetchAt, stopFetchAt, count, offset, page });
    return hubspotAgent.getRecentContacts(syncAgent.mapping.getHubspotPropertiesKeys(), lastFetchAt, stopFetchAt, count, offset)
      .then((res) => {
        const promises = [];
        if (res.body["has-more"] && res.body.contacts.length > 0) {
          promises.push(req.shipApp.queueAgent.create("syncJob", {
            lastFetchAt, stopFetchAt, count, page: (page + 1), offset: res.body["vid-offset"]
          }));
        }

        if (res.body.contacts.length > 0) {
          promises.push(req.shipApp.queueAgent.create("saveContactsJob", {
            contacts: res.body.contacts
          }));
        }

        return Promise.all(promises);
      });
  }
}
