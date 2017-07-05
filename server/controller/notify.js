import Promise from "bluebird";
import _ from "lodash";

export default class UserUpdateStrategy {
  static userUpdateHandler(ctx, messages) {
    const { syncAgent } = ctx.shipApp;
    if (!syncAgent.isConfigured()) {
      ctx.client.logger.error("connector.configuration.error", { errors: "ship is not configured" });
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

  static shipUpdateHandler(ctx) {
    const { syncAgent } = ctx.shipApp;
    if (!syncAgent.isConfigured()) {
      ctx.client.logger.error("connector.configuration.error", { errors: "ship is not configured" });
      return Promise.resolve();
    }
    return ctx.enqueue("shipUpdateJob");
  }

  static segmentUpdateHandler(ctx, message) {
    const { syncAgent } = ctx.shipApp;
    if (!syncAgent.isConfigured()) {
      ctx.client.logger.error("connector.configuration.error", { errors: "ship is not configured" });
      return Promise.resolve();
    }
    const segment = message;
    return syncAgent.setupShip()
      .then(() => {
        return ctx.helpers.requestExtract({ segment, fields: syncAgent.mapping.getHullTraitsKeys() });
      })
      .catch((err) => {
        ctx.client.logger.error("requestExtract.error", err);
        return Promise.resolve("err");
      });
  }

  static segmentDeleteHandler(ctx) {
    const { syncAgent } = ctx.shipApp;
    if (!syncAgent.isConfigured()) {
      ctx.client.logger.error("connector.configuration.error", { errors: "ship is not configured" });
      return Promise.resolve();
    }
    // TODO: if the segment would have `query` param we could trigger an extract
    // for deleted segment, for now we need to trigger an extract for all userbase
    return syncAgent.setupShip()
      .then(() => {
        const segments = ctx.ship.private_settings.synchronized_segments || [];
        if (segments.length === 0) {
          return ctx.helpers.requestExtract({ fields: syncAgent.mapping.getHullTraitsKeys() });
        }
        return Promise.map(segments, (segmentId) => {
          return ctx.helpers.requestExtract({ segment: { id: segmentId }, remove: true, fields: syncAgent.mapping.getHullTraitsKeys() });
        });
      })
      .catch((err) => {
        ctx.client.logger.error("requestExtract.error", err);
        return Promise.resolve("err");
      });
  }
}
