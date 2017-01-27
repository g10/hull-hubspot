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
    const count = 1;
    const lastFetchAt = req.shipApp.hubspotAgent.getLastFetchAt();
    req.hull.client.logger.info("syncAction.lastFetchAt", lastFetchAt);
    return req.shipApp.queueAgent.create("syncJob", {
      lastFetchAt,
      count
    })
    .then(() => req.shipApp.hubspotAgent.setLastFetchAt());
  }

  syncJob(req) {
    const lastFetchAt = req.payload.lastFetchAt;
    const count = req.payload.count || 100;
    const offset = req.payload.offset || 0;
    const page = req.payload.page || 1;
    req.shipApp.instrumentationAgent.metricVal("ship.incoming.fetch.page", page, req.hull.client.configuration());
    req.hull.client.logger.info("syncJob.getRecentContacts", { lastFetchAt, count, offset, page });
    return req.shipApp.hubspotAgent.getRecentContacts(lastFetchAt, count, offset)
      .then((res) => {
        const promises = [];
        if (res.body["has-more"] && res.body.contacts.length > 0) {
          promises.push(req.shipApp.queueAgent.create("syncJob", {
            lastFetchAt, count, page: (page + 1), offset: res.body["vid-offset"]
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
