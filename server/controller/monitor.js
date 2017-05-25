export default class MonitorController {

  static checkTokenAction(req, res) {
    return req.hull.enqueue("checkTokenJob")
      .then(jobId => res.end(`ok: ${jobId}`));
  }

  static checkTokenJob(ctx) {
    return ctx.shipApp.hubspotAgent.checkToken();
  }
}
