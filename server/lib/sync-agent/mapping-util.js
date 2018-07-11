// @flow
import type {
  THullUser,
  THullUserIdent,
  THullAttributes,
  THullConnector,
  THullSegment
} from "hull";
import type {
  HubspotWriteContact,
  HubspotWriteProperties,
  HubspotReadContact,
  HubspotContactOutboundMapping,
  HubspotContactAttributesOutboundSetting,
  HubspotContactAttributesInboundSetting,
  HubspotContactInboundMapping,
  HubspotContactProperty,
  HullProperty
} from "../../types";

const _ = require("lodash");
const moment = require("moment");
const slug = require("slug");
const debug = require("debug")("hull-hubspot:mapping-util");

const DEFAULT_MAPPING = require("./default-mapping");

class MappingUtil {
  connector: THullConnector;
  hullClient: Object;
  logger: Object;
  usersSegments: Array<THullSegment>;

  hubspotProperties: Array<HubspotContactProperty>;
  hullProperties: Array<HullProperty>;
  contactAttributesInboundSettings: Array<
    HubspotContactAttributesInboundSetting
  >;
  contactAttributesOutboundSettings: Array<
    HubspotContactAttributesOutboundSetting
  >;

  constructor({
    connector,
    hullClient,
    usersSegments,
    hubspotProperties,
    hullProperties
  }: Object) {
    this.connector = connector;
    this.hullClient = hullClient;
    this.logger = hullClient.logger;
    this.usersSegments = usersSegments;
    this.hubspotProperties = hubspotProperties;
    this.hullProperties = hullProperties;
    this.contactAttributesInboundSettings =
      this.connector.private_settings.sync_fields_to_hull || [];
    this.contactAttributesOutboundSettings =
      this.connector.private_settings.sync_fields_to_hubspot || [];
  }

  getContactOutboundMapping(): Array<HubspotContactOutboundMapping> {
    return this.contactAttributesOutboundSettings.reduce(
      (outboundMapping, setting) => {
        if (!setting.name || !setting.hull) {
          return outboundMapping;
        }
        const hubspotPropertyNameSlug = slug(setting.name, {
          replacement: "_",
          lower: true
        });
        const hubspotPropertyName = `hull_${hubspotPropertyNameSlug}`;

        const defaultMapping = _.find(DEFAULT_MAPPING, { name: setting.name });
        const hullTrait = _.find(this.hullProperties, { id: setting.hull });
        const hubspotContactProperty = _.find(
          _.flatten(_.map(this.hubspotProperties, "properties")),
          {
            name: hubspotPropertyName
          }
        );

        if (hullTrait === undefined || hubspotContactProperty === undefined) {
          return outboundMapping;
        }

        return outboundMapping.concat([
          {
            hull_trait_name: setting.hull,
            hull_default_trait_name:
              (defaultMapping && defaultMapping.name) || null,
            hull_trait_type: hullTrait.type,
            hull_overwrite_hubspot: setting.overwrite,
            hubspot_property_name: hubspotPropertyName,
            hubspot_property_label: setting.name,
            hubspot_property_read_only: hubspotContactProperty.readOnlyValue,
            hubspot_property_type: hubspotContactProperty.type,
            hubspot_property_field_type: hubspotContactProperty.fieldType,
            hubspot_property_display_order: hubspotContactProperty.displayOrder
          }
        ]);
      },
      []
    );
  }

  getContactInboundMapping(): Array<HubspotContactInboundMapping> {
    const mappingFromDefault = DEFAULT_MAPPING.reduce(
      (mapping, defaultMapping) => {
        const hullTrait = _.find(this.hullProperties, {
          id: defaultMapping.hull
        });
        const hubspotContactProperty = _.find(this.hubspotProperties, {
          name: defaultMapping.name
        });

        if (hullTrait === undefined || hubspotContactProperty === undefined) {
          return mapping;
        }
        return mapping.concat([
          {
            hull_trait_name: defaultMapping.hull,
            hull_trait_type: hullTrait.type,
            hubspot_property_name: defaultMapping.name,
            hubspot_property_read_only: hubspotContactProperty.readOnlyValue,
            hubspot_property_type: hubspotContactProperty.type,
            hubspot_property_field_type: hubspotContactProperty.fieldType
          }
        ]);
      },
      []
    );
    const mappingFromSettings = this.contactAttributesInboundSettings.reduce(
      (mapping, setting) => {
        if (!setting.name || !setting.hull) {
          return mapping;
        }
        const hullTrait = _.find(this.hullProperties, { id: setting.hull });
        const hubspotContactProperty = _.find(this.hubspotProperties, {
          name: setting.name
        });
        if (hullTrait === undefined || hubspotContactProperty === undefined) {
          return mapping;
        }
        return mapping.concat([
          {
            hull_trait_name: setting.hull,
            hull_trait_type: hullTrait.type,
            hubspot_property_name: setting.name,
            hubspot_property_read_only: hubspotContactProperty.readOnlyValue,
            hubspot_property_type: hubspotContactProperty.type,
            hubspot_property_field_type: hubspotContactProperty.fieldType
          }
        ]);
      },
      []
    );
    return mappingFromDefault.concat(mappingFromSettings);
  }

  /**
   * Returns the Hubspot properties names.
   * When doing a sync we need to download only those
   * @return {Array}
   */
  getHubspotPropertiesKeys(): Array<string> {
    return this.getContactInboundMapping().map(
      prop => prop.hubspot_property_name
    );
  }

  /**
   * Returns the Hull traits names.
   * Useful when doing request extract calls
   * @return {Array}
   */
  getHullTraitsKeys(): Array<string> {
    return this.getContactOutboundMapping().map(prop => prop.hull_trait_name);
  }

  /**
   * Prepares a Hull User resolution object for `hull.as` method.
   * @param  {Object} hubspotUser
   * @return {Object}
   */
  getIdentFromHubspot(hubspotUser: HubspotReadContact): THullUserIdent {
    const ident: THullUserIdent = {};

    if (_.get(hubspotUser, "properties.email.value")) {
      ident.email = _.get(hubspotUser, "properties.email.value");
    }

    if (hubspotUser.vid) {
      ident.anonymous_id = `hubspot:${hubspotUser.vid}`;
    }
    return ident;
  }

  /**
   * Maps Hubspot contact properties to Hull traits
   * @param  {Object} userData Hubspot contact
   * @return {Object}          Hull user traits
   */
  getHullTraits(userData: HubspotReadContact): THullAttributes {
    const hullTraits = _.reduce(
      this.getContactInboundMapping(),
      (traits, mappingEntry) => {
        // const hubspotProp = this.findHubspotProp(hubspotProperties, prop);
        if (!mappingEntry.hubspot_property_name) {
          this.hullClient
            .asUser(_.pick(userData, ["id", "external_id", "email"]))
            .logger.warn("incoming.user.warning", {
              warning: "cannot find mapped hubspot property",
              mappingEntry
            });
        }
        if (
          userData.properties &&
          _.has(userData.properties, mappingEntry.hubspot_property_name)
        ) {
          let val = _.get(
            userData,
            `properties[${mappingEntry.hubspot_property_name}].value`
          );
          if (mappingEntry.hubspot_property_type === "number") {
            const numVal = parseFloat(val);
            // eslint-disable-next-line no-restricted-globals
            if (!isNaN(val)) {
              val = numVal;
            }
          }

          if (
            mappingEntry.hubspot_property_type === "enumeration" &&
            mappingEntry.hubspot_property_field_type === "checkbox" &&
            typeof val === "string"
          ) {
            val = val.split(";");
          }
          traits[mappingEntry.hull_trait_name] = val;
        }
        return traits;
      },
      {}
    );

    hullTraits["hubspot/id"] = userData["canonical-vid"] || userData.vid;

    if (hullTraits["hubspot/first_name"]) {
      hullTraits.first_name = {
        operation: "setIfNull",
        value: hullTraits["hubspot/first_name"]
      };
    }

    if (hullTraits["hubspot/last_name"]) {
      hullTraits.last_name = {
        operation: "setIfNull",
        value: hullTraits["hubspot/last_name"]
      };
    }
    debug("getHullTraits", hullTraits);
    return hullTraits;
  }

  getHubspotContact(userData: THullUser): HubspotWriteContact {
    const hubspotWriteProperties = this.getHubspotProperties(userData);
    const hubspotWriteContact: HubspotWriteContact = {
      properties: hubspotWriteProperties
    };
    if (userData["hubspot/id"] && typeof userData["hubspot/id"] === "string") {
      hubspotWriteContact.vid = userData["hubspot/id"];
    } else {
      hubspotWriteContact.email = userData.email;
    }
    return hubspotWriteContact;
  }

  /**
   * Maps Hull user data to Hubspot contact properties.
   * It sends only the properties which are not read only - this is controlled
   * by the mapping.
   * @see http://developers.hubspot.com/docs/methods/contacts/update_contact
   * @param  {Object} userData Hull user object
   * @return {Array}           Hubspot properties array
   */
  getHubspotProperties(userData: THullUser): HubspotWriteProperties {
    debug("getHubspotProperties", this.getContactOutboundMapping());
    // const userSegments = this.userSegments;
    const contactProps = _.reduce(
      this.getContactOutboundMapping(),
      (contactProperties, mappingEntry) => {
        // const hubspotProp = this.findHubspotProp(hubspotProperties, prop);
        const userIdent = _.pick(userData, ["id", "external_id", "email"]);

        if (!mappingEntry.hubspot_property_name) {
          this.hullClient
            .asUser(userIdent)
            .logger.warn("outgoing.user.warning", {
              warning: "cannot find mapped hubspot property",
              mappingEntry
            });
          return contactProperties;
        }

        let value = _.has(userData, mappingEntry.hull_trait_name)
          ? _.get(userData, mappingEntry.hull_trait_name)
          : _.get(userData, `traits_${mappingEntry.hull_trait_name}`);

        if (
          !mappingEntry.hull_overwrite_hubspot &&
          mappingEntry.hull_default_trait_name
        ) {
          value = _.has(
            userData,
            `traits_${_.get(mappingEntry, "hull_default_trait_name")}`
          )
            ? _.get(
                userData,
                `traits_${_.get(mappingEntry, "hull_default_trait_name")}`
              )
            : value;
        }

        if (
          /_at$|date$/.test(mappingEntry.hull_trait_name) ||
          mappingEntry.hubspot_property_type === "datetime"
        ) {
          const dateValue = new Date(value).getTime();
          if (dateValue) value = dateValue;
        }

        if (Array.isArray(value)) {
          value = value.join(";");
        }

        if (value && mappingEntry.hubspot_property_type === "date") {
          // try to parse the date/time to date only
          if (moment(value).isValid()) {
            value = moment(value)
              .hours(0)
              .minutes(0)
              .seconds(0)
              .format("x");
          } else {
            this.hullClient
              .asUser(userIdent)
              .logger.warn("outgoing.user.warning", {
                warning: "cannot parse datetime trait to date",
                mappingEntry
              });
          }
        }

        if (
          !_.isNil(value) &&
          value !== "" &&
          mappingEntry.hubspot_property_read_only !== false
        ) {
          contactProperties.push({
            property: mappingEntry.hubspot_property_name,
            value
          });
        }
        return contactProperties;
      },
      []
    );

    const userSegments: Array<string> = Array.isArray(userData.segment_ids)
      ? userData.segment_ids
      : [];
    debug("userSegments", userData.segment_ids);
    const segmentNames = _.uniq(
      userSegments.map(segmentId => {
        return _.trim(
          _.get(_.find(this.usersSegments, { id: segmentId }), "name")
        );
      })
    );
    debug("segmentNames", segmentNames);

    contactProps.push({
      property: "hull_segments",
      value: segmentNames.join(";")
    });

    return contactProps;
  }
}

module.exports = MappingUtil;
