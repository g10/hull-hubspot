export default class MonitorController {

  checkTokenAction(req, res) {
    return req.hull.enqueue("checkTokenJob")
      .then(jobId => res.end(`ok: ${jobId}`));
  }

  checkTokenJob(req) {
    return req.hull.shipApp.hubspotAgent.checkToken();
  }
}
