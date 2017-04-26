/**
 * Handles operation for automatic sync changes of hubspot profiles
 * to hull users.
 */
export default class SyncStrategy {

  static syncAction(req, res, next) {
    return req.hull.enqueue("startSyncJob")
      .then(next, next);
  }

  static startSyncJob(ctx) {
    const count = 100;
    const lastFetchAt = ctx.shipApp.hubspotAgent.getLastFetchAt();
    ctx.client.logger.info("syncAction.lastFetchAt", lastFetchAt);
    return ctx.enqueue("syncJob", {
      lastFetchAt,
      count
    })
      .then(() => ctx.shipApp.hubspotAgent.setLastFetchAt());
  }

  static syncJob(ctx, payload) {
    const { hubspotAgent, syncAgent } = ctx.shipApp;
    const lastFetchAt = payload.lastFetchAt;
    const count = payload.count || 100;
    const offset = payload.offset || 0;
    const page = payload.page || 1;
    ctx.metric.value("ship.incoming.fetch.page", page);
    ctx.client.logger.info("syncJob.getRecentContacts", { lastFetchAt, count, offset, page });
    return hubspotAgent.getRecentContacts(syncAgent.mapping.getHubspotPropertiesKeys(), lastFetchAt, count, offset)
      .then((res) => {
        const promises = [];
        if (res.body["has-more"] && res.body.contacts.length > 0) {
          promises.push(ctx.enqueue("syncJob", {
            lastFetchAt, count, page: (page + 1), offset: res.body["vid-offset"]
          }));
        }

        if (res.body.contacts.length > 0) {
          promises.push(ctx.enqueue("saveContactsJob", {
            contacts: res.body.contacts
          }));
        }

        return Promise.all(promises);
      });
  }

}
