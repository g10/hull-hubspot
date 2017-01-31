import express from "express";
import path from "path";
import { renderFile } from "ejs";
import timeout from "connect-timeout";

export default function WebApp() {
  const app = express();

  // the main responsibility of following timeout middleware
  // is to make the web app respond always in time
  app.use(timeout("25s"));
  app.engine("html", renderFile);

  app.set("views", path.resolve(__dirname, "..", "..", "..", "views"));
  app.set("view engine", "ejs");

  return app;
}
