import Minihull from "minihull";
import { expect } from "chai";

import Minihubspot from "./minihubspot";
import bootstrap from "./bootstrap";

process.env.CLIENT_ID = "123";
process.env.CLIENT_SECRET = "abc";
process.env.OVERRIDE_HUBSPOT_URL = "http://localhost:8002";

describe("Hubspot", function test() {
  let server, minihull, minihubspot;
  beforeEach((done) => {
    minihull = new Minihull();
    minihubspot = new Minihubspot();
    server = bootstrap();
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
    minihubspot.app.post("/contacts/v1/contact/batch/", (req, res) => {
      res.status(202).end();
    });
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

  it("should handle errors", (done) => {
    minihubspot.app.post("/contacts/v1/contact/batch/", (req, res) => {
      res.status(500).json({
        status: "error",
        message: "Errors found processing batch update",
        invalidEmails: ["foo@bar"],
        failureMessages: [{
          index: 6,
          error: {
            status: "error",
            message: "Email address foo@bar is invalid"
          }
        }]
      });
    });
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
    minihull.close();
    minihubspot.close();
    server.close();
  });
});
