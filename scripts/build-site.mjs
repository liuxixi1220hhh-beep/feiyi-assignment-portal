import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "server"), { recursive: true });
fs.mkdirSync(path.join(dist, ".openai"), { recursive: true });
fs.copyFileSync(path.join(root, "worker", "index.js"), path.join(dist, "server", "index.js"));
fs.copyFileSync(path.join(root, ".openai", "hosting.json"), path.join(dist, ".openai", "hosting.json"));
fs.cpSync(path.join(root, "drizzle"), path.join(dist, ".openai", "drizzle"), { recursive: true });
console.log("Built Worker artifact in dist/server/index.js");
