import Promise from "bluebird";
import _ from "lodash";

import ContactProperty from "./contact-property";
import Mapping from "./mapping";

export default class SyncAgent {

  constructor(hullAgent, hubspotAgent, ship, instrumentationAgent) {
    this.hullAgent = hullAgent;
    this.hubspotAgent = hubspotAgent;
    this.hubspotClient = hubspotAgent.hubspotClient;
    this.ship = ship;
    this.instrumentationAgent = instrumentationAgent;
    this.logger = hullAgent.hullClient.logger;

    this.contactProperty = new ContactProperty(this.hubspotClient, { logger: this.hullAgent.hullClient.logger });
    this.mapping = new Mapping(ship);
  }

  isConfigured() {
    return !_.isEmpty(this.ship.private_settings.token);
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

    const newSettings = mapping.map(hullTrait => {
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

    return this.hullAgent.updateShipSettings({
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
      this.hullAgent.getSegments(),
      this.hubspotAgent.retryUnauthorized(() => {
        return this.hubspotClient.get("/contacts/v2/groups").query({ includeProperties: true });
      }),
      this.hullAgent.getAvailableProperties()
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
   * @param  {Array} Hubspot contacts
   * @return {Promise}
   */
  saveContacts(hubspotProperties, contacts) {
    this.logger.info("saveContacts", contacts.length);
    return Promise.all(contacts.map((c) => {
      const traits = this.mapping.getHullTraits(hubspotProperties, c);
      if (!traits.email) {
        return "";
      }
      const ident = this.mapping.getIdentFromHubspot(c);
      this.logger.debug("incoming.user", { ident, traits });
      return this.hullAgent.hullClient.as(ident).traits(traits);
    }));
  }
}
