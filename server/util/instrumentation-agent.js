import util from "util";
import raven from "raven";
import metrics from "datadog-metrics";
import dogapi from "dogapi";
import _ from "lodash";

export default class InstrumentationAgent {

  constructor() {
    this.nr = null;
    this.raven = null;
    this.manifest = require(`${process.cwd()}/manifest.json`); // eslint-disable-line global-require

    if (process.env.NEW_RELIC_LICENSE_KEY) {
      this.nr = require("newrelic"); // eslint-disable-line global-require
    }

    if (process.env.DATADOG_API_KEY) {
      this.metrics = metrics;
      metrics.init({
        host: process.env.HOST,
      });
      this.dogapi = dogapi;
    }


    if (process.env.SENTRY_URL) {
      console.log("starting raven");
      this.raven = new raven.Client(process.env.SENTRY_URL, {
        release: this.manifest.version
      });
      this.raven.patchGlobal();
    }
  }

  startTransaction(jobName, callback) {
    if (this.nr) {
      return this.nr.createBackgroundTransaction(jobName, callback)();
    }
    return callback();
  }

  endTransaction() {
    if (this.nr) {
      this.nr.endTransaction();
    }
  }

  catchError(err, extra = {}, tags = {}) {
    if (this.raven && err) {
      this.raven.captureException(err, {
        extra,
        tags,
        fingerprint: [
          "{{ default }}",
          err.message
        ]
      });
    }
    return console.error(util.inspect(err, { depth: 10 }));
  }

  metricVal(metric, value = 1, context) {
    if (!this.metrics) {
      return null;
    }
    try {
      return this.metrics.gauge(metric, parseFloat(value), this.getMetricTags(context));
    } catch (err) {
      console.warn("metricVal.error", err);
    }
    return null;
  }

  metricInc(metric, value = 1, context) {
    if (!this.metrics) {
      return null;
    }
    try {
      return this.metrics.increment(metric, parseFloat(value), this.getMetricTags(context));
    } catch (err) {
      console.warn("metricInc.error", err);
    }
    return null;
  }

  getMetricTags({ organization, id } = {}) {
    const tags = ["source:ship", `ship_version:${this.manifest.version}`, `ship_name:${this.manifest.name}`,
      `env:${process.env.NODE_ENV || "production"}`];
    if (organization) {
      tags.push(`organization:${organization}`);
    }
    if (id) {
      tags.push(`ship:${id}`);
    }
    return tags;
  }

  metricEvent({ title, text = "", properties = {}, context }) {
    if (!this.dogapi) {
      return null;
    }
    return this.dogapi.event.create(`${this.manifest.name}.${title}`, text, _.merge(properties, {
      tags: this.getMetricTags(context)
    }));
  }

  startMiddleware() {
    if (this.raven) {
      return raven.middleware.express.requestHandler(this.raven);
    }
    return (req, res, next) => {
      next();
    };
  }

  stopMiddleware() {
    if (this.raven) {
      return raven.middleware.express.errorHandler(this.raven);
    }
    return (req, res, next) => {
      next();
    };
  }
}
