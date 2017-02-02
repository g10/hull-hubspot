import URI from "urijs";
import CSVStream from "csv-stream";
import JSONStream from "JSONStream";
import request from "request";
import ps from "promise-streams";
import BatchStream from "batch-stream";
import Promise from "bluebird";

/**
 * Class responsible for actions and operations on Hull side data - users
 */
export default class ExtractAgent {

  constructor(req, hullClient) {
    this.req = req;
    this.hullClient = hullClient;
  }

  /**
   * @param {Object} options
   * @param {Number} chunkSize
   * @param {Function} callback returning a Promise
   * @return Promise
   */
  handle({ url, format }, chunkSize, callback) {
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
          this.hullClient.logger.error("ExtractAgent.handleExtract.error", e);
          // throw e;
          return Promise.reject(e);
        }
      }))
      .wait();
  }

  /**
   * Start an extract job and be notified with the url when complete.
   * @param  {Object} segment - A segment
   * @param  {String} format - csv or json
   * @return {Promise}
   */
  request({ segment = null, format = "json", path = "batch", fields = [] }) {
    const { hostname } = this.req;
    const search = (this.req.query || {});
    if (segment) {
      search.segment_id = segment.id;
    }
    const url = URI(`https://${hostname}`)
      .path(path)
      .search(search)
      .toString();

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
      this.hullClient.logger.info("extractAgent.requestExtract", params);
      return this.hullClient.post("extract/user_reports", params);
    });
  }
}
