import _ from "lodash";
import Promise from "bluebird";
import CSVStream from "csv-stream";
import ps from "promise-streams";
import BatchStream from "batch-stream";
import JSONStream from "JSONStream";
import request from "request";
import URI from "urijs";


function getProperties(raw, path, id_path) {
  const properties = {};
  const tree = [];

  _.each(raw, (props) => {
    const title = props.text || props.name;
    const key = props.id || props.key;
    const node = { ...props, id_path, path, title, key };

    if (key) {
      properties[key] = node;
    } else if (node.children) {
      const path_id = node.ship_id || node.app_id || node.platform_id || node.resource_id || title;

      const lpath = (path || []).concat([title]);
      const ipath = (id_path || []).concat([path_id]);
      const result = getProperties(node.children, lpath, ipath);
      node.children = result.tree;
      Object.assign(properties, result.properties);
    }

    tree.push(node);
  });

  return { properties, tree };
}

export default class HullAgent {
  constructor(ship, hullClient, mapping, query, hostname, shipCache) {
    this.ship = ship;
    this.hullClient = hullClient;
    this.mapping = mapping;
    this.query = query;
    this.hostname = hostname;
    this.shipCache = shipCache;
  }

  getSegments() {
    return this.hullClient.get("segments", { limit: 500 });
  }

  updateShipSettings(newSettings) {
    this.hullClient.get(this.ship.id)
      .then(ship => {
        this.ship = ship;
        const private_settings = { ...this.ship.private_settings, ...newSettings };
        this.ship.private_settings = private_settings;
        return this.hullClient.put(this.ship.id, { private_settings });
      })
      .then((ship) => {
        return this.shipCache.del(this.ship.id)
          .then(() => {
            return ship;
          });
      });
  }

  /**
   * gets all existing Properties in the organization along with their metadata
   * @return {Promise}
   */
  getAvailableProperties() {
    return this.hullClient
      .get("search/user_reports/bootstrap")
      .then(({ tree }) => getProperties(tree).properties);
  }

  /**
  * creates or updates users
  * @see https://www.hull.io/docs/references/api/#endpoint-traits
  * @param  {Array} Hubspot contacts
  * @return {Promise}
  */
  saveContacts(contacts) {
    this.hullClient.logger.info("saveContacts", contacts.length);
    return Promise.all(contacts.map((c) => {
      const traits = this.mapping.getHullTraits(c);
      if (!traits.email) {
        return "";
      }
      const ident = this.mapping.getIdentFromHubspot(c);
      return this.hullClient.as(ident).traits(traits);
    }));
  }

  shouldSyncUser(user) {
    const segmentIds = this.ship.private_settings.synchronized_segments || [];
    if (segmentIds.length === 0) {
      return true;
    }
    return _.intersection(segmentIds, user.segment_ids).length > 0
      && !_.isEmpty(user.email);
  }

  /**
   * Wrapper for batch call handlers
   * Streams the data from the extract URL and calls a handler with batches of users
   * @param  {String}
   * @param  {String}
   * @param  {Function}
   * @return {Promise}
   */
  handleExtract({ url, format }, chunkSize, callback) {
    if (!url) return Promise.reject(new Error("Missing URL"));
    const decoder = format === "csv" ? CSVStream.createStream({ escapeChar: "\"", enclosedChar: "\"" }) : JSONStream.parse();

    const batch = new BatchStream({ size: chunkSize });

    return request({ url })
      .pipe(decoder)
      .pipe(batch)
      .pipe(ps.map({ concurrent: 2 }, (...args) => {
        try {
          return callback(...args);
        } catch (e) {
          console.error(e);
          throw e;
        }
      }))
      .wait();
  }

  requestExtract({ segment = null, format = "json", path = "batch", fields = [], remove = false }) {
    const hostname = this.hostname;
    const search = (this.query || {});
    if (segment && !remove) {
      search.segment_id = segment.id;
    }
    const url = URI(`https://${hostname}`)
      .path(path)
      .search(search)
      .toString();

    if (_.isEmpty(fields)) {
      fields = this.mapping.getHullTraitsKeys();
    }

    fields.push("segment_ids");

    return (() => {
      if (segment == null) {
        return Promise.resolve({
          query: {}
        });
      }

      if (segment.query) {
        return Promise.resolve(segment);
      }
      return this.hullClient.get(segment.id);
    })()
    .then(({ query }) => {
      const params = { query, format, url, fields };
      return this.hullClient.post("extract/user_reports", params);
    });
  }
}
