// @flow
import type {
  HullAttributeName,
  HullAttributeValue,
  THullContext,
  THullUserUpdateMessage
} from "hull";
import type { PreparedUser } from "../jobs/send-users";

type ProperUserUpdateMessage = {
  ...$Exact<THullUserUpdateMessage>,
  user: {
    id: string,
    email: string | null,
    external_id: string | null,
    anonymous_ids: Array<string> | null,
    domain?: string | null,
    segment_ids: Array<string> | null,
    [HullAttributeName]: HullAttributeValue
  }
};
const _ = require("lodash");
const Promise = require("bluebird");

function handleBatch(
  ctx: THullContext,
  messages: Array<ProperUserUpdateMessage>
) {
  const users: Array<PreparedUser> = messages.map(
    ({ user, account, segments = [] }) => {
      const segmentIds = _.compact(segments).map(s => s.id);
      const userSegmentIds: Array<string> = user.segment_ids || [];
      const segment_ids = _.compact(_.uniq([...userSegmentIds, ...segmentIds]));
      return {
        account,
        ...user,
        segment_ids
      };
    }
  );
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
