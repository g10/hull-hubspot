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
        // TODO: save offset to job progress
        const promises = [];
        const newProgress = progress + data.body.contacts.length;
        ctx.shipApp.progressAgent.update(newProgress, data.body["has-more"]);
        if (data.body["has-more"]) {
          promises.push(FetchAllController.fetchAllJob(ctx, {
            count,
            offset: data.body["vid-offset"],
            progress: newProgress
          }));
        } else {
          ctx.client.logger.info("fetchAllJob.finished");
        }

        if (data.body.contacts.length > 0) {
          promises.push(Users.saveContactsJob(ctx, {
            contacts: data.body.contacts
          }));
        }
        return Promise.all(promises);
      });
  }
}
