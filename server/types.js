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
  vid: string,
  "merged-vids": Array<string>,
  "is-contact": boolean,
  properties: {
    [propertyName: string]: mixed,
    lastmodifieddate: number
  }
};

export type HubspotUserUpdateMessageEnvelope = {
  message: THullUserUpdateMessage,
  hubspotWriteContact: HubspotWriteContact,
  skipReason?: string,
  error?: string
};

export type FilterUtilResults<T> = {
  toInsert: Array<T>,
  toUpdate: Array<T>,
  toSkip: Array<T>
};
