import AppMiddleware from "./lib/middleware/app";

module.exports = function worker(options = {}) {
  const { connector, jobs } = options;

  connector.worker({
    jobs
  })
    .use(AppMiddleware());

  connector.startWorker();
};
