import Minihull from "minihull";
import { Connector } from "hull";
import express from "express";
import { expect } from "chai";

import Minihubspot from "./minihubspot";
import server from "../server/server";
import worker from "../server/worker";

process.env.CLIENT_ID = "123";
process.env.CLIENT_SECRET = "abc";
process.env.OVERRIDE_HUBSPOT_URL = "http://localhost:8002";

const minihull = new Minihull();
const minihubspot = new Minihubspot();

const app = express();
const connector = new Connector({ hostSecret: "1234", port: 8000, clientConfig: { protocol: "http" } });
connector.setupApp(app);
server(app, { queue: connector.queue });
worker(connector);

describe("Hubspot", function test() {

  beforeEach((done) => {
    connector.startApp(app);
    connector.startWorker();
    setTimeout(() => {
      minihull.listen(8001);
      minihull.install("http://localhost:8000")
        .then(() => {
          minihull.updateFirstShip({
            token: "hubspotABC"
          });
          done();
        });
    }, 100);

    minihubspot.listen(8002);
  });

  it("should pass batch extract to hubspot batch endpoint", (done) => {
    minihull.fakeUsers(1);
    minihull.sendBatchToFirstShip()
    .then((res) => {
      const lastReq = minihubspot.requests.get("incoming").last().value();
      expect(lastReq.url).to.be.eq("/contacts/v1/contact/batch/?access_token=hubspotABC&auditId=Hull");
      expect(lastReq.body).to.be.an("array");
      expect(lastReq.body[0]).to.have.property("email");
      expect(lastReq.body[0]).to.have.property("properties");
      done();
    });
  });

  afterEach(() => {
    minihull.resetDbState();
    minihull.close();
    minihubspot.resetDbState();
    minihubspot.close();
    // connector.stopApp(app);
    // connector.stopWorker();
  });
});
