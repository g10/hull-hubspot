import _ from "lodash";

/**
 * Queue Agent which handle queueing and processing http requests to the ship
 */
export default class QueueAgent {

  /**
   * Adapter on top of the queue system.
   * Should expose create and process methods;
   */
  constructor(adapter, req) {
    this.adapter = adapter;
    this.req = req;
  }

  /**
   * @param {String} jobName
   * @param {Object} jobPayload
   * @return {Promise}
   */
  create(jobName, jobPayload, options = {}) {
    const context = _.pick(this.req, ["query", "hostname"]);
    return this.adapter.create("queueApp", {
      name: jobName,
      payload: jobPayload,
      context
    }, options);
  }
}
