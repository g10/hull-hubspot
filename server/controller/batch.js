import _ from "lodash";

export default class BatchController {
  /**
   * public method which queues the handleBatchExtractJob
   * @param  {Object} req
   * @param  {Object} res
   * @return {Promise}
   */
  static handleBatchExtractAction(req, res, next) {
    req.hull.query.segment_id = req.query.segment_id || null;
    next();
  }

  /**
   * Parses the extract results and queues chunks for export operations
   * @return {Promise}
   * @param ctx
   * @param payload
   */
  static batchExtractJobHandler(ctx, payload) {
    return (usersBatch) => {
      if (ctx.query.segment_id) {
        usersBatch = usersBatch.map((u) => {
          u.segment_ids = _.uniq(_.concat(u.segment_ids || [], [payload.segmentId]));
          return u;
        });
      }
      const filteredUsers = usersBatch.filter(user => ctx.shipApp.syncAgent.userWhitelisted(user) && !_.isEmpty(user.email));
      return ctx.enqueue("sendUsersJob", {
        users: filteredUsers
      });
    };
  }

  static handleBatchExtractJob(ctx, payload) {
    return ctx.client.utils.extract.handle({
      body: payload.body,
      batchSize: payload.batchSize,
      handler: this.batchExtractJobHandler(ctx, payload)
    });
  }
}
