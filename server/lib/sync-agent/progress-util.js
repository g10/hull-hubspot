const moment = require("moment");

class ProgressUtil {
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

  update(newProgress) {
    return this.helpers.updateSettings({
      fetch_count: newProgress
    });
  }

  stop() {
    return this.helpers.updateSettings({
      is_fetch_completed: true
    });
  }
}

module.exports = ProgressUtil;
