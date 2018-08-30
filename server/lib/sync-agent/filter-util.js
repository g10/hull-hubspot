// @flow
import type { THullConnector, THullUser, THullReqContext } from "hull";
import type {
  FilterUtilResults,
  HubspotUserUpdateMessageEnvelope,
  HubspotAccountUpdateMessageEnvelope
} from "../../types";

const debug = require("debug")("hull-hubspot:filter-util");
const _ = require("lodash");

class FilterUtil {
  connector: THullConnector;
  isBatch: boolean;

  constructor(ctx: THullReqContext) {
    this.connector = ctx.connector;
    this.isBatch = ctx.isBatch;
    debug("isBatch", this.isBatch);
  }

  isUserWhitelisted(user: THullUser): boolean {
    const segmentIds =
      (this.connector.private_settings &&
        this.connector.private_settings.synchronized_segments) ||
      [];
    if (Array.isArray(user.segment_ids)) {
      return _.intersection(segmentIds, user.segment_ids).length > 0;
    }
    return false;
  }

  isAccountWhitelisted(envelope: Array<HubspotUserUpdateMessageEnvelope>): boolean {
    const segmentIds =
      (this.connector.private_settings &&
        this.connector.private_settings.synchronized_account_segments) ||
      [];
    if (Array.isArray(envelope.message.account_segments)) {
      return _.intersection(segmentIds, envelope.message.account_segments.map(s => s.id)).length > 0;
    }
    return false;
  }

  filterUserUpdateMessageEnvelopes(
    envelopes: Array<HubspotUserUpdateMessageEnvelope>
  ): FilterUtilResults<HubspotUserUpdateMessageEnvelope> {
    const filterUtilResults: FilterUtilResults<
      HubspotUserUpdateMessageEnvelope
    > = {
      toInsert: [],
      toUpdate: [],
      toSkip: []
    };
    envelopes.forEach(envelope => {
      const { user, changes = {}, segments = [] } = envelope.message;
      if (
        _.get(changes, "user['traits_hubspot/fetched_at'][1]", false) &&
        _.isEmpty(_.get(changes, "segments"))
      ) {
        envelope.skipReason = "User just touched by hubspot connector";
        return filterUtilResults.toSkip.push(envelope);
      }

      if (Array.isArray(user.segment_ids)) {
        user.segment_ids = _.uniq(
          (user.segment_ids || []).concat(segments.map(s => s.id))
        );
      }
      if (
        !this.isBatch &&
        (!this.isUserWhitelisted(user) || _.isEmpty(user.email))
      ) {
        envelope.skipReason = "User doesn't match outgoing filter";
        return filterUtilResults.toSkip.push(envelope);
      }
      return filterUtilResults.toInsert.push(envelope);
    });
    return filterUtilResults;
  }

  filterAccountUpdateMessageEnvelopes(
    envelopes: Array<HubspotUserAccountMessageEnvelope>
  ): FilterUtilResults<HubspotUserAccountMessageEnvelope> {
    const filterUtilResults: FilterUtilResults<
      HubspotAccountUpdateMessageEnvelope
    > = {
      toInsert: [],
      toUpdate: [],
      toSkip: []
    };
    envelopes.forEach(envelope => {
      const { account, changes = {}, segments = [] } = envelope.message;
      if (
        _.get(changes, "account['hubspot/fetched_at'][1]", false) &&
        _.isEmpty(_.get(changes, "segments"))
      ) {
        envelope.skipReason = "Account just touched by hubspot connector";
        return filterUtilResults.toSkip.push(envelope);
      }
      if (!this.isBatch && !this.isAccountWhitelisted(envelope)) {
        envelope.skipReason = "Account doesn't match outgoing filter";
        return filterUtilResults.toSkip.push(envelope);
      }
      return filterUtilResults.toInsert.push(envelope);
    });
    return filterUtilResults;
  }
}

module.exports = FilterUtil;
