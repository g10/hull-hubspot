import _ from "lodash";

export default class BatchController {
  /**
   * Parses the extract results and queues chunks for export operations
   * @return {Promise}
   * @param ctx
   * @param payload
   */
  static batchExtractJobHandler(ctx, messages, { query }) {
    let users = messages.map(m => m.user);

    if (query.segment_id) {
      users = users.map((u) => {
        u.segment_ids = _.uniq(_.concat(u.segment_ids || [], [query.segment_id]));
        return u;
      });
    }
    const filteredUsers = users.filter(user => ctx.shipApp.syncAgent.userWhitelisted(user) && !_.isEmpty(user.email));
    return ctx.enqueue("sendUsersJob", {
      users: filteredUsers
    });
  }
}
