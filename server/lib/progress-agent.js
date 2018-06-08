const moment = require("moment");

class ProgressAgent {
  constructor({ helpers }) {
    this.helpers = helpers;
  }

  start() {
    return this.helpers.updateSettings({
      last_fetch_started_at: moment()
        .utc()
        .format(),
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

module.exports = ProgressAgent;
