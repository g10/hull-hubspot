/* @flow */
import _ from "lodash";
import Promise from "bluebird";

export default class UsersController {
  /**
   * Sends Hull users to Hubspot contacts using create or update strategy.
   * The job on Hubspot side is done async the returned Promise is resolved
   * when the query was queued successfully. It is rejected when:
   * "you pass an invalid email address, if a property in your request doesn't exist,
   * or if you pass an invalid property value."
   * @see http://developers.hubspot.com/docs/methods/contacts/batch_create_or_update
   * @param  {Array} users users from Hull
   * @return {Promise}
   */
  static sendUsersJob(ctx, payload) {
    const users = (payload.users || []).filter(u => !_.isEmpty(u.email));

    if (users.length === 0) {
      return ctx.client.logger.log("skip sendUsersJob - empty users list");
    }

    ctx.client.logger.log("sendUsersJob", { count_users: users.length });

    if (users.length > 100) {
      ctx.client.logger.warn("sendUsersJob works best for under 100 users at once", users.length);
    }

    return ctx.shipApp.syncAgent.setupShip()
      .then(({ hubspotProperties }) => {
        const body = users.map((user) => {
          const properties = ctx.shipApp.syncAgent.mapping.getHubspotProperties(ctx.segments, hubspotProperties, user);
          ctx.client.logger.debug("outgoing.user", { email: user.email, properties });
          return {
            email: user.email,
            properties
          };
        });
        ctx.metric.value("ship.outgoing.users", body.length);
        return ctx.shipApp.hubspotAgent.batchUsers(body);
      })
      .then((res) => {
        if (res === null) {
          return Promise.resolve();
        }

        const { statusCode, body } = res;

        if (statusCode === 202) {
          return Promise.resolve();
        }

        console.warn("Error in sendUsersJob", { statusCode, body });
        return Promise.reject(new Error("Error in create/update batch"));
      }, (err) => {
        ctx.client.logger.info("Hubspot batch error", err);
        return Promise.reject(err);
      })
      .catch((err) => {
        ctx.client.logger.error("sendUsers.error", err.stack || err);
        return Promise.reject(err);
      });
  }

  /**
   * creates or updates users
   * @see https://www.hull.io/docs/references/api/#endpoint-traits
   * @return {Promise}
   * @param ctx
   */
  static saveContactsJob(ctx, payload) {
    const contacts = payload.contacts;
    ctx.metric.value("ship.incoming.users", contacts.length, ctx.client.configuration());
    return ctx.shipApp.syncAgent.setupShip()
      .then(({ hubspotProperties }) => {
        return ctx.shipApp.syncAgent.saveContacts(hubspotProperties, contacts);
      });
  }
}
