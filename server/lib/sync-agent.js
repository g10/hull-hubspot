// @flow
import type {
  THullUserUpdateMessage,
  THullConnector,
  THullReqContext,
  THullSegment
} from "hull";

import type {
  HubspotUserUpdateMessageEnvelope,
  HubspotReadContact,
  HubspotWriteContact
} from "../types";

const Promise = require("bluebird");
const _ = require("lodash");
const moment = require("moment");

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
  cache: Object;

  constructor(ctx: THullReqContext) {
    const { client, cache, ship, metric, helpers, segments } = ctx;
    this.hullClient = client;
    this.connector = ship;
    this.metric = metric;
    this.helpers = helpers;
    this.logger = client.logger;
    this.userSegments = segments;
    this.cache = cache;

    this.hubspotClient = new HubspotClient(ctx);
    this.progressUtil = new ProgressUtil(ctx);
    this.filterUtil = new FilterUtil(ctx);
  }

  isInitialized(): boolean {
    return (
      this.contactPropertyUtil instanceof ContactPropertyUtil &&
      this.mappingUtil instanceof MappingUtil
    );
  }

  /**
   *
   */
  initialize(): Promise<void> {
    if (this.isInitialized() === true) {
      return Promise.resolve();
    }
    return Promise.all([
      this.cache.wrap("hubspotProperties", () => {
        return this.hubspotClient.getContactPropertyGroups();
      }),
      this.cache.wrap("hullProperties", () => {
        return this.hullClient.utils.properties.get();
      })
    ]).spread((hubspotProperties, hullProperties) => {
      this.contactPropertyUtil = new ContactPropertyUtil({
        hubspotClient: this.hubspotClient,
        logger: this.logger,
        metric: this.metric,
        userSegments: this.userSegments,
        hubspotProperties,
        hullProperties
      });
      this.mappingUtil = new MappingUtil({
        connector: this.connector,
        hullClient: this.hullClient,
        hubspotProperties,
        hullProperties
      });
    });
  }

  isConfigured() {
    return (
      this.connector.private_settings &&
      !_.isEmpty(this.connector.private_settings.token)
    );
  }

  checkToken() {
    if (!this.isConfigured()) {
      this.hullClient.logger.error("connector.configuration.error", {
        errors: "connector is not configured"
      });
      return Promise.resolve();
    }
    return this.hubspotClient.checkToken();
  }

  getContactProperties() {
    return this.cache
      .wrap("contact_properties", () => {
        return this.hubspotClient.getContactPropertyGroups();
      })
      .then(groups => {
        return {
          options: groups.map(group => {
            return {
              label: group.displayName,
              options: _.chain(group.properties)
                .map(prop => {
                  return {
                    label: prop.label,
                    value: prop.name
                  };
                })
                .value()
            };
          })
        };
      })
      .catch(() => {
        return { options: [] };
      });
  }

  /**
   * Reconcilation of the ship settings
   * @return {Promise}
   */
  async syncConnector(): Promise<*> {
    if (!this.isConfigured()) {
      this.hullClient.logger.error("connector.configuration.error", {
        errors: "connector is not configured"
      });
      return Promise.resolve();
    }
    await this.initialize();

    // if (ctx.smartNotifierResponse) {
    //   ctx.smartNotifierResponse.setFlowControl({
    //     type: "next",
    //     size: 1,
    //     in: 1
    //   });
    // }

    return this.syncContactProperties().catch(err => {
      this.hullClient.logger.error("shipUpdateJob.err", err.stack || err);
    });
  }

  // getContactProperties() {
  //   const customProps = this.mappingUtil.map.to_hubspot;
  //   return Promise.all([
  //     this.hubspotClient.retryUnauthorized(() => {
  //       return this.hubspotClient
  //         .get("/contacts/v2/groups")
  //         .query({ includeProperties: true });
  //     }),
  //     this.hullClient.utils.properties.get()
  //   ]).then(([groupsResponse = {}, hullProperties = {}]) => {
  //     const groups = (groupsResponse && groupsResponse.body) || [];
  //     const properties = _.reduce(
  //       customProps,
  //       (props, customProp) => {
  //         const hullProp = _.find(hullProperties, { id: customProp.hull });
  //         props.push(_.merge({}, customProp, _.pick(hullProp, ["type"])));
  //         return props;
  //       },
  //       []
  //     );
  //     return properties;
  //   });
  // }

  /**
   * makes sure hubspot is properly configured to receive custom properties and segments list
   * @return {Promise}
   */
  syncContactProperties(): Promise<*> {
    // this.customPropertyUtil.get;
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

  /**
   * creates or updates users
   * @see https://www.hull.io/docs/references/api/#endpoint-traits
   * @return {Promise}
   * @param hubspotProperties
   * @param contacts
   */
  saveContacts(contacts: Array<HubspotReadContact>): Promise {
    this.logger.debug("saveContacts", contacts.length);
    this.metric.value("ship.incoming.users", contacts.length);
    return Promise.all(
      contacts.map(contact => {
        const traits = this.mappingUtil.getHullTraits(contact);
        if (!traits.email) {
          return this.logger.info("incoming.user.skip", { contact });
        }
        const ident = this.mappingUtil.getIdentFromHubspot(contact);
        this.logger.debug("incoming.user", { ident, traits });
        let asUser;
        try {
          asUser = this.hullClient.asUser(ident);
        } catch (error) {
          return this.logger.info("incoming.user.skip", {
            contact,
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
  async sendUserUpdateMessages(
    messages: Array<THullUserUpdateMessage>
  ): Promise<*> {
    console.log(">>> SEND");
    await this.initialize();
    console.log("initialized", this.isConfigured());
    if (!this.isConfigured()) {
      this.hullClient.logger.error("connector.configuration.error", {
        errors: "connector is not configured"
      });
      return Promise.resolve();
    }

    // if (ctx.smartNotifierResponse && flowControl) {
    //   ctx.smartNotifierResponse.setFlowControl(flowControl);
    // }

    const envelopes = messages.map(message =>
      this.buildUserUpdateMessageEnvelope(message)
    );
    console.log("built envelopes");
    const filterResults = this.filterUtil.filterUserUpdateMessageEnvelopes(
      envelopes
    );

    this.hullClient.logger.debug("outgoing.job.start", {
      filter_results: filterResults
    });

    return this.hubspotClient.postContacts(envelopes).then(resultEnvelopes => {
      resultEnvelopes.forEach(envelope => {
        if (envelope.error === undefined) {
          this.hullClient
            .asUser(envelope.user)
            .logger.info("outgoing.user.success", envelope.hubspotWriteContact);
        } else {
          this.hullClient
            .asUser(envelope.user)
            .logger.error("outgoing.user.error", envelope.error);
        }
      });
    });
  }

  buildUserUpdateMessageEnvelope(
    message: THullUserUpdateMessage
  ): HubspotUserUpdateMessageEnvelope {
    const { user } = message;
    const hubspotWriteContact = this.mappingUtil.getHubspotContact(user);
    return {
      message,
      hubspotWriteContact
    };
  }

  /**
   * Handles operation for automatic sync changes of hubspot profiles
   * to hull users.
   */
  async fetchRecentContacts(): Promise {
    await this.initialize();
    console.log(">>> fetchRecentContacts");
    console.log("AAA", this.mappingUtil.getHubspotPropertiesKeys());
    const lastFetchAt =
      this.connector.private_settings.last_fetch_at ||
      moment()
        .subtract(1, "hour")
        .format();
    const stopFetchAt = moment().format();
    const propertiesToFetch = this.mappingUtil.getHubspotPropertiesKeys();
    const streamOfIncomingContacts = this.hubspotClient.getRecentContactsStream(
      lastFetchAt,
      stopFetchAt,
      propertiesToFetch
    );

    streamOfIncomingContacts.on("data", contacts => {
      this.saveContacts(contacts);
    });

    return new Promise((resolve, reject) => {
      streamOfIncomingContacts.on("end", () => resolve());
      streamOfIncomingContacts.on("error", error => reject(error));
    });

    // function fetchPage(payload) {
    //   // const { hubspotAgent, syncAgent } = ctx.shipApp;
    //   const { lastFetchAt, stopFetchAt } = payload;
    //   let { lastModifiedDate } = payload;

    //   const count = payload.count || 100;
    //   const offset = payload.offset || 0;
    //   const page = payload.page || 1;
    //   this.metric.value("ship.incoming.fetch.page", page);
    //   this.hullClient.logger.debug("syncJob.getRecentContacts", {
    //     lastFetchAt,
    //     stopFetchAt,
    //     count,
    //     offset,
    //     page
    //   });
    //   this.hullClient.logger.info("incoming.job.progress", {
    //     jobName: "fetch",
    //     progress: page * count,
    //     stepName: "sync-recent-contacts"
    //   });
    //   return this.hubspotClient
    //     .getRecentContacts(
    //       this.mappingUtil.getHubspotPropertiesKeys(),
    //       lastFetchAt,
    //       stopFetchAt,
    //       count,
    //       offset
    //     )
    //     .then(res => {
    //       const info = {
    //         usersCount: res.body.contacts.length,
    //         hasMore: res.body["has-more"],
    //         vidOffset: res.body["vid-offset"]
    //       };
    //       if (res.body.contacts.length > 0) {
    //         lastModifiedDate = _(res.body.contacts)
    //           .map(c => _.get(c, "properties.lastmodifieddate.value"))
    //           .uniq()
    //           .nth(-2);

    //         if (res.body["vid-offset"] === res.body.contacts[0].vid) {
    //           ctx.client.logger.warn("incoming.job.warning", {
    //             jobName: "fetch",
    //             warnings:
    //               "vidOffset moved to the top of the recent contacts list"
    //           });
    //           // TODO: call the `syncJob` with timeOffset instead of the vidOffset
    //         }
    //         return ctx.shipApp.syncAgent
    //           .saveContacts(res.body.contacts)
    //           .then(() => info);
    //       }
    //       return Promise.resolve(info);
    //     })
    //     .then(({ usersCount, hasMore, vidOffset }) => {
    //       if (hasMore && usersCount > 0) {
    //         return fetchPage(ctx, {
    //           lastFetchAt,
    //           stopFetchAt,
    //           count,
    //           page: page + 1,
    //           offset: vidOffset,
    //           lastModifiedDate
    //         });
    //       }
    //       ctx.client.logger.info("incoming.job.success", { jobName: "fetch" });
    //       return Promise.resolve("done");
    //     });
    // }

    // const count = parseInt(process.env.FETCH_CONTACTS_COUNT, 10) || 100;
    // const lastFetchAt = new Date(); //ctx.shipApp.hubspotAgent.getLastFetchAt();
    // const stopFetchAt = new Date(); //ctx.shipApp.hubspotAgent.getStopFetchAt();
    // let lastModifiedDate;
    // this.hullClient.logger.debug("syncAction.lastFetchAt", {
    //   lastFetchAt,
    //   stopFetchAt
    // });
    // this.hullClient.logger.info("incoming.job.start", {
    //   jobName: "fetch",
    //   type: "user",
    //   lastFetchAt,
    //   stopFetchAt
    // });

    // return this.helpers
    //   .updateSettings({
    //     last_fetch_at: stopFetchAt
    //   })
    //   .then(() => {
    //     return fetchPage({
    //       lastFetchAt,
    //       stopFetchAt,
    //       count,
    //       lastModifiedDate
    //     });
    //   })
    //   .catch(error => {
    //     this.hullClient.logger.info("incoming.job.error", {
    //       jobName: "fetch",
    //       error
    //     });
    //   });
  }

  /**
   * Job which performs fetchAll operations queues itself and the import job
   * @param  {Number} count
   * @param  {Number} [offset=0]
   * @return {Promise}
   */
  fetchAllContacts(): Promise {
    const {
      saveContacts,
      progressAgent,
      hullClient,
      hubspotClient,
      mappingUtil
    } = this;
    function fetchAllPage(payload) {
      const count = payload.count;
      const offset = payload.offset || 0;
      const progress = payload.progress || 0;
      // TODO: pick up from job progress previous offset
      return hubspotClient
        .getContacts(mappingUtil.getHubspotPropertiesKeys(), count, offset)
        .then(data => {
          const newProgress = progress + data.body.contacts.length;
          const info = {
            hasMore: data.body["has-more"],
            vidOffset: data.body["vid-offset"],
            newProgress
          };
          // TODO: save offset to job progress
          hullClient.logger.info("incoming.job.progress", {
            jobName: "fetch-all",
            progress: newProgress,
            stepName: "fetch-all-progress",
            info
          });
          progressAgent.update(newProgress, data.body["has-more"]);

          if (data.body.contacts.length > 0) {
            return saveContacts(data.body.contacts).then(() => info);
          }
          return Promise.resolve(info);
        })
        .then(({ hasMore, vidOffset, newProgress }) => {
          if (hasMore) {
            return fetchAllPage({
              count,
              offset: vidOffset,
              progress: newProgress
            });
          }
          return Promise.resolve();
        });
    }
    const count = 100;
    const offset = req.query.vidOffset || null;
    req.hull.client.logger.info("incoming.job.start", {
      jobName: "fetch-all",
      type: "user"
    });
    req.hull.shipApp.progressAgent.start();
    return fetchAllPage({
      count,
      offset
    }).then(() => {
      return req.hull.client.logger.info("incoming.job.success", {
        jobName: "fetch-all"
      });
    });
  }
}

module.exports = SyncAgent;
