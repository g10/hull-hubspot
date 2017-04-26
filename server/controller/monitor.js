export default class MonitorController {

  checkTokenAction = (req, res) => {
    return req.hull.enqueue("checkTokenJob")
      .then(jobId => res.end(`ok: ${jobId}`));
  };

  static checkTokenJob(ctx) {
    return ctx.shipApp.hubspotAgent.checkToken();
  }
}
