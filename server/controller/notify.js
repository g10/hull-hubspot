import Promise from "bluebird";
import _ from "lodash";

import BatchSyncHandler from "../util/handler/batch-sync";

export default class UserUpdateStrategy {
  userUpdateHandler(payload, { req }) {
    const { syncAgent, hullAgent } = req.shipApp;
    const message = payload.message;
    if (!syncAgent.isConfigured()) {
      req.hull.client.logger.info("ship is not configured");
      return Promise.resolve();
    }

    const { user, changes = {}, segments = [] } = message;

    if (_.get(changes, "user['traits_hubspot/fetched_at'][1]", false)
      && _.isEmpty(_.get(changes, "segments"))
    ) {
      return Promise.resolve();
    }

    user.segment_ids = _.uniq(_.concat(user.segment_ids || [], segments.map(s => s.id)));

    if (!hullAgent.userWhitelisted(user)) {
      return Promise.resolve();
    }

    return BatchSyncHandler.getHandler({
      hull: req.hull,
      ship: req.hull.ship,
      ns: "user_update",
      options: {
        maxSize: 100,
        throttle: 30000
      }
    }).setCallback((users) => {
      return req.shipApp.queueAgent.create("sendUsersJob", { users });
    })
    .add(user);
  }

  shipUpdateHandler(payload, { req }) {
    const { syncAgent } = req.shipApp;
    if (!syncAgent.isConfigured()) {
      req.hull.client.logger.info("ship is not configured");
      return Promise.resolve();
    }
    const message = payload.message; // eslint-disable-line no-unused-vars
    return syncAgent.setupShip()
      .catch((err) => {
        req.hull.client.logger.error("Error in creating segments property", err.message);
      });
  }

  segmentUpdateHandler(payload, { req }) {
    const { syncAgent, hullAgent } = req.shipApp;
    if (!syncAgent.isConfigured()) {
      req.hull.client.logger.info("ship is not configured");
      return Promise.resolve();
    }
    const segment = payload.message;
    return syncAgent.setupShip()
      .then(() => {
        return hullAgent.extract.request({ segment, fields: syncAgent.mapping.getHullTraitsKeys() });
      });
  }

  segmentDeleteHandler(payload, { req }) {
    const { syncAgent, hullAgent } = req.shipApp;
    if (!syncAgent.isConfigured()) {
      req.hull.client.logger.info("ship is not configured");
      return Promise.resolve();
    }
    // TODO: if the segment would have `query` param we could trigger an extract
    // for deleted segment, for now we need to trigger an extract for all userbase
    const segment = payload.message; // eslint-disable-line no-unused-vars
    return syncAgent.setupShip()
      .then(() => {
        const segments = req.hull.ship.private_settings.synchronized_segments || [];
        if (segments.length === 0) {
          return hullAgent.extract.request({ fields: syncAgent.mapping.getHullTraitsKeys() });
        }
        return Promise.map(segments, segmentId => {
          return hullAgent.extract.request({ segment: { id: segmentId }, remove: true, fields: syncAgent.mapping.getHullTraitsKeys() });
        });
      });
  }
}
