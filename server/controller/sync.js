/* @flow */
import { Request, Response, Next } from "express";

import Users from "./users";

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
    const count = parseInt(process.env.FETCH_CONTACTS_COUNT, 10) || 100;
    const lastFetchAt = ctx.shipApp.hubspotAgent.getLastFetchAt();
    const stopFetchAt = ctx.shipApp.hubspotAgent.getStopFetchAt();
    ctx.client.logger.debug("syncAction.lastFetchAt", { lastFetchAt, stopFetchAt });

    return ctx.helpers.updateSettings({
      last_fetch_at: stopFetchAt
    }).then(() => {
      return SyncStrategy.syncJob(ctx, {
        lastFetchAt,
        stopFetchAt,
        count
      });
    });
  }

  static syncJob(ctx, payload) {
    const { hubspotAgent, syncAgent } = ctx.shipApp;
    const { lastFetchAt, stopFetchAt } = payload;

    const count = payload.count || 100;
    const offset = payload.offset || 0;
    const page = payload.page || 1;
    ctx.metric.value("ship.incoming.fetch.page", page);
    ctx.client.logger.debug("syncJob.getRecentContacts", { lastFetchAt, stopFetchAt, count, offset, page });
    ctx.client.logger.info("fetch.incoming.users", { users: (page * count) });
    return hubspotAgent.getRecentContacts(syncAgent.mapping.getHubspotPropertiesKeys(), lastFetchAt, stopFetchAt, count, offset)
      .then((res) => {
        const info = {
          usersCount: res.body.contacts.length,
          hasMore: res.body["has-more"],
          vidOffset: res.body["vid-offset"]
        };
        if (res.body.contacts.length > 0) {
          return Users.saveContactsJob(ctx, { contacts: res.body.contacts })
            .then(() => info);
        }
        return Promise.resolve(info);
      }).then(({ usersCount, hasMore, vidOffset }) => {
        if (hasMore && usersCount > 0) {
          return SyncStrategy.syncJob(ctx, {
            lastFetchAt, stopFetchAt, count, page: (page + 1), offset: vidOffset
          });
        }
        return Promise.resolve("done");
      });
  }
}
