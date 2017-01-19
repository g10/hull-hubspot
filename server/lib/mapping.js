import _ from "lodash";
import { getMap } from "./mapping-data";

export default class Mapping {
  constructor(ship) {
    this.ship = ship;
    this.map = getMap(ship);
  }

  /**
   * Returns the Hubspot properties names.
   * When doing a sync we need to download only those
   * @return {Array}
   */
  getHubspotPropertiesKeys() {
    return this.map.to_hull.map((prop) => prop.name);
  }

  /**
   * Returns the Hull traits names.
   * Useful when doing request extract calls
   * @return {Array}
   */
  getHullTraitsKeys() {
    return this.map.to_hubspot.map((prop) => prop.hull);
  }


  /**
   * Maps Hubspot contact properties to Hull traits
   * @param  {Object} userData Hubspot contact
   * @return {Object}          Hull user traits
   */
  getHullTraits(userData) {
    const hullTraits = _.reduce(this.map.to_hull, (traits, prop) => {
      if (userData.properties && _.has(userData.properties, prop.name)) {
        let val = _.get(userData, `properties[${prop.name}].value`);
        if (prop.type === "number") {
          const numVal = parseFloat(val);
          if (!isNaN(val)) {
            val = numVal;
          }
        }
        traits[prop.hull] = val;
      }
      return traits;
    }, {});

    hullTraits["hubspot/vid"] = userData.vid;

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
  getHubspotProperties(segments, userData) {
    const contactProps = _.reduce(this.map.to_hubspot, (props, prop) => {
      let value = _.get(userData, prop.hull) || _.get(userData, `traits_${prop.hull}`);
      if (/_at$|date$/.test(prop.hull)) {
        const dateValue = new Date(value).getTime();
        if (dateValue) value = dateValue;
      }
      if (value && prop.read_only !== false) {
        props.push({
          property: prop.name,
          value
        });
      }
      return props;
    }, []);

    const userSegments = userData.segment_ids || [];
    const segmentNames = userSegments.map(segmentId => {
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
