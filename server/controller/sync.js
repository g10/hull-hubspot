/* @flow */
import { Request, Response, Next } from "express";
import _ from "lodash";

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
    let lastModifiedDate;
    ctx.client.logger.debug("syncAction.lastFetchAt", { lastFetchAt, stopFetchAt });

    return ctx.helpers.updateSettings({
      last_fetch_at: stopFetchAt
    }).then(() => {
      return SyncStrategy.syncJob(ctx, {
        lastFetchAt,
        stopFetchAt,
        count,
        lastModifiedDate
      });
    });
  }

  static syncJob(ctx, payload) {
    const { hubspotAgent, syncAgent } = ctx.shipApp;
    const { lastFetchAt, stopFetchAt } = payload;
    let { lastModifiedDate } = payload;

    const count = payload.count || 100;
    const offset = payload.offset || 0;
    const page = payload.page || 1;
    ctx.metric.value("ship.incoming.fetch.page", page);
    ctx.client.logger.debug("syncJob.getRecentContacts", { lastFetchAt, stopFetchAt, count, offset, page });
    ctx.client.logger.info("fetch.users.progress", { users: (page * count) });
    return hubspotAgent.getRecentContacts(syncAgent.mapping.getHubspotPropertiesKeys(), lastFetchAt, stopFetchAt, count, offset)
      .then((res) => {
        const info = {
          usersCount: res.body.contacts.length,
          hasMore: res.body["has-more"],
          vidOffset: res.body["vid-offset"]
        };
        if (res.body.contacts.length > 0) {
          lastModifiedDate = _(res.body.contacts)
            .map(c => _.get(c, "properties.lastmodifieddate.value"))
            .uniq()
            .nth(-2);

          if (res.body["vid-offset"] === res.body.contacts[0].vid) {
            ctx.client.logger.warn("fetch.users.warning", { warning: "vidOffset moved to the top of the recent contacts list" });
            // TODO: call the `syncJob` with timeOffset instead of the vidOffset
          }
          return Users.saveContactsJob(ctx, { contacts: res.body.contacts })
            .then(() => info);
        }
        return Promise.resolve(info);
      }).then(({ usersCount, hasMore, vidOffset }) => {
        if (hasMore && usersCount > 0) {
          return SyncStrategy.syncJob(ctx, {
            lastFetchAt, stopFetchAt, count, page: (page + 1), offset: vidOffset, lastModifiedDate
          });
        }
        return Promise.resolve("done");
      });
  }
}
