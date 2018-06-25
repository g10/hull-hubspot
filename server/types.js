// @flow

export type HubspotError = {
  index: number,
  propertyValidationResult: {
    isValid: boolean,
    message: string,
    error: string,
    name: string
  }
};

export type HubspotProperties = Array<{
  property: string,
  value: mixed
}>;
