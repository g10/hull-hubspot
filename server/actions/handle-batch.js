const _ = require("lodash");
const Promise = require("bluebird");

import type { PreparedUser } from "../jobs/send-users";

function handleBatch(ctx, messages) {
  const users: Array<PreparedUser> = messages.map(({ user, account, segments = [] }) => {
    const segmentIds = _.compact(segments).map(s => s.id);
    const segment_ids = _.compact(
      _.uniq((user.segment_ids || []).concat(segmentIds))
    );
    return {
      account,
      ...user,
      segment_ids,
    };
  });
  const filteredUsers: Array<PreparedUser> = users.filter(
    user =>
      ctx.shipApp.syncAgent.userWhitelisted(user) && !_.isEmpty(user.email)
  );
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
