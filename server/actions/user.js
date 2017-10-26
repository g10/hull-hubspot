import Promise from "bluebird";
import _ from "lodash";

export default function userUpdateHandler(ctx, messages) {
  const { syncAgent } = ctx.shipApp;
  if (!syncAgent.isConfigured()) {
    ctx.client.logger.error("connector.configuration.error", { errors: "connector is not configured" });
    return Promise.resolve();
  }

  const users = messages.reduce((usersArr, message) => {
    const { user, changes = {}, segments = [] } = message;

    if (_.get(changes, "user['traits_hubspot/fetched_at'][1]", false)
      && _.isEmpty(_.get(changes, "segments"))
    ) {
      return usersArr;
    }

    user.segment_ids = _.uniq(_.concat(user.segment_ids || [], segments.map(s => s.id)));
    if (!syncAgent.userWhitelisted(user) || _.isEmpty(user.email)) {
      return usersArr;
    }

    usersArr.push(user);
    return usersArr;
  }, []);

  return ctx.enqueue("sendUsersJob", { users });
}
