// @flow
import type { THullUserUpdateMessage } from "hull";

export type HubspotError = {
  index: number,
  propertyValidationResult: {
    isValid: boolean,
    message: string,
    error: string,
    name: string
  }
};

export type HubspotWriteProperties = Array<{
  property: string,
  value: mixed
}>;

export type HubspotWriteContact = {
  vid?: string,
  email?: string,
  properties: HubspotWriteProperties
};

export type HubspotReadContact = {
  addedAt: number,
  "canonical-vid": string,
  vid: string,
  "merged-vids": Array<string>,
  "is-contact": boolean,
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

export type HubspotContactAttributesInboundSetting = {
  name: string,
  hull: string
};

export type HubspotContactAttributesOutboundSetting = {
  hull: string,
  name: string,
  overwrite: boolean
};

export type HubspotContactOutboundMapping = {
  hull_trait_name: $PropertyType<
    HubspotContactAttributesOutboundSetting,
    "hull"
  >,
  hull_default_trait_name: $PropertyType<
    HubspotDefaultContactMapping,
    "hull"
  > | null,
  hull_trait_type: $PropertyType<HullProperty, "type">,
  hull_overwrite_hubspot: $PropertyType<
    HubspotContactAttributesOutboundSetting,
    "overwrite"
  >,
  hubspot_property_name: $PropertyType<
    HubspotContactAttributesOutboundSetting,
    "name"
  >,
  hubspot_property_label: $PropertyType<HubspotContactProperty, "label">,
  hubspot_property_read_only: $PropertyType<
    HubspotContactProperty,
    "readOnlyValue"
  >,
  hubspot_property_type: $PropertyType<HubspotContactProperty, "type">,
  hubspot_property_field_type: $PropertyType<
    HubspotContactProperty,
    "fieldType"
  >,
  hubspot_property_display_order: $PropertyType<
    HubspotContactProperty,
    "displayOrder"
  >
};

export type HubspotContactInboundMapping = {
  hull_trait_name: $PropertyType<
    HubspotContactAttributesOutboundSetting,
    "hull"
  >,
  hull_trait_type: $PropertyType<HullProperty, "type">,
  hubspot_property_name: $PropertyType<
    HubspotContactAttributesOutboundSetting,
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
