// @flow
import type {
  THullUserIdent,
  THullAccountIdent,
  THullAttributes,
  THullSegment,
  THullUserUpdateMessage,
  THullAccountUpdateMessage
} from "hull";

import type {
  HubspotWriteContact,
  HubspotWriteContactProperties,
  HubspotWriteCompany,
  HubspotWriteCompanyProperties,
  HubspotReadContact,
  HubspotReadCompany,
  HubspotContactOutgoingMapping,
  HubspotContactAttributesOutgoingSetting,
  HubspotContactAttributesIncomingSetting,
  HubspotContactIncomingMapping,
  HubspotContactProperty,
  HubspotCompanyOutgoingMapping,
  HubspotCompanyIncomingMapping,
  HubspotCompanyAttributesIncomingSetting,
  HubspotCompanyAttributesOutgoingSetting,
  HubspotCompanyProperty,
  HullProperties,
  MappingUtilConfiguration,
  MappingResult,
  HubspotAccountUpdateMessageEnvelope,
  HubspotUserUpdateMessageEnvelope,
  HubspotReadMultipleContactMap
} from "../../types";

const _ = require("lodash");
const moment = require("moment");
const slug = require("slug");
const debug = require("debug")("hull-hubspot:mapping-util");

const CONTACT_DEFAULT_MAPPING = require("./contact-default-mapping");
const COMPANY_DEFAULT_MAPPING = require("./company-default-mapping");

class MappingUtil {
  // connector: THullConnector;
  //hullClient: Object;
  // logger: Object;
  usersSegments: Array<THullSegment>;
  accountsSegments: Array<THullSegment>;

  hubspotContactProperties: Array<HubspotContactProperty>;
  hubspotCompanyProperties: Array<HubspotCompanyProperty>;
  hullUserProperties: HullProperties;
  hullAccountProperties: HullProperties;

  contactAttributesIncomingSettings: Array<
    HubspotContactAttributesIncomingSetting
  >;
  contactAttributesOutgoingSettings: Array<
    HubspotContactAttributesOutgoingSetting
  >;

  companyAttributesIncomingSettings: Array<
    HubspotCompanyAttributesIncomingSetting
  >;
  companyAttributesOutgoingSettings: Array<
    HubspotCompanyAttributesOutgoingSetting
  >;

  outgoingLinking: boolean;

  contactOutgoingMapping: Array<HubspotContactOutgoingMapping>;
  contactIncomingMapping: Array<HubspotContactIncomingMapping>;

  companyOutgoingMapping: Array<HubspotCompanyOutgoingMapping>;
  companyIncomingMapping: Array<HubspotCompanyIncomingMapping>;

  incomingAccountIdentHull: string;
  incomingAccountIdentService: string;

  constructor(config: MappingUtilConfiguration) {
    // this.connector = connector;
    // this.hullClient = hullClient;
    // this.logger = hullClient.logger;
    this.usersSegments = config.usersSegments;
    this.accountsSegments = config.accountsSegments;
    this.hubspotContactProperties = _.flatten(
      config.hubspotContactPropertyGroups.map(group => group.properties)
    );
    this.hubspotCompanyProperties = _.flatten(
      config.hubspotCompanyPropertyGroups.map(group => group.properties)
    );
    this.hullUserProperties = config.hullUserProperties;
    this.hullAccountProperties = config.hullAccountProperties;

    // pick stuff from private settings
    this.contactAttributesIncomingSettings =
      config.connectorSettings.sync_fields_to_hull || [];
    this.contactAttributesOutgoingSettings =
      config.connectorSettings.sync_fields_to_hubspot || [];

    this.companyAttributesIncomingSettings =
      config.connectorSettings.incoming_account_attributes || [];
    this.companyAttributesOutgoingSettings =
      config.connectorSettings.outgoing_account_attributes || [];

    this.incomingAccountIdentHull = _.get(
      config,
      "connectorSettings.incoming_account_ident_hull",
      "domain"
    );
    this.incomingAccountIdentService = _.get(
      config,
      "connectorSettings.incoming_account_ident_service",
      "domain"
    );
    this.outgoingLinking = _.get(
      config,
      "connectorSettings.link_users_in_service",
      false
    );

    this.contactOutgoingMapping = this.getContactOutgoingMapping();
    this.contactIncomingMapping = this.getContactIncomingMapping();

    this.companyOutgoingMapping = this.getCompanyOutgoingMapping();
    this.companyIncomingMapping = this.getCompanyIncomingMapping();
  }

  getContactOutgoingMapping(): Array<HubspotContactOutgoingMapping> {
    const mappingFromDefault = CONTACT_DEFAULT_MAPPING.reduce(
      (mapping, defaultMapping) => {
        const hullTrait = this.hullUserProperties[defaultMapping.hull];
        const hubspotContactProperty = _.find(this.hubspotContactProperties, {
          name: defaultMapping.name
        });

        if (hubspotContactProperty === undefined) {
          return mapping;
        }
        return mapping.concat([
          {
            hull_trait_name: defaultMapping.hull,
            hull_default_trait_name:
              (defaultMapping && defaultMapping.name) || null,
            hull_trait_type: _.get(hullTrait, "type", undefined),
            hull_overwrite_hubspot: true,
            hubspot_property_name: defaultMapping.name,
            hubspot_property_label: defaultMapping.name,
            hubspot_property_read_only:
              hubspotContactProperty && hubspotContactProperty.readOnlyValue,
            hubspot_property_type:
              hubspotContactProperty && hubspotContactProperty.type,
            hubspot_property_field_type:
              hubspotContactProperty && hubspotContactProperty.fieldType,
            hubspot_property_display_order:
              hubspotContactProperty && hubspotContactProperty.displayOrder
          }
        ]);
      },
      []
    );

    const mappingFromSettings = this.contactAttributesOutgoingSettings.reduce(
      (outboundMapping, setting) => {
        if (!setting.name || !setting.hull) {
          return outboundMapping;
        }
        // let's find a default mapping
        const defaultMapping = _.find(CONTACT_DEFAULT_MAPPING, {
          name: setting.name
        });

        // let's generate a slug version of the hubspot property
        let hubspotPropertyName = slug(setting.name, {
          replacement: "_",
          lower: true
        });

        // let's try to find an existing contact property directly by slug
        let hubspotContactProperty = _.find(this.hubspotContactProperties, {
          name: hubspotPropertyName
        });

        // if we couldn't find the existing contact property
        // we will prepend it with `hull_` and see if this was
        // a property created by this connector
        if (hubspotContactProperty === undefined) {
          hubspotPropertyName =
            (defaultMapping && defaultMapping.name) ||
            `hull_${hubspotPropertyName}`;
          hubspotContactProperty = _.find(this.hubspotContactProperties, {
            name: hubspotPropertyName
          });
        }

        const hullTrait = _.find(this.hullUserProperties, { id: setting.hull });
        if (hullTrait === undefined) {
          return outboundMapping;
        }

        return outboundMapping.concat([
          {
            hull_trait_name: setting.hull,
            hull_default_trait_name:
              (defaultMapping && defaultMapping.hull) || null,
            hull_trait_type: hullTrait.type,
            hull_overwrite_hubspot: setting.overwrite,
            hubspot_property_name: hubspotPropertyName,
            hubspot_property_label: setting.name,
            hubspot_property_read_only:
              hubspotContactProperty && hubspotContactProperty.readOnlyValue,
            hubspot_property_type:
              hubspotContactProperty && hubspotContactProperty.type,
            hubspot_property_field_type:
              hubspotContactProperty && hubspotContactProperty.fieldType,
            hubspot_property_display_order:
              hubspotContactProperty && hubspotContactProperty.displayOrder
          }
        ]);
      },
      []
    );
    return mappingFromDefault.concat(mappingFromSettings);
  }

  getContactIncomingMapping(): Array<HubspotContactIncomingMapping> {
    const mappingFromDefault = CONTACT_DEFAULT_MAPPING.reduce(
      (mapping, defaultMapping) => {
        const hullTrait = this.hullUserProperties[defaultMapping.hull];
        const hubspotContactProperty = _.find(this.hubspotContactProperties, {
          name: defaultMapping.name
        });

        if (hubspotContactProperty === undefined) {
          return mapping;
        }
        return mapping.concat([
          {
            hull_trait_name: defaultMapping.hull,
            hull_trait_type: hullTrait && hullTrait.type,
            hubspot_property_name: defaultMapping.name,
            hubspot_property_read_only: hubspotContactProperty.readOnlyValue,
            hubspot_property_type: hubspotContactProperty.type,
            hubspot_property_field_type: hubspotContactProperty.fieldType
          }
        ]);
      },
      []
    );
    const mappingFromSettings = this.contactAttributesIncomingSettings.reduce(
      (mapping, setting) => {
        if (!setting.name || !setting.hull) {
          return mapping;
        }
        const hullTrait = this.hullUserProperties[setting.hull];
        const hubspotContactProperty = _.find(this.hubspotContactProperties, {
          name: setting.name
        });
        if (hubspotContactProperty === undefined) {
          return mapping;
        }
        return mapping.concat([
          {
            hull_trait_name: setting.hull,
            hull_trait_type: hullTrait && hullTrait.type,
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

  getCompanyOutgoingMapping(): Array<HubspotCompanyOutgoingMapping> {
    return this.companyAttributesOutgoingSettings.reduce(
      (outboundMapping, setting) => {
        if (!setting.hubspot || !setting.hull) {
          return outboundMapping;
        }

        const defaultMapping = _.find(COMPANY_DEFAULT_MAPPING, {
          hubspot: setting.hubspot
        });

        // let's generate a slug version of the hubspot property
        let hubspotPropertyName = slug(setting.hubspot, {
          replacement: "_",
          lower: true
        });

        // let's try to find an existing contact property directly by slug
        let hubspotCompanyProperty = _.find(this.hubspotCompanyProperties, {
          name: hubspotPropertyName
        });

        // if we couldn't find the existing contact property
        // we will prepend it with `hull_` and see if this was
        // a property created by this connector
        if (hubspotCompanyProperty === undefined) {
          hubspotPropertyName =
            (defaultMapping && defaultMapping.hubspot) ||
            `hull_${hubspotPropertyName}`;
          hubspotCompanyProperty = _.find(this.hubspotCompanyProperties, {
            name: hubspotPropertyName
          });
        }

        const hullTrait = _.find(this.hullAccountProperties, {
          id: setting.hull.replace("account.", "")
        });

        if (hullTrait === undefined) {
          return outboundMapping;
        }

        return outboundMapping.concat([
          {
            hull_trait_name: setting.hull,
            hull_default_trait_name:
              (defaultMapping && defaultMapping.hull) || null,
            hull_trait_type: hullTrait.type,
            hull_overwrite_hubspot: setting.overwrite,
            hubspot_property_name: hubspotPropertyName,
            hubspot_property_label: setting.hubspot,
            hubspot_property_read_only:
              hubspotCompanyProperty && hubspotCompanyProperty.readOnlyValue,
            hubspot_property_type:
              hubspotCompanyProperty && hubspotCompanyProperty.type,
            hubspot_property_field_type:
              hubspotCompanyProperty && hubspotCompanyProperty.fieldType,
            hubspot_property_display_order:
              hubspotCompanyProperty && hubspotCompanyProperty.displayOrder
          }
        ]);
      },
      []
    );
  }

  getCompanyIncomingMapping(): Array<HubspotCompanyIncomingMapping> {
    const mappingFromDefault = COMPANY_DEFAULT_MAPPING.reduce(
      (mapping, defaultMapping) => {
        const hullTrait = this.hullAccountProperties[defaultMapping.hull];
        const hubspotCompanyProperty = _.find(this.hubspotCompanyProperties, {
          name: defaultMapping.hubspot
        });
        if (hubspotCompanyProperty === undefined) {
          return mapping;
        }
        return mapping.concat([
          {
            hull_trait_name: defaultMapping.hull,
            hull_trait_type: hullTrait && hullTrait.type,
            hubspot_property_name: defaultMapping.hubspot,
            hubspot_property_read_only: hubspotCompanyProperty.readOnlyValue,
            hubspot_property_type: hubspotCompanyProperty.type,
            hubspot_property_field_type: hubspotCompanyProperty.fieldType
          }
        ]);
      },
      []
    );
    const mappingFromSettings = this.companyAttributesIncomingSettings.reduce(
      (mapping, setting) => {
        if (!setting.hubspot || !setting.hull) {
          return mapping;
        }
        const hullTrait = this.hullAccountProperties[setting.hull];
        const hubspotCompanyProperty = _.find(this.hubspotCompanyProperties, {
          name: setting.hubspot
        });
        if (hubspotCompanyProperty === undefined) {
          return mapping;
        }
        return mapping.concat([
          {
            hull_trait_name: setting.hull,
            hull_trait_type: hullTrait && hullTrait.type,
            hubspot_property_name: setting.hubspot,
            hubspot_property_read_only: hubspotCompanyProperty.readOnlyValue,
            hubspot_property_type: hubspotCompanyProperty.type,
            hubspot_property_field_type: hubspotCompanyProperty.fieldType
          }
        ]);
      },
      []
    );
    return mappingFromDefault.concat(mappingFromSettings);
  }

  /**
   * Should probably try to detect undefined and hull hull_overwrite_hubspot too
   * Not sure what the platform will have in those cases...
   */
  contactOutgoingMappingAllOverwrite(): boolean {
    return _.every(this.contactOutgoingMapping, { hull_overwrite_hubspot: true });
  }

  companyOutgoingMappingNoOverwriteAttributes(): Array<string> {
    return _.reduce(this.companyOutgoingMapping,
      (noOverwriteAttributes, value) => {
        if (!value.hull_overwrite_hubspot) {
          noOverwriteAttributes.push(value);
        }
      },
    []);
  }
  /**
   * Returns the Hubspot properties names.
   * When doing a sync we need to download only those
   * @return {Array}
   */
  getHubspotContactPropertiesKeys(): Array<string> {
    return this.contactIncomingMapping.map(prop => prop.hubspot_property_name);
  }

  /**
   * Returns the Hull traits names.
   * Useful when doing request extract calls
   * @return {Array}
   */
  getHullUserTraitsKeys(): Array<string> {
    return this.contactOutgoingMapping.map(prop => prop.hull_trait_name);
  }

  getHubspotCompanyPropertiesKeys(): Array<string> {
    return this.companyIncomingMapping.map(prop => prop.hubspot_property_name);
  }

  getHullAccountTraitsKeys(): Array<string> {
    return this.companyOutgoingMapping.map(prop => prop.hull_trait_name);
  }

  /**
   * Returns the user identification attributes for
   * a `hull.asUser` scoped client.
   *
   * @param {HubspotReadContact} hubspotUser The Hubspot contact object.
   * @returns {THullUserIdent} The user identification attributes.
   * @memberof MappingUtil
   */
  getHullUserIdentFromHubspot(hubspotUser: HubspotReadContact): THullUserIdent {
    const ident: THullUserIdent = {};

    const emailIdentity = _.find(
      _.get(hubspotUser, "identity-profiles[0].identities", []),
      { type: "EMAIL" }
    );
    if (emailIdentity !== undefined) {
      ident.email = emailIdentity.value;
    }

    if (_.get(hubspotUser, "properties.email.value")) {
      ident.email = _.get(hubspotUser, "properties.email.value");
    }

    if (hubspotUser.vid) {
      ident.anonymous_id = `hubspot:${hubspotUser.vid}`;
    }
    debug("getIdentFromHubspot", ident);
    return ident;
  }

  /**
   * Returns the account identification attributes for
   * a `hull.asAccount` scoped client.
   *
   * @param {HubspotReadCompany} hubspotCompany The Hubspot company object.
   * @returns {THullAccountIdent} The account identification attributes.
   * @memberof MappingUtil
   */
  getHullAccountIdentFromHubspot(
    hubspotCompany: HubspotReadCompany
  ): THullAccountIdent {
    const ident: THullAccountIdent = {};

    // if we have external_id selected we do external_id AND domain
    // otherwise we do only `domain` which is the only other option
    // for the setting
    if (this.incomingAccountIdentHull === "external_id") {
      const hubspotIdentValue: string = _.get(
        hubspotCompany,
        `properties.${this.incomingAccountIdentService}.value`,
        ""
      );

      if (!_.isNil(hubspotIdentValue) && _.trim(hubspotIdentValue).length > 0) {
        _.set(ident, this.incomingAccountIdentHull, hubspotIdentValue);
      }
    }

    const domainIdentity: string = _.get(
      hubspotCompany,
      "properties.domain.value",
      ""
    );

    if (!_.isNil(domainIdentity) && _.trim(domainIdentity).length > 0) {
      ident.domain = domainIdentity;
    }

    if (hubspotCompany.companyId) {
      ident.anonymous_id = `hubspot:${hubspotCompany.companyId}`;
    }
    debug("getIdentFromHubspot", ident);
    return ident;
  }

  /**
   * Returns the account attributes from a Hubspot company.
   *
   * @param {HubspotReadCompany} hubspotCompany The hubspot company
   * @returns {MappingResult<THullAttributes>} Mapping results for hull account attributes.
   * @memberof MappingUtil
   */
  getHullAccountTraits(
    hubspotCompany: HubspotReadCompany
  ): MappingResult<THullAttributes> {
    const mapResults = {
      warnings: [],
      errors: [],
      result: {}
    };

    const hullTraits = _.reduce(
      this.companyIncomingMapping,
      (traits, mappingEntry) => {
        if (!mappingEntry.hubspot_property_name) {
          mapResults.warnings.push({
            message:
              "Cannot find mapped Hubspot property, see data for details.",
            data: mappingEntry
          });
        }
        if (
          hubspotCompany.properties &&
          _.has(hubspotCompany.properties, mappingEntry.hubspot_property_name)
        ) {
          let val = _.get(
            hubspotCompany,
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
          const nameWithoutPrefix = _.trimStart(
            mappingEntry.hull_trait_name,
            "traits_"
          );
          traits[nameWithoutPrefix] = val;
        }
        return traits;
      },
      {}
    );

    hullTraits["hubspot/id"] = hubspotCompany.companyId;

    const hubspotName = _.get(hubspotCompany, "properties.name.value");
    if (!_.isEmpty(hubspotName)) {
      _.set(hullTraits, "name", {
        value: hubspotName,
        operation: "setIfNull"
      });
    }

    debug("getHullTraits", hullTraits);
    mapResults.result = hullTraits;
    return mapResults;
  }

  /**
   * Returns the user attributes from a Hubspot contact.
   *
   * @param {HubspotReadContact} hubspotContact The hubspot contact
   * @returns {MappingResult<THullAttributes>} Mapping results for hull users attributes
   * @memberof MappingUtil
   */
  getHullUserTraits(
    hubspotContact: HubspotReadContact
  ): MappingResult<THullAttributes> {
    const mapResults = {
      warnings: [],
      errors: [],
      result: {}
    };

    const hullTraits = _.reduce(
      this.contactIncomingMapping,
      (traits, mappingEntry) => {
        if (!mappingEntry.hubspot_property_name) {
          mapResults.warnings.push({
            message:
              "Cannot find mapped Hubspot property, see data for details.",
            data: mappingEntry
          });
        }
        if (
          hubspotContact.properties &&
          _.has(hubspotContact.properties, mappingEntry.hubspot_property_name)
        ) {
          let val = _.get(
            hubspotContact,
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

          const nameWithoutPrefix = _.trimStart(
            mappingEntry.hull_trait_name,
            "traits_"
          );
          traits[nameWithoutPrefix] = val;
        }
        return traits;
      },
      {}
    );

    hullTraits["hubspot/id"] =
      hubspotContact["canonical-vid"] || hubspotContact.vid;

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
    mapResults.result = hullTraits;
    return mapResults;
  }

  getHubspotContact(message: THullUserUpdateMessage): HubspotWriteContact {
    const hubspotWriteProperties = this.getHubspotContactProperties(message);
    const hubspotWriteContact: HubspotWriteContact = {
      properties: hubspotWriteProperties
    };
    if (
      message.user["hubspot/id"] &&
      typeof message.user["hubspot/id"] === "string"
    ) {
      hubspotWriteContact.vid = message.user["hubspot/id"];
    } else {
      hubspotWriteContact.email = message.user.email;
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
  getHubspotContactProperties(
    userMessage: THullUserUpdateMessage
  ): HubspotWriteContactProperties {
    const userData = userMessage.user;
    debug("getHubspotContactProperties", this.contactOutgoingMapping);
    // const userSegments = this.userSegments;
    const contactProps = _.reduce(
      this.contactOutgoingMapping,
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
          mappingEntry.hubspot_property_read_only !== true
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

    // handle segments
    const userSegments: Array<string> = Array.isArray(userMessage.segments)
      ? userMessage.segments
      : [];
    debug("userSegments", userMessage.segments);
    const segmentNames = _.uniq(
      userSegments.map(segment => {
        return _.trim(
          _.get(_.find(this.usersSegments, { id: segment.id }), "name")
        );
      })
    );
    debug("segmentNames", segmentNames);

    contactProps.push({
      property: "hull_segments",
      value: segmentNames.join(";")
    });

    // link to company
    if (
      this.outgoingLinking === true &&
      userMessage.account &&
      userMessage.account["hubspot/id"]
    ) {
      contactProps.push({
        property: "associatedcompanyid",
        value: userMessage.account["hubspot/id"]
      });
    }

    return contactProps;
  }

  /**
   * Map the account within the message to a Hubspot company object.
   *
   * @param {THullAccountUpdateMessage} message The notification message.
   * @returns {MappingResult<HubspotWriteCompany>} The mapping result for the company.
   * @memberof MappingUtil
   */
  mapToHubspotCompany(
    message: THullAccountUpdateMessage
  ): MappingResult<HubspotWriteCompany> {
    const propsMappingResult = this.mapHubspotCompanyProperties(message);
    const mappingResult: MappingResult<HubspotWriteCompany> = {
      result: null,
      warnings: propsMappingResult.warnings,
      errors: propsMappingResult.errors
    };
    // Early return if the property mapping yielded errors
    // or a null result
    if (
      propsMappingResult.errors.length > 0 ||
      propsMappingResult.result === null
    ) {
      return mappingResult;
    }

    const hubspotWriteProperties = propsMappingResult.result;
    const hubspotWriteCompany: HubspotWriteCompany = {
      properties: hubspotWriteProperties
    };
    // Add the identifier if present in the Hull account attributes
    if (!_.isNil(message.account["hubspot/id"])) {
      hubspotWriteCompany.objectId = _.toString(message.account["hubspot/id"]);
    }
    // Always make sure that we do have the domain in the
    // properties if not present
    if (!_.find(hubspotWriteCompany.properties, ["name", "domain"])) {
      hubspotWriteCompany.properties.push({
        name: "domain",
        value: message.account.domain
      });
    }

    mappingResult.result = hubspotWriteCompany;
    return mappingResult;
  }

  /**
   * Map properties object for Hubspot companies based on the account
   * within the message.
   *
   * @param {THullAccountUpdateMessage} message The notification message.
   * @returns {MappingResult<HubspotWriteCompanyProperties>} The mapping result.
   * @memberof MappingUtil
   */
  mapHubspotCompanyProperties(
    message: THullAccountUpdateMessage
  ): MappingResult<HubspotWriteCompanyProperties> {
    // Create the result object
    const mapResult: MappingResult<HubspotWriteCompanyProperties> = {
      result: [],
      warnings: [],
      errors: []
    };
    debug("getHubspotCompanyProperties", this.companyOutgoingMapping);

    // Compose the properties
    const accountData = message.account;
    const accountProps = _.reduce(
      this.companyOutgoingMapping,
      (accountProperties, mappingEntry) => {
        if (!mappingEntry.hubspot_property_name) {
          mapResult.warnings.push({
            message:
              "Cannot find mapped Hubspot property, see data for details.",
            data: mappingEntry
          });
          return accountProperties;
        }

        let value = _.has(accountData, mappingEntry.hull_trait_name)
          ? _.get(accountData, mappingEntry.hull_trait_name)
          : _.get({ account: accountData }, mappingEntry.hull_trait_name);

        if (
          !mappingEntry.hull_overwrite_hubspot &&
          mappingEntry.hull_default_trait_name
        ) {
          value = _.has(
            accountData,
            _.get(mappingEntry, "hull_default_trait_name")
          )
            ? _.get(accountData, _.get(mappingEntry, "hull_default_trait_name"))
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
              .utc()
              .hours(0)
              .minutes(0)
              .seconds(0)
              .milliseconds(0)
              .format("x");
          } else {
            mapResult.warnings.push({
              message:
                "Cannot parse datetime attribute from Hull to date for Hubspot",
              data: mappingEntry
            });
          }
        }

        if (
          !_.isNil(value) &&
          value !== "" &&
          mappingEntry.hubspot_property_read_only !== true
        ) {
          accountProperties.push({
            name: mappingEntry.hubspot_property_name,
            value
          });
        }
        return accountProperties;
      },
      []
    );
    // Compose the account segments
    const accountSegments: Array<string> = Array.isArray(
      message.account_segments
    )
      ? message.account_segments
      : [];
    debug("accountSegments", accountSegments, this.accountsSegments);
    const segmentNames = _.uniq(
      accountSegments.map(segment => {
        return _.trim(
          _.get(_.find(this.accountsSegments, { id: segment.id }), "name")
        );
      })
    );
    debug("segmentNames", segmentNames);

    accountProps.push({
      name: "hull_segments",
      value: segmentNames.join(";")
    });

    mapResult.result = accountProps;
    return mapResult;
  }

  /**
   * This method takes in an envelope, and checks if the customer has set
   * the !overwrite flag which means they don't want to overwrite a value in the target system
   * if that's the case, then we remove any properties that's already been set
   * so we don't overwrite it
   * @type {[type]}
   */
  patchHubspotCompanyProperties(
    existingHubspotCompany: HubspotReadCompany,
    envelope: HubspotAccountUpdateMessageEnvelope
  ): HubspotAccountUpdateMessageEnvelope {
    _.forEach(this.companyOutgoingMapping, mapping => {
      if (mapping.hull_overwrite_hubspot === false) {
        if (
          !_.isNil(
            _.get(
              envelope,
              `existingHubspotCompany.properties.${
                mapping.hubspot_property_name
              }.value`
            )
          )
        ) {
          _.remove(envelope.hubspotWriteCompany.properties, v => {
            return v.name === mapping.hubspot_property_name;
          });
        }
      }
    });
    return envelope;
  }

  patchHubspotContactProperties(
    existingHubspotContact: HubspotReadMultipleContactRead,
    envelope: HubspotUserUpdateMessageEnvelope
  ): HubspotUserUpdateMessageEnvelope {

    _.forEach(this.contactOutgoingMapping, mapping => {
      if (mapping.hull_overwrite_hubspot === false) {
        if (
          !_.isNil(
            _.get(
              existingHubspotContact,
              `properties.${
                mapping.hubspot_property_name
              }.value`
            )
          )
        ) {
          _.remove(envelope.hubspotWriteContact.properties, v => {
            return v.name === mapping.hubspot_property_name;
          });
        }
      }
    });
    return envelope;
  }

}

module.exports = MappingUtil;
