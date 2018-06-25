/* @flow */
const _ = require("lodash");
const Promise = require("bluebird");

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
function sendUsers(ctx: Object, payload: Object) {
  const users = (payload.users || []).filter(u => !_.isEmpty(u.email));

  if (users.length === 0) {
    ctx.client.logger.debug("skip sendUsers - empty users list");
    return Promise.resolve();
  }

  ctx.client.logger.debug("outgoing.job.start", { count_users: users.length });

  if (users.length > 100) {
    ctx.client.logger.warn(
      "sendUsers works best for under 100 users at once",
      users.length
    );
  }

  return ctx.shipApp.syncAgent
    .setupShip()
    .then(({ hubspotProperties }) => {
      const body = users.map(user => {
        const properties = ctx.shipApp.syncAgent.mapping.getHubspotProperties(
          ctx.segments,
          hubspotProperties,
          user
        );
        return {
          email: properties.email || user.email,
          properties
        };
      });
      ctx.metric.value("ship.outgoing.users", body.length);
      return ctx.shipApp.hubspotAgent.batchUsers(body).then(
        res => {
          if (res === null) {
            return Promise.resolve();
          }

          if (res.statusCode === 202) {
            users.map(hullUser => {
              const user = _.find(body, { email: hullUser.email });
              return ctx.client
                .asUser(hullUser)
                .logger.info("outgoing.user.success", user.properties);
            });
            return Promise.resolve();
          }
          return Promise.reject(new Error("Error in create/update batch"));
        },
        err => {
          let parsedErrorInfo = {};
          try {
            parsedErrorInfo = JSON.parse(err.extra);
          } catch (e) {} // eslint-disable-line no-empty
          if (parsedErrorInfo.status === "error") {
            const errors = _.get(parsedErrorInfo, "failureMessages", []).map(
              value => {
                return {
                  user: users[value.index],
                  error: value
                };
              }
            );
            errors.forEach(data => {
              const hubspotMessage =
                data.error.propertyValidationResult &&
                _.truncate(data.error.propertyValidationResult.message, {
                  length: 100
                });
              const hubspotPropertyName =
                data.error.propertyValidationResult &&
                data.error.propertyValidationResult.name;
              if (hubspotMessage && hubspotPropertyName) {
                ctx.client
                  .asUser(data.user)
                  .logger.error("outgoing.user.error", {
                    hull_summary: `Sending data to Hubspot returned an error: ${hubspotMessage} on property: ${hubspotPropertyName}. Please review you outgoing fields mapping.`,
                    hubspot_property_name: hubspotPropertyName,
                    errors: data.error
                  });
              } else if (data.error && data.error.message) {
                ctx.client
                  .asUser(data.user)
                  .logger.error("outgoing.user.error", {
                    error: data.error && data.error.message
                  });
              }
            });

            const retryBody = body.filter((entry, index) => {
              return !_.find(parsedErrorInfo.failureMessages, { index });
            });

            if (retryBody.length > 0) {
              return ctx.shipApp.hubspotAgent
                .batchUsers(retryBody)
                .then(res => {
                  if (res.statusCode === 202) {
                    retryBody.map(hullUser => {
                      const user = _.find(retryBody, { email: hullUser.email });
                      return ctx.client
                        .asUser(hullUser)
                        .logger.info("outgoing.user.success", user.properties);
                    });
                    return Promise.resolve("ok");
                  }
                  return Promise.reject(
                    new Error("Error in create/update batch")
                  );
                });
            }
            return Promise.resolve("ok");
          }
          ctx.client.logger.error("Hubspot batch error", err);
          return Promise.reject(err);
        }
      );
    })
    .catch(err => {
      ctx.client.logger.error("sendUsers.error", (err && err.stack) || err);
      return Promise.reject(err);
    });
}

module.exports = sendUsers;
