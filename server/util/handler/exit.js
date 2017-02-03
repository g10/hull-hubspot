/**
 * [ExitHandler description]
 * @param {[type]} promise [description]
 */
export default function ExitHandler(promise) {
  function exitNow() {
    console.warn("Exiting now !");
    process.exit(0);
  }

  function handleExit() {
    console.log("Exiting... waiting 30 seconds workers to flush");
    setTimeout(exitNow, 30000);
    promise().then(exitNow);
  }

  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);
}
