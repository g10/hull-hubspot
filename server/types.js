// @flow
import type {
  THullUserUpdateMessage,
  THullAccountUpdateMessage,
  THullSegment
} from "hull";

export type HubspotError = {
  index: number,
  propertyValidationResult: {
    isValid: boolean,
    message: string,
    error: string,
    name: string
  }
};

export type HubspotWriteContactProperties = Array<{
  property: string,
  value: mixed
}>;

export type HubspotWriteContact = {
  vid?: string,
  email?: string,
  properties: HubspotWriteContactProperties
};

export type HubspotWriteCompanyProperties = Array<{
  name: string,
  value: mixed
}>;

export type HubspotWriteCompany = {
  objectId?: string,
  email?: string,
  properties: HubspotWriteCompanyProperties
};

export type HubspotReadContact = {
  addedAt: number,
  "canonical-vid": string,
  vid: string,
  "merged-vids": Array<string>,
  "is-contact": boolean,
  "identity-profiles": Array<{
    vid: string,
    "saved-at-timestamp": number,
    identities: Array<{
      type: string,
      value: string,
      timestamp: number,
      "is-primary": boolean
    }>
  }>,
  properties: {
    [propertyName: string]: {
      value: mixed
    },
    lastmodifieddate: {
      value: string
    }
  }
};

export type HubspotReadMultipleContact = {
  [propertyName: number]: {
    vid: string,
    "canonical-vid": string,
    "merged-vids": Array<string>,
    "portal-id": number,
    "is-contact": boolean,
    "profile-token": string,
    "profile-url": string,
    properties: {
      [propertyName: string]: {
        value: mixed
      }
    },
    "form-submissions": Array<string>,
    "identity-profiles": Array<{
      vid: string,
      "saved-at-timestamp": number,
      identities: Array<{
        type: string,
        value: string,
        timestamp: number,
        "is-primary": boolean
      }>
    }>,
    "merge-audits": Array<string>,
    "associated-company": {
      "company-id": number,
      "portal-id": number,,
      properties: {
        [propertyName: string]: {
          value: mixed
        }
      }
    }
  }
};

export type HubspotReadCompany = {
  companyId: string,
  isDeleted: boolean,
  portalId: string,
  properties: {
    [propertyName: string]: {
      value: mixed
    },
    lastmodifieddate: {
      value: string
    }
  }
};

export type HubspotUserUpdateMessageEnvelope = {
  message: THullUserUpdateMessage,
  hubspotWriteContact: HubspotWriteContact,
  skipReason?: string,
  error?: string,
  errorProperty?: string,
  hull_summary?: string
};

export type HubspotAccountUpdateMessageEnvelope = {
  message: THullAccountUpdateMessage,
  existingHubspotCompany?: HubspotReadCompany,
  hubspotWriteCompany: HubspotWriteCompany,
  hubspotReadCompany?: HubspotReadCompany, // when we do insert we get back the HubspotReadCompany as a response
  skipReason?: string,
  error?: string,
  errorProperty?: string,
  hull_summary?: string
};

export type FilterUtilResults<T> = {
  toInsert: Array<T>,
  toUpdate: Array<T>,
  toSkip: Array<T>
};

export type HubspotContactProperty = {
  name: string,
  label: string,
  description?: string,
  groupName: string,
  type: string,
  fieldType: string,
  options: Array<any>,
  hidden: boolean,
  createdAt: null | any,
  updatedAt: null | any,
  searchableInGlobalSearch: boolean,
  hubspotDefined: boolean,
  calculated: boolean,
  externalOptions: boolean,
  deleted: null | any,
  formField: boolean,
  displayOrder: number,
  readOnlyValue: boolean,
  readOnlyDefinition: boolean,
  mutableDefinitionNotDeletable: boolean,
  favorited: boolean,
  favoritedOrder: number,
  displayMode: string,
  showCurrencySymbol: null | any,
  createdUserId: null | any,
  textDisplayHint: null | any,
  numberDisplayHint: null | any,
  optionsAreMutable: null | any,
  referencedObjectType: null | any,
  isCustomizedDefault: boolean,
  updatedUserId: null | any
};

export type HubspotCompanyProperty = HubspotContactProperty;

export type HubspotContactPropertyWrite = {
  name: string,
  label: string,
  description?: string,
  displayOrder: any,
  calculated?: boolean,
  groupName: string,
  formField: boolean,
  type: string,
  fieldType: string,
  options?: Array<any>
};

export type HubspotContactPropertyGroup = {
  name: string,
  displayName: string,
  displayOrder: number,
  hubspotDefined: boolean,
  properties: Array<HubspotContactProperty>
};

export type HubspotContactPropertyGroups = Array<HubspotContactPropertyGroup>;

export type HubspotCompanyPropertyGroup = {
  name: string,
  displayName: string,
  displayOrder: number,
  hubspotDefined: boolean,
  properties: Array<HubspotCompanyProperty>
};

export type HubspotCompanyPropertyWrite = HubspotContactPropertyWrite;
export type HubspotCompanyPropertyGroups = Array<HubspotCompanyPropertyGroup>;

export type HullProperty = {
  id: string,
  text: string,
  type: string,
  id_path: Array<string>,
  path: Array<string>,
  title: string,
  key: string
};

export type HubspotDefaultContactMapping = {
  name: string,
  hull: string,
  type: string,
  title: string,
  read_only: boolean
};

export type HubspotContactAttributesIncomingSetting = {
  name: string,
  hull: string
};

export type HubspotContactAttributesOutgoingSetting = {
  hull: string,
  name: string,
  overwrite: boolean
};

export type HubspotContactOutgoingMapping = {
  hull_trait_name: $PropertyType<
    HubspotContactAttributesOutgoingSetting,
    "hull"
  >,
  hull_default_trait_name: $PropertyType<
    HubspotDefaultContactMapping,
    "hull"
  > | null,
  hull_trait_type: $PropertyType<HullProperty, "type">,
  hull_overwrite_hubspot: $PropertyType<
    HubspotContactAttributesOutgoingSetting,
    "overwrite"
  >,
  hubspot_property_name: $PropertyType<
    HubspotContactAttributesOutgoingSetting,
    "name"
  >,
  hubspot_property_label?: $PropertyType<HubspotContactProperty, "label">,
  hubspot_property_read_only?: $PropertyType<
    HubspotContactProperty,
    "readOnlyValue"
  >,
  hubspot_property_type?: $PropertyType<HubspotContactProperty, "type">,
  hubspot_property_field_type?: $PropertyType<
    HubspotContactProperty,
    "fieldType"
  >,
  hubspot_property_display_order?: $PropertyType<
    HubspotContactProperty,
    "displayOrder"
  >
};

export type HubspotContactIncomingMapping = {
  hull_trait_name: $PropertyType<
    HubspotContactAttributesOutgoingSetting,
    "hull"
  >,
  hull_trait_type?: $PropertyType<HullProperty, "type">,
  hubspot_property_name: $PropertyType<
    HubspotContactAttributesOutgoingSetting,
    "name"
  >,
  hubspot_property_read_only: $PropertyType<
    HubspotContactProperty,
    "readOnlyValue"
  >,
  hubspot_property_type: $PropertyType<HubspotContactProperty, "type">,
  hubspot_property_field_type: $PropertyType<
    HubspotContactProperty,
    "fieldType"
  >
};

export type HubspotDefaultCompanyMapping = {
  hubspot: string,
  hull: string,
  type: string,
  title: string,
  read_only: boolean
};

export type HubspotCompanyAttributesIncomingSetting = {
  hubspot: string,
  hull: string
};

export type HubspotCompanyAttributesOutgoingSetting = {
  hull: string,
  hubspot: string,
  overwrite: boolean
};

export type HubspotCompanyOutgoingMapping = HubspotContactOutgoingMapping;
export type HubspotCompanyIncomingMapping = HubspotContactIncomingMapping;

export type ConnectorPrivateSettings = {
  synchronized_segments: Array<string>,
  is_fetch_completed: boolean,
  portal_id: number,
  refresh_token: string,
  token: string,
  token_fetched_at: string,
  last_fetch_started_at: string,
  fetch_count: number,
  sync_fields_to_hull: Array<HubspotContactAttributesIncomingSetting>,
  sync_fields_to_hubspot: Array<HubspotContactAttributesOutgoingSetting>,
  last_fetch_at: string,
  expires_in: number,
  companies_last_fetch_at: string,
  synchronized_account_segments: Array<string>,
  outgoing_account_attributes: Array<HubspotCompanyAttributesOutgoingSetting>,
  link_users_in_hull: boolean,
  incoming_account_attributes: Array<HubspotCompanyAttributesIncomingSetting>,
  link_users_in_service: boolean,
  incoming_account_ident_service: string,
  incoming_account_ident_hull: string
};

export type HullProperties = {
  [string]: HullProperty
};

export type MappingUtilConfiguration = {
  usersSegments: Array<THullSegment>,
  accountsSegments: Array<THullSegment>,
  hubspotContactPropertyGroups: HubspotContactPropertyGroups,
  hubspotCompanyPropertyGroups: HubspotCompanyPropertyGroups,
  hullUserProperties: HullProperties,
  hullAccountProperties: HullProperties,
  connectorSettings: ConnectorPrivateSettings
};

export type LoggerData = {
  message: string,
  data?: Object
};

export type MappingResult<T> = {
  result: null | T,
  warnings: Array<LoggerData>,
  errors: Array<LoggerData>
};
