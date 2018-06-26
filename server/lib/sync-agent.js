// @flow
import type {
  THullUserUpdateMessage,
  THullConnector,
  THullReqContext,
  THullSegment
} from "hull";

import type {
  HubspotUserUpdateMessageEnvelope,
  HubspotWriteContact
} from "../types";

const Promise = require("bluebird");
const _ = require("lodash");

const HubspotClient = require("./hubspot-client");
const ContactPropertyUtil = require("./sync-agent/contact-property-util");
const MappingUtil = require("./sync-agent/mapping-util");
const ProgressUtil = require("./sync-agent/progress-util");
const FilterUtil = require("./sync-agent/filter-util");

class SyncAgent {
  hubspotClient: HubspotClient;
  contactPropertyUtil: ContactPropertyUtil;
  mappingUtil: MappingUtil;
  progressUtil: ProgressUtil;
  filterUtil: FilterUtil;

  connector: THullConnector;
  hullClient: Object;
  metric: Object;
  helpers: Object;
  logger: Object;
  userSegments: Array<THullSegment>;

  constructor(ctx: THullReqContext) {
    const { client, ship, metric, helpers, segments } = ctx;
    this.hullClient = client;
    this.connector = ship;
    this.metric = metric;
    this.helpers = helpers;
    this.logger = client.logger;
    this.userSegments = segments;

    this.hubspotClient = new HubspotClient(ctx);

    this.contactPropertyUtil = new ContactPropertyUtil(this.hubspotClient, {
      logger: this.logger,
      metric: this.metric,
      segments: this.userSegments
    });
    this.mappingUtil = new MappingUtil(ship, client);
    this.progressUtil = new ProgressUtil(ctx);
    this.filterUtil = new FilterUtil(ctx);
  }

  isConfigured() {
    return (
      this.connector.private_settings &&
      !_.isEmpty(this.connector.private_settings.token)
    );
  }

  /**
   * Reconcilation of the ship settings
   * @return {Promise}
   */
  setupShip(): Promise<*> {
    if (!this.isConfigured()) {
      this.hullClient.logger.error("connector.configuration.error", {
        errors: "connector is not configured"
      });
      return Promise.resolve();
    }

    // if (ctx.smartNotifierResponse) {
    //   ctx.smartNotifierResponse.setFlowControl({
    //     type: "next",
    //     size: 1,
    //     in: 1
    //   });
    // }

    return Promise.all([this.syncContactProperties()])
      .spread(hubspotProperties => {
        return { hubspotProperties };
      })
      .catch(err => {
        this.hullClient.logger.error("shipUpdateJob.err", err.stack || err);
      });
  }

  /**
   * makes sure hubspot is properly configured to receive custom properties and segments list
   * @return {Promise}
   */
  syncContactProperties(): Promise<*> {
    const customProps = this.mappingUtil.map.to_hubspot;
    return Promise.all([
      this.hubspotClient.retryUnauthorized(() => {
        return this.hubspotClient
          .get("/contacts/v2/groups")
          .query({ includeProperties: true });
      }),
      this.hullClient.utils.properties.get()
    ]).then(([groupsResponse = {}, hullProperties = {}]) => {
      const groups = (groupsResponse && groupsResponse.body) || [];
      const properties = _.reduce(
        customProps,
        (props, customProp) => {
          const hullProp = _.find(hullProperties, { id: customProp.hull });
          props.push(_.merge({}, customProp, _.pick(hullProp, ["type"])));
          return props;
        },
        []
      );
      return this.contactPropertyUtil
        .sync({
          groups,
          properties
        })
        .then(() => groups);
    });
  }

  // shouldSyncUser(user) {
  //   const segmentIds = this.ship.private_settings.synchronized_segments || [];
  //   if (segmentIds.length === 0) {
  //     return false;
  //   }
  //   return (
  //     _.intersection(segmentIds, user.segment_ids).length > 0 &&
  //     !_.isEmpty(user.email)
  //   );
  // }

  /**
   * creates or updates users
   * @see https://www.hull.io/docs/references/api/#endpoint-traits
   * @return {Promise}
   * @param hubspotProperties
   * @param contacts
   */
  saveContacts(contacts) {
    this.logger.debug("saveContacts", contacts.length);
    this.metric.value("ship.incoming.users", contacts.length);
    return this.setupShip().then(({ hubspotProperties }) => {
      return Promise.all(
        contacts.map(c => {
          const traits = this.mappingUtil.getHullTraits(hubspotProperties, c);
          if (!traits.email) {
            return this.logger.info("incoming.user.skip", { contact: c });
          }
          const ident = this.mappingUtil.getIdentFromHubspot(c);
          this.logger.debug("incoming.user", { ident, traits });
          let asUser;
          try {
            asUser = this.hullClient.asUser(ident);
          } catch (error) {
            return this.logger.info("incoming.user.skip", {
              contact: c,
              error
            });
          }
          return asUser.traits(traits).then(
            () => asUser.logger.info("incoming.user.success", { traits }),
            error =>
              asUser.logger.error("incoming.user.error", {
                hull_summary: `Fetching data from Hubspot returned an error: ${_.get(
                  error,
                  "message",
                  ""
                )}`,
                traits,
                errors: error
              })
          );
        })
      );
    });
  }

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
  sendUserUpdateMessages(messages: Array<THullUserUpdateMessage>): Promise<*> {
    // const { syncAgent } = ctx.shipApp;
    if (!this.isConfigured()) {
      this.client.logger.error("connector.configuration.error", {
        errors: "connector is not configured"
      });
      return Promise.resolve();
    }

    // if (ctx.smartNotifierResponse && flowControl) {
    //   ctx.smartNotifierResponse.setFlowControl(flowControl);
    // }

    // const users = messages.reduce((usersArr, message) => {
    //   console.log("message");
    //   const { user, changes = {}, segments = [] } = message;

    //   if (
    //     _.get(changes, "user['traits_hubspot/fetched_at'][1]", false) &&
    //     _.isEmpty(_.get(changes, "segments"))
    //   ) {
    //     this.client.asUser(user).logger.info("outgoing.user.skip", {
    //       reason: "User just touched by hubspot connector"
    //     });
    //     return usersArr;
    //   }

    //   user.segment_ids = _.uniq(
    //     _.concat(user.segment_ids || [], segments.map(s => s.id))
    //   );
    //   if (!syncAgent.userWhitelisted(user) || _.isEmpty(user.email)) {
    //     this.client.asUser(user).logger.info("outgoing.user.skip", {
    //       reason: "User doesn't match outgoing filter"
    //     });
    //     return usersArr;
    //   }

    //   usersArr.push(user);
    //   return usersArr;
    // }, []);

    const envelopes = messages.map(message =>
      this.buildUserUpdateMessageEnvelope(message)
    );
    const filterResults = this.filterUtil.filterUserUpdateMessageEnvelopes(
      envelopes
    );

    // const users = messages.map(m => m.user).filter(u => !_.isEmpty(u.email));

    // if (users.length === 0) {
    //   this.hullClient.logger.debug("skip sendUsers - empty users list");
    //   return Promise.resolve();
    // }

    this.hullClient.logger.debug("outgoing.job.start", {
      filter_results: filterResults
    });

    // if (users.length > 100) {
    //   this.client.logger.warn(
    //     "sendUsers works best for under 100 users at once",
    //     users.length
    //   );
    // }

    return this.setupShip()
      .then(({ hubspotProperties }) => {
        // const body = users.map(user => {
        //   const properties = this.mappingUtil.getHubspotProperties(
        //     // ctx.segments,
        //     hubspotProperties,
        //     user
        //   );
        //   const propEmail = _.find(properties, { property: "email" });
        //   return {
        //     email: propEmail || user.email,
        //     properties
        //   };
        // });
        this.metric.value("ship.outgoing.users", body.length);
        return this.hubspotClient.batchUsers(body).then(
          res => {
            if (res === null) {
              return Promise.resolve();
            }

            if (res.statusCode === 202) {
              users.map(hullUser => {
                const user = _.find(body, { email: hullUser.email });
                return this.hullClient
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
                  this.hullClient
                    .asUser(data.user)
                    .logger.error("outgoing.user.error", {
                      hull_summary: `Sending data to Hubspot returned an error: ${hubspotMessage} on property: ${hubspotPropertyName}. Please review you outgoing fields mapping.`,
                      hubspot_property_name: hubspotPropertyName,
                      errors: data.error
                    });
                } else if (data.error && data.error.message) {
                  this.hullClient
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
                return this.hubspotClient.batchUsers(retryBody).then(res => {
                  if (res.statusCode === 202) {
                    retryBody.map(hullUser => {
                      const user = _.find(retryBody, { email: hullUser.email });
                      return this.hullClient
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
            this.hullClient.logger.error("Hubspot batch error", err);
            return Promise.reject(err);
          }
        );
      })
      .catch(err => {
        this.hullClient.logger.error(
          "sendUsers.error",
          (err && err.stack) || err
        );
        return Promise.reject(err);
      });
  }

  buildUserUpdateMessageEnvelope(
    message: THullUserUpdateMessage
  ): HubspotUserUpdateMessageEnvelope {
    const { user } = message;
    const properties = this.mappingUtil.getHubspotProperties(
      hubspotProperties,
      user
    );
    // const propEmail = _.find(properties, { property: "email" });
    const hubspotWriteContact: HubspotWriteContact = {
      properties
    };

    if (user["hubspot/id"] && typeof user["hubspot/id"] === "string") {
      hubspotWriteContact.vid = user["hubspot/id"];
    } else {
      hubspotWriteContact.email = user.email;
    }

    return {
      message,
      hubspotWriteContact
    };
  }

  // userWhitelisted(user) {
  //   const segmentIds = _.get(
  //     this.ship,
  //     "private_settings.synchronized_segments",
  //     []
  //   );
  //   if (segmentIds.length === 0) {
  //     return true;
  //   }
  //   return _.intersection(segmentIds, user.segment_ids).length > 0;
  // }
}

module.exports = SyncAgent;
