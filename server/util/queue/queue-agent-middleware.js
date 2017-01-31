import QueueAgent from "../queue/queue-agent";

export default function ({ queueAdapter }) {
  return function middleware(req, res, next) {
    req.shipApp = req.shipApp || {};
    req.shipApp.queueAgent = new QueueAgent(queueAdapter, req);

    return next();
  };
}
