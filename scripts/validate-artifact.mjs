import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workerPath = path.join(root, "dist", "server", "index.js");
const manifestPath = path.join(root, "dist", ".openai", "hosting.json");
if (!fs.existsSync(workerPath) || !fs.existsSync(manifestPath)) throw new Error("Worker artifact is incomplete.");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.d1 !== "DB" || manifest.r2 !== "BUCKET") throw new Error("D1/R2 bindings are missing.");
if (!fs.readFileSync(workerPath, "utf8").includes("export default")) throw new Error("Worker entrypoint is missing.");
console.log("Worker artifact validated");
