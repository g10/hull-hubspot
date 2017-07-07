import _ from "lodash";
import moment from "moment";

import { getMap } from "./mapping-data";

export default class Mapping {
  constructor(ship, client) {
    this.ship = ship;
    this.client = client;
    this.logger = client.logger;
    this.map = getMap(ship);
  }

  /**
   * Returns the Hubspot properties names.
   * When doing a sync we need to download only those
   * @return {Array}
   */
  getHubspotPropertiesKeys() {
    return this.map.to_hull.map(prop => prop.name);
  }

  /**
   * Returns the Hull traits names.
   * Useful when doing request extract calls
   * @return {Array}
   */
  getHullTraitsKeys() {
    return this.map.to_hubspot.map(prop => prop.hull);
  }


  /**
   * Finds matching Hubspot Property for provided Hull Attribute.
   * Tries to match name directly, if not found tries the version without hull_prefix
   * to check if this is an existing field.
   * @param  {Array} hubspotProperties
   * @param  {Object} prop
   * @return {Boolean}
   */
  findHubspotProp(hubspotProperties, prop) {
    return _.find(_.flatten(hubspotProperties.map(g => g.properties)), { name: prop.name })
      || _.find(_.flatten(hubspotProperties.map(g => g.properties)), { name: prop.name.replace(/^hull_/, "") });
  }

  /**
   * Maps Hubspot contact properties to Hull traits
   * @param  {Object} userData Hubspot contact
   * @return {Object}          Hull user traits
   */
  getHullTraits(hubspotProperties, userData) {
    const hullTraits = _.reduce(this.map.to_hull, (traits, prop) => {
      const hubspotProp = this.findHubspotProp(hubspotProperties, prop);
      if (!hubspotProp) {
        this.client.asUser(_.pick(userData, ["id", "external_id", "email"])).logger.warn("incoming.user.warning", { warning: "cannot find mapped hubspot property", prop });
      }
      if (userData.properties && _.has(userData.properties, prop.name)) {
        let val = _.get(userData, `properties[${prop.name}].value`);
        if (prop.type === "number") {
          const numVal = parseFloat(val);
          if (!isNaN(val)) {
            val = numVal;
          }
        }

        if (hubspotProp && hubspotProp.type === "enumeration"
          && hubspotProp.fieldType === "checkbox") {
          val = val.split(";");
        }
        traits[prop.hull] = val;
      }
      return traits;
    }, {});

    hullTraits["hubspot/id"] = userData["canonical-vid"] || userData.vid;

    if (hullTraits["hubspot/first_name"]) {
      hullTraits.first_name = { operation: "setIfNull", value: hullTraits["hubspot/first_name"] };
    }

    if (hullTraits["hubspot/last_name"]) {
      hullTraits.last_name = { operation: "setIfNull", value: hullTraits["hubspot/last_name"] };
    }

    return hullTraits;
  }

  /**
   * Maps Hull user data to Hubspot contact properties.
   * It sends only the properties which are not read only - this is controlled
   * by the mapping.
   * @see http://developers.hubspot.com/docs/methods/contacts/update_contact
   * @param  {Object} userData Hull user object
   * @return {Array}           Hubspot properties array
   */
  getHubspotProperties(segments, hubspotProperties, userData) {
    const contactProps = _.reduce(this.map.to_hubspot, (props, prop) => {
      const hubspotProp = this.findHubspotProp(hubspotProperties, prop);
      const userIdent = _.pick(userData, ["id", "external_id", "email"]);

      if (!hubspotProp) {
        this.client.asUser(userIdent).logger.warn("outgoing.user.warning", { warning: "cannot find mapped hubspot property", prop });
        return props;
      }

      let value = _.has(userData, prop.hull)
        ? _.get(userData, prop.hull)
        : _.get(userData, `traits_${prop.hull}`);

      if (!_.get(prop, "overwrite") && _.get(prop, "default")) {
        value = _.has(userData, _.get(prop, "default.hull"))
          ? _.get(userData, _.get(prop, "default.hull"))
          : value;
      }

      if (/_at$|date$/.test(prop.hull) || hubspotProp.type === "datetime") {
        const dateValue = new Date(value).getTime();
        if (dateValue) value = dateValue;
      }

      if (_.isArray(value)) {
        value = value.join(";");
      }

      if (value && hubspotProp && hubspotProp.type === "date") {
        // try to parse the date/time to date only
        if (moment(value).isValid()) {
          value = moment(value).hours(0).minutes(0).seconds(0)
            .format("x");
        } else {
          this.client.asUser(userIdent).logger.warn("outgoing.user.warning", { warning: "cannot parse datetime trait to date", prop });
        }
      }

      if (!_.isNil(value) && value !== "" && prop.read_only !== false) {
        props.push({
          property: hubspotProp.name,
          value
        });
      }
      return props;
    }, []);

    const userSegments = userData.segment_ids || [];
    const segmentNames = userSegments.map((segmentId) => {
      return _.trim(_.get(_.find(segments, { id: segmentId }), "name"));
    });

    contactProps.push({
      property: "hull_segments",
      value: segmentNames.join(";")
    });

    return contactProps;
  }

  /**
   * Prepares a Hull User resolution object for `hull.as` method.
   * @param  {Object} hubspotUser
   * @return {Object}
   */
  getIdentFromHubspot(hubspotUser) {
    const ident = {};

    if (_.get(hubspotUser, "properties.email.value")) {
      ident.email = _.get(hubspotUser, "properties.email.value");
    }

    if (hubspotUser.vid) {
      ident.anonymous_id = `hubspot:${hubspotUser.vid}`;
    }
    return ident;
  }
}
