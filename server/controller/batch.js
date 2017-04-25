import _ from "lodash";

export default class BatchController {
  /**
   * public method which queues the handleBatchExtractJob
   * @param  {Object} req
   * @param  {Object} res
   * @return {Promise}
   */
  handleBatchExtractAction(req, res) {
    const segmentId = req.query.segment_id || null;
    return req.hull.enqueue("handleBatchExtractJob", {
      body: req.body,
      chunkSize: 100,
      segmentId
    }).then(() => res.end("ok"));
  }

  /**
   * Parses the extract results and queues chunks for export operations
   * @return {Promise}
   * @param ctx
   * @param payload
   */
  handleBatchExtractJob(ctx, payload) {
    return ctx.client.extract.handle(payload.body, payload.chunkSize, (usersBatch) => { // todo ask ! hullagent.extract.handle ?
      if (payload.segmentId) {
        usersBatch = usersBatch.map((u) => {
          u.segment_ids = _.uniq(_.concat(u.segment_ids || [], [payload.segmentId]));
          return u;
        });
      }
      const filteredUsers = usersBatch.filter(user => ctx.shipApp.syncAgent.userWhitelisted(user) && !_.isEmpty(user.email));
      return ctx.enqueue("sendUsersJob", {
        users: filteredUsers
      });
    });
  }
}
