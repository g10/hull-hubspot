import Promise from "bluebird";
import kue from "kue";
import moment from "moment";

/**
 * Kue Adapter for queue
 */
export default class KueAdapter {

  /**
   * @param {Object} queue Kue instance
   */
  constructor(options) {
    this.options = options;
    this.queue = kue.createQueue(options);
    this.queue.watchStuckJobs();
    this.app = kue.app;

    ["inactiveCount", "activeCount", "completeCount", "failedCount", "delayedCount"].forEach(name => {
      this[name] = Promise.promisify(this.queue[name]).bind(this.queue);
    });
  }

  /**
   * @param {String} jobName queue name
   * @param {Object} jobPayload
   * @return {Promise}
   */
  create(jobName, jobPayload, ttl = 0) {
    return Promise.fromCallback((callback) => {
      const job = this.queue.create(jobName, jobPayload)
        .ttl(ttl)
        .removeOnComplete(true)
        .save(function saveHandler(err) {
          callback(err, job.id);
        });
    });
  }

  /**
   * @param {String} jobName
   * @param {Function -> Promise} jobCallback
   * @return {Object} this
   */
  process(jobName, jobCallback) {
    this.queue.process(jobName, (job, done) => {
      jobCallback(job)
        .then((res) => {
          done(null, res);
        }, (err) => {
          done(err);
        })
        .catch((err) => {
          done(err);
        });
    });
    return this;
  }

  exit() {
    return Promise.fromCallback((callback) => {
      this.queue.shutdown(5000, callback);
    });
  }

  cleanQueue() {
    return Promise.fromCallback(callback => {
      kue.Job.rangeByState("failed", 0, 10, "asc", (err, jobs) => {
        jobs = jobs
          .filter(j => moment(j.failed_at, "x").isBefore(moment().subtract(1, "month")))
          .map(j => j.remove());
        callback(err, jobs.length);
      });
    });
  }
}
