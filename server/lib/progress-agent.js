import moment from "moment";

export default class ProgressAgent {
  constructor(helpers, hullClient) {
    this.helpers = helpers;
    this.hullClient = hullClient;
  }

  start() {
    return this.helpers.updateSettings({
      last_fetch_started_at: moment().utc().format(),
      is_fetch_completed: false,
      fetch_count: 0
    });
  }

  update(newProgress, hasMore = false) {
    return this.helpers.updateSettings({
      fetch_count: newProgress,
      is_fetch_completed: hasMore
    });
  }
}
