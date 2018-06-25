// @flow
import type { THullConnector, THullUser, THullReqContext } from "hull";

const _ = require("lodash");

class FilterUtil {
  connector: THullConnector;

  constructor(ctx: THullReqContext) {
    this.connector = ctx.ship;
  }

  isUserWhitelisted(user: THullUser): boolean {
    const segmentIds =
      (this.connector.private_settings &&
        this.connector.private_settings.synchronized_segments) ||
      [];
    if (segmentIds.length === 0) {
      return true;
    }
    return _.intersection(segmentIds, user.segment_ids).length > 0;
  }
}

module.exports = FilterUtil;
