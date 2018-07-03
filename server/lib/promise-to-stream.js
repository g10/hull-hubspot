// @flow

const { Readable } = require("stream");

/**
 * A helper function which creates a readable stream which
 * when [_read](https://nodejs.org/docs/latest-v8.x/api/stream.html#stream_readable_read_size_1) function
 * is called it runs the provided promise to start reading data.
 * The provided promise is executed with `push` function as first and only argument, thanks to that
 * promise can push data to the stream.
 *
 * When promise resolves the stream is ended. When the promise is rejected the error is bubbled up to the stream.
 */
function promiseToStream(
  promise: (chunk: any, encoding?: string) => Promise<any>
): Readable {
  return new Readable({
    objectMode: true,
    read() {
      promise(this.push.bind(this))
        .then(() => this.push(null))
        .catch(error => this.emit("error", error));
    }
  });
}

module.exports = promiseToStream;
