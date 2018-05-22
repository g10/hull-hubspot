const Promise = require("bluebird");
const _ = require("lodash");

const ContactProperty = require("./contact-property");
const Mapping = require("./mapping");
const HubspotAgent = require("../hubspot-agent");

class SyncAgent {

  constructor(hubspotAgent: HubspotAgent, ctx) {
    const { client, ship, metric, helpers, segments } = ctx;
    this.hubspotAgent = hubspotAgent;
    this.client = client;
    this.hubspotClient = hubspotAgent.hubspotClient;
    this.ship = ship;
    this.metric = metric;
    this.helpers = helpers;
    this.logger = client.logger;
    this.segments = segments;

    this.contactProperty = new ContactProperty(this.hubspotClient, { logger: this.logger });
    this.mapping = new Mapping(ship, client);
  }

  isConfigured() {
    return this.ship.private_settings && !_.isEmpty(this.ship.private_settings.token);
  }

  /**
   * Reconcilation of the ship settings
   * @return {Promise}
   */
  setupShip() {
    return Promise.all([
      this.syncContactProperties()
    ]).spread((hubspotProperties) => {
      return { hubspotProperties };
    });
  }

  migrateSettings() {
    const mapping = this.ship.private_settings.sync_fields_to_hubspot;
    const stringSettings = _.filter(mapping, _.isString);

    if (stringSettings.length === 0) {
      return Promise.resolve("ok");
    }

    const newSettings = mapping.map((hullTrait) => {
      if (_.isObject(hullTrait)) {
        return hullTrait;
      }
      const label = hullTrait
        .replace(/^traits_/, "")
        .replace(/\//, "_")
        .split("_")
        .map(_.upperFirst)
        .join(" ");
      return { hull: hullTrait, name: label, overwrite: false };
    });

    if (_.isEqual(newSettings, mapping)) {
      return Promise.resolve("ok");
    }

    return this.helpers.updateSettings({
      sync_fields_to_hubspot: newSettings
    });
  }

  /**
   * makes sure hubspot is properly configured to receive custom properties and segments list
   * @return {Promise}
   */
  syncContactProperties() {
    const customProps = this.mapping.map.to_hubspot;
    return Promise.all([
      this.segments,
      this.hubspotAgent.retryUnauthorized(() => {
        return this.hubspotClient.get("/contacts/v2/groups").query({ includeProperties: true });
      }),
      this.client.utils.properties.get()
    ]).then(([segments = [], groupsResponse = {}, hullProperties = {}]) => {
      const groups = (groupsResponse && groupsResponse.body) || [];
      const properties = _.reduce(customProps, (props, customProp) => {
        const hullProp = _.find(hullProperties, { id: customProp.hull });
        props.push(_.merge({}, customProp, _.pick(hullProp, ["type"])));
        return props;
      }, []);
      return this.contactProperty.sync({
        segments, groups, properties
      }).then(() => groups);
    });
  }

  shouldSyncUser(user) {
    const segmentIds = this.ship.private_settings.synchronized_segments || [];
    if (segmentIds.length === 0) {
      return true;
    }
    return _.intersection(segmentIds, user.segment_ids).length > 0
      && !_.isEmpty(user.email);
  }

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
    return this.setupShip()
      .then(({ hubspotProperties }) => {
        return Promise.all(contacts.map((c) => {
          const traits = this.mapping.getHullTraits(hubspotProperties, c);
          if (!traits.email) {
            return this.logger.info("incoming.user.skip", { contact: c });
          }
          const ident = this.mapping.getIdentFromHubspot(c);
          this.logger.debug("incoming.user", { ident, traits });
          let asUser;
          try {
            asUser = this.client.asUser(ident);
          } catch (error) {
            return this.logger.info("incoming.user.skip", { contact: c, error });
          }
          return asUser.traits(traits)
            .then(
              () => asUser.logger.info("incoming.user.success", { traits }),
              (error) => asUser.logger.error("incoming.user.error", {
                hull_summary: `Fetching data from Hubspot returned an error: ${_.get(error, "message", "")}`,
                traits,
                errors: error
              })
            );
        }));
      });
  }

  userWhitelisted(user) {
    const segmentIds = _.get(this.ship, "private_settings.synchronized_segments", []);
    if (segmentIds.length === 0) {
      return true;
    }
    return _.intersection(segmentIds, user.segment_ids).length > 0;
  }
}

module.exports = SyncAgent;
