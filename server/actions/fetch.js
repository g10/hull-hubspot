/* @flow */
const { Request, Response } = require("express");
const _ = require("lodash");

function fetchPage(ctx, payload) {
  const { hubspotAgent, syncAgent } = ctx.shipApp;
  const { lastFetchAt, stopFetchAt } = payload;
  let { lastModifiedDate } = payload;

  const count = payload.count || 100;
  const offset = payload.offset || 0;
  const page = payload.page || 1;
  ctx.metric.value("ship.incoming.fetch.page", page);
  ctx.client.logger.debug("syncJob.getRecentContacts", {
    lastFetchAt,
    stopFetchAt,
    count,
    offset,
    page
  });
  ctx.client.logger.info("incoming.job.progress", {
    jobName: "fetch",
    progress: page * count,
    stepName: "sync-recent-contacts"
  });
  return hubspotAgent
    .getRecentContacts(
      syncAgent.mapping.getHubspotPropertiesKeys(),
      lastFetchAt,
      stopFetchAt,
      count,
      offset
    )
    .then(res => {
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
          ctx.client.logger.warn("incoming.job.warning", {
            jobName: "fetch",
            warnings: "vidOffset moved to the top of the recent contacts list"
          });
          // TODO: call the `syncJob` with timeOffset instead of the vidOffset
        }
        return ctx.shipApp.syncAgent
          .saveContacts(res.body.contacts)
          .then(() => info);
      }
      return Promise.resolve(info);
    })
    .then(({ usersCount, hasMore, vidOffset }) => {
      if (hasMore && usersCount > 0) {
        return fetchPage(ctx, {
          lastFetchAt,
          stopFetchAt,
          count,
          page: page + 1,
          offset: vidOffset,
          lastModifiedDate
        });
      }
      ctx.client.logger.info("incoming.job.success", { jobName: "fetch" });
      return Promise.resolve("done");
    });
}

/**
 * Handles operation for automatic sync changes of hubspot profiles
 * to hull users.
 */
function fetchAction(req: Request, res: Response) {
  const ctx = req.hull;
  const count = parseInt(process.env.FETCH_CONTACTS_COUNT, 10) || 100;
  const lastFetchAt = ctx.shipApp.hubspotAgent.getLastFetchAt();
  const stopFetchAt = ctx.shipApp.hubspotAgent.getStopFetchAt();
  let lastModifiedDate;
  ctx.client.logger.debug("syncAction.lastFetchAt", {
    lastFetchAt,
    stopFetchAt
  });
  ctx.client.logger.info("incoming.job.start", {
    jobName: "fetch",
    type: "user",
    lastFetchAt,
    stopFetchAt
  });

  res.json({ ok: true });

  return ctx.helpers
    .updateSettings({
      last_fetch_at: stopFetchAt
    })
    .then(() => {
      return fetchPage(ctx, {
        lastFetchAt,
        stopFetchAt,
        count,
        lastModifiedDate
      });
    })
    .catch(error => {
      ctx.client.logger.info("incoming.job.error", { jobName: "fetch", error });
    });
}

module.exports = fetchAction;
