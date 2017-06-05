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
    minihubspot.stubPost("/contacts/v1/contact/batch")
      .callsFake((req, res) => {
        res.status(202).end();
      });
    minihull.fakeUsers(1);
    minihull.sendBatchToFirstShip().then(() => {});
    minihubspot.on("incoming.request#7", (req) => {
      const lastReq = minihubspot.requests.get("incoming").last().value();
      expect(lastReq.url).to.be.eq("/contacts/v1/contact/batch/?access_token=hubspotABC&auditId=Hull");
      expect(lastReq.body).to.be.an("array");
      expect(lastReq.body[0]).to.have.property("email");
      expect(lastReq.body[0]).to.have.property("properties");
      done();
    });
  });

  it("should handle errors and retry valid users", (done) => {
    minihull.fakeUsers(3);
    minihubspot.stubPost("/contacts/v1/contact/batch")
      .onFirstCall()
      .callsFake((req, res) => {
        res.status(500).json({
          status: "error",
          message: "Errors found processing batch update",
          invalidEmails: [minihull.users().get("0.email")],
          failureMessages: [{
            index: 0,
            error: {
              status: "error",
              message: `Email address ${minihull.users().get("0.email")} is invalid`
            }
          }, {
            index: 2,
            propertyValidationResult: {
              isValid: false,
              message: "1496643178000 is at 6:12:58.0 UTC, not midnight!",
              error: "INVALID_DATE",
              name: "clearbit_prospected_at"
            }
          }]
        });
      })
      .onSecondCall()
      .callsFake((req, res) => {
        res.status(202).end();
      });
    minihull.sendBatchToFirstShip().then(() => {});
    minihubspot.on("incoming.request.7", (req) => {
      const lastReq = minihubspot.requests.get("incoming").last().value();
      expect(lastReq.url).to.be.equal("/contacts/v1/contact/batch/?access_token=hubspotABC&auditId=Hull");
      expect(lastReq.body).to.be.an("array");
      expect(lastReq.body[0]).to.have.property("email");
      expect(lastReq.body[0]).to.have.property("properties");
      expect(lastReq.body.length).to.be.equal(3);
    });

    minihubspot.on("incoming.request.8", (req) => {
      console.log("incoming.request.8", req.url);
      const lastReq = minihubspot.requests.get("incoming").last().value();
      expect(lastReq.url).to.be.equal("/contacts/v1/contact/batch/?access_token=hubspotABC&auditId=Hull");
      expect(lastReq.body).to.be.an("array");
      expect(lastReq.body[0]).to.have.property("email");
      expect(lastReq.body[0]).to.have.property("properties");
      expect(lastReq.body.length).to.be.equal(1);
      done();
    });
  });

  afterEach(() => {
    minihull.close();
    minihubspot.close();
    server.close();
  });
});
