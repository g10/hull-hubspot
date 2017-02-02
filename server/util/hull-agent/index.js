import _ from "lodash";

import Extract from "./extract";
import getProperties from "./get-properties";

export default class HullAgent {

  constructor(ship, hullClient, shipCache, req) {
    this.hullClient = hullClient;
    this.ship = ship;
    this.shipCache = shipCache;

    this.extract = new Extract(req, hullClient);
  }

  /**
   * Updates `private_settings`, touching only provided settings.
   * Also clears the `shipCache`.
   * `hullClient.put` will emit `ship:update` notify event.
   * @param  {Object} newSettings settings to update
   * @return {Promise}
   */
  updateShipSettings(newSettings) {
    return this.hullClient.get(this.ship.id)
      .then(ship => {
        this.ship = ship;
        const private_settings = { ...this.ship.private_settings, ...newSettings };
        this.ship.private_settings = private_settings;
        return this.hullClient.put(this.ship.id, { private_settings });
      })
      .then((ship) => {
        return this.shipCache.del(this.ship.id)
          .then(() => {
            return ship;
          });
      });
  }

  getShipSettings() {
    return _.get(this.ship, "private_settings", {});
  }

  /**
   * gets all existing Properties in the organization along with their metadata
   * @return {Promise}
   */
  getAvailableProperties() {
    return this.hullClient
      .get("search/user_reports/bootstrap")
      .then(({ tree }) => getProperties(tree).properties);
  }

  /**
   * @param  {Object} user
   * @return {Boolean}
   */
  userComplete(user) {
    return !_.isEmpty(user.email);
  }

  /**
   * Returns information if the users should be sent in outgoing sync.
   * @param  {Object} user Hull user object
   * @return {Boolean}
   */
  userWhitelisted(user) {
    const segmentIds = _.get(this.ship, "private_settings.synchronized_segments", []);
    if (segmentIds.length === 0) {
      return true;
    }
    return _.intersection(segmentIds, user.segment_ids).length > 0;
  }

  getSegments() {
    return this.hullClient.get("/segments");
  }
}
