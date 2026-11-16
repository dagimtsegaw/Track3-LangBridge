import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { readConfig } from "./lib/config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const config = readConfig(process.env);
const app = createApp({ env: process.env });
app.listen(config.port, function () {
  console.log("api listening on " + config.port);
});
