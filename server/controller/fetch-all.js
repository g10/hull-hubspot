import Promise from "bluebird";

export default class FetchAllController {

  /**
   * public facing method
   * @return {Promise}
   */
  fetchAllAction(req, res) {
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
  fetchAllJob(req) {
    const { hubspotAgent, syncAgent } = req.shipApp;
    const count = req.payload.count;
    const offset = req.payload.offset || 0;
    const progress = req.payload.progress || 0;

    return hubspotAgent.getContacts(syncAgent.mapping.getHubspotPropertiesKeys(), count, offset)
      .then((data) => {
        const promises = [];
        const newProgress = progress + data.body.contacts.length;
        req.shipApp.progressAgent.update(newProgress, data.body["has-more"]);
        if (data.body["has-more"]) {
          promises.push(req.shipApp.queueAgent.create("fetchAllJob", {
            count,
            offset: data.body["vid-offset"],
            progress: newProgress
          }));
        } else {
          req.hull.client.logger.info("fetchAllJob.finished");
        }

        if (data.body.contacts.length > 0) {
          promises.push(req.shipApp.queueAgent.create("saveContactsJob", {
            contacts: data.body.contacts
          }));
        }
        return Promise.all(promises);
      });
  }
}
