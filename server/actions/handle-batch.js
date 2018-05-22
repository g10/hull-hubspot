const _ = require("lodash");
const Promise = require("bluebird");

function handleBatch(ctx, messages) {
  const users = messages.map(m => {
    const segmentIds = _.compact(m.segments).map(s => s.id);
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
  return ctx.enqueue("sendUsers", {
    users: filteredUsers
  });
}

module.exports = handleBatch;
