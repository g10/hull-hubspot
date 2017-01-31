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
  sendUsersJob(req) {
    const users = (req.payload.users || []).filter(u => !_.isEmpty(u.email));

    if (users.length === 0) {
      return req.hull.client.logger.log("skip sendUsersJob - empty users list");
    }

    req.hull.client.logger.log("sendUsersJob", { count_users: users.length });

    if (users.length > 100) {
      req.hull.client.logger.warn("sendUsersJob works best for under 100 users at once", users.length);
    }

    return req.shipApp.syncAgent.setupShip()
      .then(({ hubspotProperties }) => {
        return req.shipApp.hullAgent.getSegments()
        .then(segments => {
          const body = users.map((user) => {
            const properties = req.shipApp.syncAgent.mapping.getHubspotProperties(segments, hubspotProperties, user);
            req.hull.client.logger.debug("outgoing.user", { email: user.email, properties });
            return {
              email: user.email,
              properties
            };
          });
          req.shipApp.instrumentationAgent.metricVal("ship.outgoing.users", body.length, req.hull.client.configuration());
          return req.shipApp.hubspotAgent.batchUsers(body);
        });
      })
      .then(res => {
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
        req.hull.client.logger.info("Hubspot batch error", err);
        return Promise.reject(err);
      });
  }

  /**
   * creates or updates users
   * @see https://www.hull.io/docs/references/api/#endpoint-traits
   * @param  {Array} Hubspot contacts
   * @return {Promise}
   */
  saveContactsJob(req) {
    const contacts = req.payload.contacts;
    req.shipApp.instrumentationAgent.metricVal("ship.incoming.users", contacts.length, req.hull.client.configuration());
    return req.shipApp.syncAgent.saveContacts(contacts);
  }
}
