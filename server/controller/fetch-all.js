import Promise from "bluebird";

import Users from "./users";

export default class FetchAllController {

  /**
   * public facing method
   * @return {Promise}
   */
  static fetchAllAction(req, res) {
    const count = 100;

    return req.hull.enqueue("fetchAllJob", {
      count
    })
    .then(() => {
      req.hull.shipApp.progressAgent.start();
      res.end("ok");
    });
  }

  /**
   * Job which performs fetchAll operations queues itself and the import job
   * @param  {Number} count
   * @param  {Number} [offset=0]
   * @return {Promise}
   */
  static fetchAllJob(ctx, payload) {
    const { hubspotAgent, syncAgent } = ctx.shipApp;
    const count = payload.count;
    const offset = payload.offset || 0;
    const progress = payload.progress || 0;

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
        ctx.client.logger.info("fetch.users.progress", { users: newProgress });
        ctx.shipApp.progressAgent.update(newProgress, data.body["has-more"]);

        if (data.body.contacts.length > 0) {
          return Users.saveContactsJob(ctx, {
            contacts: data.body.contacts
          }).then(() => info);
        }
        return Promise.resolve(info);
      })
      .then(({ hasMore, vidOffset, newProgress }) => {
        if (hasMore) {
          return FetchAllController.fetchAllJob(ctx, {
            count,
            offset: vidOffset,
            progress: newProgress
          });
        }
        return ctx.client.logger.info("fetch.users.finished");
      });
  }
}
