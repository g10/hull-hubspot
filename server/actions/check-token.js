export default function checkTokenAction(req, res, next) {
  return req.hull.shipApp.hubspotAgent.checkToken().then(next, next);
}
