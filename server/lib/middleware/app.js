// /* @flow */
// import type { $Request, $Response, NextFunction } from "express";

// const SyncAgent = require("../sync-agent");

// function middlewareFactory() {
//   return function middleware(
//     req: $Request,
//     res: $Response,
//     next: NextFunction
//   ) {
//     req.hull.shipApp = req.hull.shipApp || {};

//     if (!req.hull || !req.hull.ship) {
//       return next();
//     }
//     const syncAgent = new SyncAgent(req.hull);

//     req.hull.shipApp = {
//       syncAgent
//     };

//     return next();
//   };
// }

// module.exports = middlewareFactory;
