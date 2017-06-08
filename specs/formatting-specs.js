const Minihull = require("minihull");
const expect = require("chai").expect;
const moment = require("moment");

const Minihubspot = require("./minihubspot");
const bootstrap = require("./bootstrap");

process.env.CLIENT_ID = "123";
process.env.CLIENT_SECRET = "abc";
process.env.OVERRIDE_HUBSPOT_URL = "http://localhost:8002";
process.env.TZ = "UTC";

describe("Hubspot properties formatting", function test() {
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
            token: "hubspotABC",
            sync_fields_to_hubspot: [{
              name: "custom_date_hubspot_create_at",
              hull: "custom_date_created_at"
            }, {
              name: "custom_hubspot_create_at",
              hull: "custom_created_at"
            }]
          });
          done();
        });
    }, 100);

    minihubspot.listen(8002);
  });

  it("should pass batch extract to hubspot batch endpoint", (done) => {
    minihubspot.stubGet("/contacts/v2/groups")
      .callsFake((req, res) => {
        res.json([{
          name: "hull",
          displayName: "Hull Properties",
          displayOrder: 1,
          properties: [{
            name: "hull_custom_hubspot_create_at",
            label: "custom_hubspot_create_at"
          }, {
            name: "hull_custom_date_hubspot_create_at",
            label: "custom_date_hubspot_create_at",
            type: "date"
          }]
        }]);
      });
    minihubspot.stubPost("/contacts/v1/contact/batch")
      .callsFake((req, res) => {
        res.status(202).end();
      });
    minihull.fakeUsers(1);
    minihull.users().get(0).set("custom_created_at", "2016-08-04T12:49:28Z").write();
    minihull.users().get(0).set("custom_date_created_at", "2016-08-04T12:49:28Z").write();
    minihull.sendBatchToFirstShip().then(() => {});
    minihubspot.on("incoming.request", (req) => {
      console.log(req.method, req.url);
    });
    minihubspot.on("incoming.request#5", (req) => {
      const lastReq = minihubspot.requests.get("incoming").last().value();
      expect(lastReq.url).to.be.eq("/contacts/v1/contact/batch/?access_token=hubspotABC&auditId=Hull");
      expect(lastReq.body).to.be.an("array");
      expect(lastReq.body[0]).to.have.property("email");
      expect(lastReq.body[0]).to.have.property("properties");
      const properties = lastReq.body[0].properties;
      expect(properties[0].property).to.equal("hull_custom_date_hubspot_create_at");
      expect(moment(properties[0].value, "x").format()).to.be.equal("2016-08-04T00:00:00+00:00");

      expect(properties[1].property).to.equal("hull_custom_hubspot_create_at");
      expect(moment(properties[1].value, "x").format()).to.be.equal("2016-08-04T12:49:28+00:00");
      done();
    });
  });

  afterEach(() => {
    minihull.close();
    minihubspot.close();
    server.close();
  });
});
