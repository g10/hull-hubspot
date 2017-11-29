import Promise from "bluebird";

/**
 * Job which performs fetchAll operations queues itself and the import job
 * @param  {Number} count
 * @param  {Number} [offset=0]
 * @return {Promise}
 */
function fetchAllPage(ctx, payload) {
  const { hubspotAgent, syncAgent } = ctx.shipApp;
  const count = payload.count;
  const offset = payload.offset || 0;
  const progress = payload.progress || 0;

  ctx.client.logger.info("incoming.job.start", { jobName: "fetch-all", type: "user" });
  // TODO: pick up from job progress previous offset
  return hubspotAgent.getContacts(syncAgent.mapping.getHubspotPropertiesKeys(), count, offset)
    .then((data) => {
      const newProgress = progress + data.body.contacts.length;
      const info = {
        hasMore: data.body["has-more"],
        vidOffset: data.body["vid-offset"],
        newProgress
      };
      // TODO: save offset to job progress
      ctx.client.logger.info("incoming.job.progress", { jobName: "fetch-all", progress: newProgress, stepName: "fetch-all-progress" });
      ctx.shipApp.progressAgent.update(newProgress, data.body["has-more"]);

      if (data.body.contacts.length > 0) {
        return ctx.shipApp.syncAgent.saveContacts(data.body.contacts).then(() => info);
      }
      return Promise.resolve(info);
    })
    .then(({ hasMore, vidOffset, newProgress }) => {
      if (hasMore) {
        return fetchAllPage(ctx, {
          count,
          offset: vidOffset,
          progress: newProgress
        });
      }
      return ctx.client.logger.info("incoming.job.success", { jobName: "fetch-all" });
    });
}


export default function fetchAllAction(req, res) {
  const count = 100;

  return fetchAllPage(req.hull, {
    count
  })
  .then(() => {
    req.hull.shipApp.progressAgent.start();
    res.end("ok");
  });
}