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
    return req.shipApp.hubspotAgent.getLastUpdate()
      .then((lastImportTime) => {
        req.hull.client.logger.info("syncAction.lastImportTime", lastImportTime);
        return req.shipApp.queueAgent.create("syncJob", {
          lastImportTime,
          count
        });
      });
  }

  syncJob(req) {
    const { hubspotAgent, syncAgent } = req.shipApp;
    const lastImportTime = req.payload.lastImportTime;
    const count = req.payload.count || 100;
    const offset = req.payload.offset || 0;
    req.hull.client.logger.info("syncJob.getRecentContacts", { lastImportTime, count, offset });
    return hubspotAgent.getRecentContacts(syncAgent.mapping.getHubspotPropertiesKeys(), lastImportTime, count, offset)
      .then((res) => {
        const promises = [];

        if (res.body["has-more"] && res.body.contacts.length > 0) {
          promises.push(req.shipApp.queueAgent.create("syncJob", {
            lastImportTime, count, offset: res.body["vid-offset"]
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
