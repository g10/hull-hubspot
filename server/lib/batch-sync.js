import _ from "lodash";
import Promise from "bluebird";

const HANDLERS = {};

export default class BatchSyncHandler {

  static exit() {
    console.log("BatchSyncHandler.exit");
    if (!BatchSyncHandler.exiting) {
      const exiting = Promise.all(_.map(HANDLERS, h => h.flush()));
      BatchSyncHandler.exiting = exiting;
      return exiting;
    }
    return Promise.resolve([]);
  }

  static getHandler(args) {
    const name = args.ns + args.ship.id;
    return HANDLERS[name] = HANDLERS[name] || new BatchSyncHandler(args); // eslint-disable-line no-return-assign
  }

  constructor({ ns = "", ship, hull, options = {} }) {
    this.ns = ns;
    this.ship = ship;
    this.hull = hull;
    this.messages = [];
    this.options = options;

    this.flushLater = _.throttle(this.flush.bind(this), this.options.throttle);
    return this;
  }

  setCallback(callback) {
    this.callback = callback;
    return this;
  }

  add(message) {
    this.messages.push(message);
    this.hull.client.logger.info("batchSyncHandler.added", this.messages.length);
    const { maxSize } = this.options;
    if (this.messages.length >= maxSize) {
      this.flush();
    } else {
      this.flushLater();
    }
    return Promise.resolve("ok");
  }

  flush() {
    const messages = this.messages;
    this.hull.client.logger.info("batchSyncHandler.flush", messages.length);
    this.messages = [];
    return this.callback(messages)
      .then(() => {
        this.hull.client.logger.info("batchSyncHandler.flush.sucess");
      }, (err) => {
        console.error(err);
        this.hull.client.logger.error("batchSyncHandler.flush.error", err);
      });
  }
}
