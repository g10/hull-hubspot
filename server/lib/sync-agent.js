// @flow
import type {
  THullUserUpdateMessage,
  THullConnector,
  THullReqContext,
  THullSegment
} from "hull";

import type {
  HubspotUserUpdateMessageEnvelope,
  HubspotReadContact
} from "../types";

// const Promise = require("bluebird");
const _ = require("lodash");
const moment = require("moment");

const pipeToPromise = require("./pipe-to-promise");
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
  usersSegments: Array<THullSegment>;
  cache: Object;
  isBatch: boolean;

  constructor(ctx: THullReqContext) {
    const { client, cache, connector, metric, helpers, usersSegments } = ctx;
    this.hullClient = client;
    this.connector = connector;
    this.metric = metric;
    this.helpers = helpers;
    this.logger = client.logger;
    this.usersSegments = usersSegments;
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
  async initialize({ skipCache = false }: Object = {}): Promise<void> {
    if (this.isInitialized() === true) {
      return;
    }

    if (skipCache === true) {
      await this.cache.del("hubspotProperties");
      await this.cache.del("hullProperties");
    }
    const hubspotProperties = await this.cache.wrap("hubspotProperties", () => {
      return this.hubspotClient.getContactPropertyGroups();
    });
    const hullProperties = await this.cache.wrap("hullProperties", () => {
      return this.hullClient.utils.properties.get();
    });
    this.contactPropertyUtil = new ContactPropertyUtil({
      hubspotClient: this.hubspotClient,
      logger: this.logger,
      metric: this.metric,
      usersSegments: this.usersSegments,
      hubspotProperties,
      hullProperties
    });
    this.mappingUtil = new MappingUtil({
      connector: this.connector,
      hullClient: this.hullClient,
      usersSegments: this.usersSegments,
      hubspotProperties,
      hullProperties
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
    await this.initialize({ skipCache: true });

    const outboundMapping = this.mappingUtil.getContactOutboundMapping();
    return this.contactPropertyUtil.sync(outboundMapping);
  }

  /**
   * creates or updates users
   * @see https://www.hull.io/docs/references/api/#endpoint-traits
   * @return {Promise}
   * @param hubspotProperties
   * @param contacts
   */
  saveContacts(contacts: Array<HubspotReadContact>): Promise<any> {
    this.logger.debug("saveContacts", contacts.length);
    this.metric.value("ship.incoming.users", contacts.length);
    return Promise.all(
      contacts.map(contact => {
        const traits = this.mappingUtil.getHullTraits(contact);
        const ident = this.mappingUtil.getIdentFromHubspot(contact);
        if (!ident.email) {
          return this.logger.info("incoming.user.skip", {
            contact,
            reason: "missing email"
          });
        }
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
    await this.initialize();
    if (!this.isConfigured()) {
      this.hullClient.logger.error("connector.configuration.error", {
        errors: "connector is not configured"
      });
      return Promise.resolve();
    }

    const envelopes = messages.map(message =>
      this.buildUserUpdateMessageEnvelope(message)
    );
    const filterResults = this.filterUtil.filterUserUpdateMessageEnvelopes(
      envelopes
    );

    this.hullClient.logger.debug("outgoing.job.start", {
      filter_results: filterResults
    });

    filterResults.toSkip.forEach(envelope => {
      this.hullClient
        .asUser(envelope.message.user)
        .logger.info("outgoing.user.skip", { reason: envelope.skipReason });
    });

    const envelopesToUpsert = filterResults.toInsert.concat(
      filterResults.toUpdate
    );
    return this.hubspotClient
      .postContactsEnvelopes(envelopesToUpsert)
      .then(resultEnvelopes => {
        resultEnvelopes.forEach(envelope => {
          if (envelope.error === undefined) {
            this.hullClient
              .asUser(envelope.message.user)
              .logger.info(
                "outgoing.user.success",
                envelope.hubspotWriteContact
              );
          } else {
            this.hullClient
              .asUser(envelope.message.user)
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
  async fetchRecentContacts(): Promise<any> {
    await this.initialize();
    const lastFetchAt =
      this.connector.private_settings.last_fetch_at ||
      moment()
        .subtract(1, "hour")
        .format();
    const stopFetchAt = moment().format();
    const propertiesToFetch = this.mappingUtil.getHubspotPropertiesKeys();
    let progress = 0;

    this.hullClient.logger.info("incoming.job.start", {
      jobName: "fetch",
      type: "user",
      lastFetchAt,
      stopFetchAt,
      propertiesToFetch
    });
    await this.progressUtil.start();
    await this.helpers.updateSettings({
      last_fetch_at: stopFetchAt
    });

    const streamOfIncomingContacts = this.hubspotClient.getRecentContactsStream(
      lastFetchAt,
      stopFetchAt,
      propertiesToFetch
    );

    streamOfIncomingContacts.pipe(
      pipeToPromise(contacts => {
        progress += contacts.length;
        this.progressUtil.update(progress);
        this.hullClient.logger.info("incoming.job.progress", {
          jobName: "fetch",
          type: "user",
          progress
        });
        return this.saveContacts(contacts);
      })
    );

    return new Promise((resolve, reject) => {
      streamOfIncomingContacts.on("end", () => resolve());
      streamOfIncomingContacts.on("error", error => reject(error));
    })
      .then(() => {
        this.progressUtil.start();
        this.hullClient.logger.info("incoming.job.success", {
          jobName: "fetch"
        });
      })
      .catch(error => {
        this.progressUtil.start();
        this.hullClient.logger.info("incoming.job.error", {
          jobName: "fetch",
          error
        });
      });
  }

  /**
   * Job which performs fetchAll operations queues itself and the import job
   * @param  {Number} count
   * @param  {Number} [offset=0]
   * @return {Promise}
   */
  async fetchAllContacts(): Promise<any> {
    await this.initialize();
    const propertiesToFetch = this.mappingUtil.getHubspotPropertiesKeys();
    let progress = 0;

    this.hullClient.logger.info("incoming.job.start", {
      jobName: "fetchAll",
      type: "user",
      propertiesToFetch
    });

    const streamOfIncomingContacts = this.hubspotClient.getAllContactsStream(
      propertiesToFetch
    );

    streamOfIncomingContacts.pipe(
      pipeToPromise(contacts => {
        progress += contacts.length;
        this.progressUtil.update(progress);
        this.hullClient.logger.info("incoming.job.progress", {
          jobName: "fetch",
          type: "user",
          progress
        });
        return this.saveContacts(contacts);
      })
    );

    return new Promise((resolve, reject) => {
      streamOfIncomingContacts.on("end", () => resolve());
      streamOfIncomingContacts.on("error", error => reject(error));
    })
      .then(() => {
        this.hullClient.logger.info("incoming.job.success", {
          jobName: "fetchAll"
        });
      })
      .catch(error => {
        this.hullClient.logger.info("incoming.job.error", {
          jobName: "fetchAl",
          error
        });
      });
  }
}

module.exports = SyncAgent;
