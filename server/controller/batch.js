import _ from "lodash";

export default class BatchController {
  /**
   * Parses the extract results and queues chunks for export operations
   * @return {Promise}
   * @param ctx
   * @param payload
   */
  static batchExtractJobHandler(ctx, messages) {
    const users = messages.map(m => m.user);
    ctx.metric.event({
      title: "batch",
      text: `User count: ${users.length}`
    });
    console.log("BATCH!!!");
    const filteredUsers = users.filter(user => ctx.shipApp.syncAgent.userWhitelisted(user) && !_.isEmpty(user.email));
    return ctx.enqueue("sendUsersJob", {
      users: filteredUsers
    });
  }
}
