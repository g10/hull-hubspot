const rawBody = require("raw-body");

/**
 * [handle description]
 * @param  {Object}   req
 * @param  {Object}   res
 * @param  {Function} next
 */
function handle(req, res, next) {
  req.hull = req.hull || {};
  rawBody(req, true, (err, body) => {
    if (err) {
      const e = new Error("Invalid Body");
      e.status = 400;
      return next(e);
    }
    try {
      req.hull.message = JSON.parse(body);
    } catch (parseError) {
      const e = new Error("Invalid Body");
      e.status = 400;
      return next(e);
    }
    return next();
  });
}

module.exports = handle;
