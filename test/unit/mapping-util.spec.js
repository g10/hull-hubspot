/* global describe, test, expect */

const _ = require("lodash");
const MappingUtil = require("../../server/lib/sync-agent/mapping-util");
const krakenNotification = require("../fixtures/kraken_account-update.json");
const contactPropGroups = require("../fixtures/hubspot_contactsgroupswprops.json");
const companyPropGroups = require("../fixtures/hubspot_companypropertygroupswprops.json");
const hullUserProps = require("../fixtures/hull_userprops.json");
const hullAccountProps = require("../fixtures/hull_accountprops.json");
const connectorContactInMapsRaw = require("../fixtures/connector_mappingutil_contactinmappings.json");
const connectorContactOutMapsRaw = require("../fixtures/connector_mappingutil_contactoutmappings.json");
const connectorCompanyInMapsRaw = require("../fixtures/connector_mappingutil_companyinmappings.json");
const connectorCompanyOutMapsRaw = require("../fixtures/connector_mappingutil_companyoutmappings.json");
const connectorContactPropKeys = require("../fixtures/connector_mappingutil_contactpropertieskeys.json");
const connectorHullUserTraitKeys = require("../fixtures/connector_mappingutil_hullusertraitkeys.json");
const connectorCompanyPropKeys = require("../fixtures/connector_mappingutil_companypropertieskeys.json");
const connectorHullAccountTraitKeys = require("../fixtures/connector_mappingutil_hullaccounttraitkeys.json");
const hsContact = require("../fixtures/hubspot_contact_getbyid.json");
const hsCompany = require("../fixtures/hubspot_companygetbyid.json");

describe("MappingUtil", () => {
  test("smoke test", () => {
    expect(true).toBe(true);
  });

  test("should initialize the util with the configuration", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    const util = new MappingUtil(config);
    expect(util.usersSegments).toEqual(config.usersSegments);
    expect(util.accountsSegments).toEqual(config.accountsSegments);
    const expectedHubspotContactProperties = _.flatten(
      config.hubspotContactPropertyGroups.map(group => group.properties)
    );
    expect(util.hubspotContactProperties).toEqual(
      expectedHubspotContactProperties
    );
    const expectedHubspotCompanyProperties = _.flatten(
      config.hubspotCompanyPropertyGroups.map(group => group.properties)
    );
    expect(util.hubspotCompanyProperties).toEqual(
      expectedHubspotCompanyProperties
    );
    expect(util.hullUserProperties).toEqual(config.hullUserProperties);
    expect(util.hullAccountProperties).toEqual(config.hullAccountProperties);
    expect(util.contactAttributesIncomingSettings).toEqual(
      config.connectorSettings.sync_fields_to_hull
    );
    expect(util.contactAttributesOutgoingSettings).toEqual(
      config.connectorSettings.sync_fields_to_hubspot
    );
    expect(util.companyAttributesIncomingSettings).toEqual(
      config.connectorSettings.incoming_account_attributes
    );
    expect(util.companyAttributesOutgoingSettings).toEqual(
      config.connectorSettings.outgoing_account_attributes
    );
    expect(util.incomingAccountIdentHull).toEqual(
      config.connectorSettings.incoming_account_ident_hull
    );
    expect(util.incomingAccountIdentService).toEqual(
      config.connectorSettings.incoming_account_ident_service
    );
    expect(util.outgoingLinking).toEqual(
      config.connectorSettings.link_users_in_service
    );
  });

  test("should compose outgoing contact mappings", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    // Turns JSON null for `hull_trait_type` into `undefined` for JS
    const connectorContactOutMaps = _.map(connectorContactOutMapsRaw, e => {
      if (e.hull_trait_type === null) {
        e.hull_trait_type = undefined;
      }
      return e;
    });

    const util = new MappingUtil(config);
    expect(util.contactOutgoingMapping).toEqual(connectorContactOutMaps);
  });

  test("should compose incoming contact mappings", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    // Turns JSON null for `hull_trait_type` into `undefined` for JS
    const connectorContactInMaps = _.map(connectorContactInMapsRaw, e => {
      if (e.hull_trait_type === null) {
        e.hull_trait_type = undefined;
      }
      return e;
    });

    const util = new MappingUtil(config);
    expect(util.contactIncomingMapping).toEqual(connectorContactInMaps);
  });

  test("should compose outgoing company mappings", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    // Turns JSON null for `hull_trait_type` into `undefined` for JS
    const connectorCompanyOutMaps = _.map(connectorCompanyOutMapsRaw, e => {
      if (e.hull_trait_type === null) {
        e.hull_trait_type = undefined;
      }
      return e;
    });

    const util = new MappingUtil(config);
    expect(util.companyOutgoingMapping).toEqual(connectorCompanyOutMaps);
  });

  test("should compose incoming company mappings", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    // Turns JSON null for `hull_trait_type` into `undefined` for JS
    const connectorCompanyInMaps = _.map(connectorCompanyInMapsRaw, e => {
      if (e.hull_trait_type === null) {
        e.hull_trait_type = undefined;
      }
      return e;
    });

    const util = new MappingUtil(config);
    expect(util.companyIncomingMapping).toEqual(connectorCompanyInMaps);
  });

  test("should return the names of the HS incoming properties for Contacts", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    const util = new MappingUtil(config);
    const props = util.getHubspotContactPropertiesKeys();
    expect(props).toEqual(connectorContactPropKeys);
  });

  test("should return the names of Hull user traits", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    const util = new MappingUtil(config);
    const traits = util.getHullUserTraitsKeys();
    expect(traits).toEqual(connectorHullUserTraitKeys);
  });

  test("should return the names of the HS incoming properties for companies", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    const util = new MappingUtil(config);
    const props = util.getHubspotCompanyPropertiesKeys();
    expect(props).toEqual(connectorCompanyPropKeys);
  });

  test("should return the names of Hull account traits", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    const util = new MappingUtil(config);
    const traits = util.getHullAccountTraitsKeys();
    expect(traits).toEqual(connectorHullAccountTraitKeys);
  });

  test("should get the user ident from a hubspot contact with email", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };
    const expectedIdent = {
      email: hsContact.properties.email.value,
      anonymous_id: `hubspot:${hsContact.vid}`
    };

    const util = new MappingUtil(config);
    const ident = util.getHullUserIdentFromHubspot(hsContact);
    expect(ident).toEqual(expectedIdent);
  });

  test("should get the user ident from a hubspot contact without email", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };
    const hsContactNoEmail = _.cloneDeep(hsContact);
    _.unset(hsContactNoEmail, "properties.email");
    _.set(hsContactNoEmail, "identity-profiles", []);

    const expectedIdent = {
      anonymous_id: `hubspot:${hsContactNoEmail.vid}`
    };

    const util = new MappingUtil(config);
    const ident = util.getHullUserIdentFromHubspot(hsContactNoEmail);
    expect(ident).toEqual(expectedIdent);
  });

  test("should get account ident from hubspot company without external_id", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    const expectedIdent = {
      domain: hsCompany.properties.domain.value,
      anonymous_id: `hubspot:${hsCompany.companyId}`
    };

    const util = new MappingUtil(config);
    const ident = util.getHullAccountIdentFromHubspot(hsCompany);
    expect(ident).toEqual(expectedIdent);
  });

  test("should get account ident from hubspot company with external_id", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    _.set(
      config,
      "connectorSettings.incoming_account_ident_service",
      "test_id"
    );

    _.set(
      config,
      "connectorSettings.incoming_account_ident_hull",
      "external_id"
    );

    const hsCompanyExtId = _.cloneDeep(hsCompany);
    _.set(hsCompanyExtId, "properties.test_id.value", "1234");

    const expectedIdent = {
      external_id: "1234",
      domain: hsCompanyExtId.properties.domain.value,
      anonymous_id: `hubspot:${hsCompanyExtId.companyId}`
    };

    const util = new MappingUtil(config);
    const ident = util.getHullAccountIdentFromHubspot(hsCompanyExtId);
    expect(ident).toEqual(expectedIdent);
  });

  test("should get account traits from hubspot company", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    const expectedTraits = {
      "hubspot/founded_year": "1997",
      "hubspot/hs_lastmodifieddate": "1541022160666",
      "hubspot/hubspot_owner_assigneddate": "1541016662615",
      "hubspot/is_public": "true",
      "hubspot/name": "Initech",
      "hubspot/address":
        "11F, Acehighend Tower 2-Cha 61, Digitalro 26-Gil Guro-Gu",
      "hubspot/city": "Seoul",
      "hubspot/hubspot_owner_id": "34096952",
      "hubspot/hs_all_owner_ids": "34096952",
      "hubspot/website": "initech.jp",
      "hubspot/domain": "initech.com",
      "hubspot/numberofemployees": 200,
      "hubspot/industry": "INFORMATION_TECHNOLOGY_AND_SERVICES",
      "hubspot/annualrevenue": 1000000,
      "hubspot/description":
        "INITECH Co., Ltd is a Korea-based company engaged in the provision of data encryption and authentication solutions for the Internet security market. The Company’s business divisions include authentication and encryption division, engaged in the issue of electronic licenses and the provision of encryption and decryption services in the Web environment; integrated security management division, providing integrated authority management services and account integrated management of Windows systems and others; security device division, providing hardware security modules; financial application service provider (ASP) division, providing ASP services for electronic financial systems and Internet banking services; system integration (SI) division, providing solutions for electronic finance transactions, as well as system management division. It also involves in the provision of maintenance and technology services, as well as distributes software, computers, peripherals and others.",
      "hubspot/createdate": "1541008027814",
      "hubspot/web_technologies": ["apache"],
      "hubspot/twitterhandle": "iminitech",
      "hubspot/linkedin_company_page":
        "https://www.linkedin.com/company/initech",
      "hubspot/linkedinbio":
        "INITECH Co., Ltd is a Korea-based company engaged in the provision of data encryption and authentication solutions for the Internet security market. The Company’s business divisions include authentication and encryption division, engaged in the issue of electronic licenses and the provision of encryption and decryption services in the Web environment; integrated security management division, providing integrated authority management services and account integrated management of Windows systems and others; security device division, providing hardware security modules; financial application service provider (ASP) division, providing ASP services for electronic financial systems and Internet banking services; system integration (SI) division, providing solutions for electronic finance transactions, as well as system management division. It also involves in the provision of maintenance and technology services, as well as distributes software, computers, peripherals and others.",
      "hubspot/id": 1031042231,
      name: { value: "Initech", operation: "setIfNull" }
    };

    const util = new MappingUtil(config);
    const traits = util.getHullAccountTraits(hsCompany);
    expect(traits.warnings).toHaveLength(0);
    expect(traits.errors).toHaveLength(0);
    expect(traits.result).toEqual(expectedTraits);
  });

  test("should get user traits from hubspot contact", () => {
    const config = {
      usersSegments: krakenNotification.segments,
      accountsSegments: krakenNotification.accounts_segments,
      hubspotContactPropertyGroups: contactPropGroups,
      hubspotCompanyPropertyGroups: companyPropGroups,
      hullUserProperties: hullUserProps,
      hullAccountProperties: hullAccountProps,
      connectorSettings: krakenNotification.connector.private_settings
    };

    const expectedTraits = {
      email: "coolrobot@hubspot.com",
      "hubspot/first_name": "Cool",
      "hubspot/last_name": "Robot (Sample Contact)",
      "hubspot/address_city": "Cambridge",
      "hubspot/address_state": "MA",
      "hubspot/company": "HubSpot",
      "hubspot/job_title": "Robot",
      "hubspot/website": "http://www.HubSpot.com",
      "hubspot/created_at": "1541007331228",
      "hubspot/updated_at": "1541007382913",
      "hubspot/lifecycle_stage": "lead",
      "hubspot/email_optout": "",
      "hubspot/became_lead_at": "1541007331228",
      "hubspot/id": 1,
      first_name: { operation: "setIfNull", value: "Cool" },
      last_name: { operation: "setIfNull", value: "Robot (Sample Contact)" }
    };

    const util = new MappingUtil(config);
    const traits = util.getHullUserTraits(hsContact);
    expect(traits.warnings).toHaveLength(0);
    expect(traits.errors).toHaveLength(0);
    expect(traits.result).toEqual(expectedTraits);
  });
});
