const Minihull = require("minihull");
const expect = require("chai").expect;
const moment = require("moment");

const Minihubspot = require("./support/minihubspot");
const bootstrap = require("./support/bootstrap");

process.env.CLIENT_ID = "123";
process.env.CLIENT_SECRET = "abc";
process.env.OVERRIDE_HUBSPOT_URL = "http://localhost:8002";
process.env.TZ = "UTC";

describe("Hubspot properties formatting", function test() {
  let server, minihull, minihubspot;

  beforeEach((done) => {
    minihull = new Minihull();
    minihubspot = new Minihubspot();
    server = bootstrap(8000);
    minihull.stubConnector({
      id: "123456789012345678901234",
      private_settings: {
        token: "hubspotABC",
        sync_fields_to_hubspot: [{
          name: "custom_date_hubspot_create_at",
          hull: "custom_date_created_at"
        }, {
          name: "custom_hubspot_create_at",
          hull: "custom_created_at"
        }],
        synchronized_segments: ["a"]
      }
    });
    minihubspot.listen(8002);
    minihull.listen(8001).then(done);
  });

  it("should pass batch extract to hubspot batch endpoint", (done) => {
    minihubspot.stubApp("/contacts/v2/groups")
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
    minihubspot.stubApp("post", "/contacts/v1/contact/batch")
      .callsFake((req, res) => {
        res.status(202).end();
      });
    minihull.stubBatch([{
      email: "foo@bar.com",
      custom_created_at: "2016-08-04T12:49:28Z",
      custom_date_created_at: "2016-08-04T12:49:28Z",
      segment_ids: ["a"]
    }])
    minihull.batchConnector("123456789012345678901234", "http://localhost:8000/batch");
    minihubspot.on("incoming.request#3", (req) => {
      const lastReq = minihubspot.requests.get("incoming").last().value();
      expect(lastReq.url).to.be.eq("/contacts/v1/contact/batch/?auditId=Hull");
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
