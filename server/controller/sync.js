/* @flow */
import { Request, Response, Next } from "express";

/**
 * Handles operation for automatic sync changes of hubspot profiles
 * to hull users.
 */
export default class SyncStrategy {

  static syncAction(req: Request, res: Response, next: Next) {
    return req.hull.enqueue("startSyncJob")
      .then(next, next);
  }

  static startSyncJob(ctx) {
    const count = 100;
    const lastFetchAt = ctx.shipApp.hubspotAgent.getLastFetchAt();
    const stopFetchAt = ctx.shipApp.hubspotAgent.getStopFetchAt();
    ctx.client.logger.info("syncAction.lastFetchAt", lastFetchAt);
    return ctx.enqueue("syncJob", {
      lastFetchAt,
      stopFetchAt,
      count
    })
    .then(() => ctx.helpers.updateSettings({
      last_fetch_at: stopFetchAt
    }));
  }

  static syncJob(ctx, payload) {
    const { hubspotAgent, syncAgent } = ctx.shipApp;
    const { lastFetchAt, stopFetchAt } = payload.lastFetchAt;

    const count = payload.count || 100;
    const offset = payload.offset || 0;
    const page = payload.page || 1;
    ctx.metric.value("ship.incoming.fetch.page", page);
    ctx.client.logger.info("syncJob.getRecentContacts", { lastFetchAt, stopFetchAt, count, offset, page });
    return hubspotAgent.getRecentContacts(syncAgent.mapping.getHubspotPropertiesKeys(), lastFetchAt, stopFetchAt, count, offset)
      .then((res) => {
        const promises = [];
        if (res.body["has-more"] && res.body.contacts.length > 0) {
          promises.push(ctx.enqueue("syncJob", {
            lastFetchAt, stopFetchAt, count, page: (page + 1), offset: res.body["vid-offset"]
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
