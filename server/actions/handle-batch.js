import _ from "lodash";
import Promise from "bluebird";

export default function handleBatch(ctx, messages) {
  const users = messages.map(m => {
    const segmentIds = m.segments.map(s => s.id);
    m.user.segment_ids = _.compact(_.uniq((m.user.segment_ids || []).concat(segmentIds)));
    return m.user;
  });
  const filteredUsers = users.filter(user => ctx.shipApp.syncAgent.userWhitelisted(user) && !_.isEmpty(user.email));
  ctx.client.logger.debug("outgoing.users.batch", {
    preFilter: users.length,
    postFilter: filteredUsers.length
  });

  if (filteredUsers.length === 0) {
    return Promise.resolve("ok");
  }
  return ctx.enqueue("sendUsersJob", {
    users: filteredUsers
  });
}
