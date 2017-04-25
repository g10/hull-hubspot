module.exports = function worker(options = {}) {
  const { connector, jobs } = options;

  connector.worker({
    jobs
  });

  connector.startWorker();
};
