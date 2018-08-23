//@flow

const Promise = require("bluebird");
const _ = require("lodash");

const { notifHandler, smartNotifierHandler } = require("hull/lib/utils");

import type { PreparedUser } from "../jobs/send-users";
const sendUsers = require("../jobs/send-users");

function notifyHandler(flowControl: {}) {
  const notifyFunction = flowControl ? smartNotifierHandler : notifHandler;

  function shipUpdateHandler(ctx) {
    const { syncAgent } = ctx.shipApp;
    if (!syncAgent.isConfigured()) {
      ctx.client.logger.error("connector.configuration.error", {
        errors: "connector is not configured"
      });
      return Promise.resolve();
    }

    if (ctx.smartNotifierResponse) {
      ctx.smartNotifierResponse.setFlowControl({
        type: "next",
        size: 1,
        in: 1
      });
    }

    return ctx.shipApp.syncAgent.setupShip().catch(err => {
      ctx.client.logger.error("shipUpdateJob.err", err.stack || err);
    });
  }

  function userUpdateHandler(ctx, messages) {
    const { syncAgent } = ctx.shipApp;
    if (!syncAgent.isConfigured()) {
      ctx.client.logger.error("connector.configuration.error", {
        errors: "connector is not configured"
      });
      return Promise.resolve();
    }

    if (ctx.smartNotifierResponse && flowControl) {
      ctx.smartNotifierResponse.setFlowControl(flowControl);
    }

    const users: Array<PreparedUser> = messages.reduce((usersArr, message) => {
      const { user, changes = {}, segments = [], account } = message;

      if (
        _.get(changes, "user['traits_hubspot/fetched_at'][1]", false) &&
        _.isEmpty(_.get(changes, "segments"))
      ) {
        ctx.client.asUser(user).logger.info("outgoing.user.skip", {
          reason: "User just touched by hubspot connector"
        });
        return usersArr;
      }

      const segment_ids = _.uniq(
        _.concat(user.segment_ids || [], segments.map(s => s.id))
      );

      if (!syncAgent.userWhitelisted(user) || _.isEmpty(user.email)) {
        ctx.client.asUser(user).logger.info("outgoing.user.skip", {
          reason: "User doesn't match outgoing filter"
        });
        return usersArr;
      }

      usersArr.push({ account, ...user, segment_ids });
      return usersArr;
    }, []);

    return sendUsers(ctx, { users });
  }

  return notifyFunction({
    userHandlerOptions: {
      groupTraits: false
    },
    handlers: {
      "user:update": userUpdateHandler,
      "segment:update": shipUpdateHandler,
      "segment:delete": shipUpdateHandler,
      "ship:update": shipUpdateHandler
    }
  });
}

module.exports = notifyHandler;
