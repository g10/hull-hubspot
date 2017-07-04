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
      return ctx.client.logger.warn("skip sendUsersJob - empty users list");
    }

    ctx.client.logger.warn("sendUsersJob", { count_users: users.length });

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
        return ctx.shipApp.hubspotAgent.batchUsers(body)
        .then((res) => {
          if (res === null) {
            return Promise.resolve();
          }

          if (res.statusCode === 202) {
            users.map(u => ctx.client.logger.info("outgoing.user.success", { email: u.email, hull_id: u.id, external_id: u.external_id }));
            return Promise.resolve();
          }
          return Promise.reject(new Error("Error in create/update batch"));
        }, (err) => {
          let parsedErrorInfo = {};
          try {
            parsedErrorInfo = JSON.parse(err.extra);
          } catch (e) {} // eslint-disable-line no-empty
          if (parsedErrorInfo.status === "error") {
            ctx.metric.event({
              title: "Errors found processing batch update",
              text: err.extra
            });
            const errors = parsedErrorInfo.failureMessages
              .map((value) => {
                return {
                  user: users[value.index],
                  error: value
                };
              });
            errors.map(data => ctx.client.logger.error("outgoing.user.error", { ..._.pick(data.user, "email", "id", "external_id"), error: data.error }));

            const retryBody = body
              .filter((entry, index) => {
                return !_.find(parsedErrorInfo.failureMessages, { index });
              });

            if (retryBody.length > 0) {
              return ctx.shipApp.hubspotAgent.batchUsers(retryBody)
                .then(res => {
                  if (res.statusCode === 202) {
                    retryBody.map(u => ctx.client.logger.info("outgoing.user.success", { email: u.email, hull_id: u.id, external_id: u.external_id }));
                    return Promise.resolve("ok");
                  }
                  return Promise.reject(new Error("Error in create/update batch"));
                });
            }
            return Promise.resolve("ok");
          }
          ctx.client.logger.error("Hubspot batch error", err);
          return Promise.reject(err);
        });
      })
      .catch((err) => {
        ctx.client.logger.error("sendUsers.error", (err && err.stack) || err);
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
