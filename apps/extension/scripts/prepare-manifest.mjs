import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(extensionRoot, ".env") });

const templatePath = path.join(__dirname, "manifest.template.json");
const outputPath = path.join(extensionRoot, "public", "manifest.json");

const apiBaseUrl = process.env.VITE_API_BASE_URL;
if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is required but not set in apps/extension/.env");
}
const googleClientId =
  process.env.VITE_GOOGLE_CLIENT_ID || "your-google-client-id.apps.googleusercontent.com";

const apiPermission = `${new URL(apiBaseUrl).origin}/*`;

const manifestTemplate = fs.readFileSync(templatePath, "utf-8");
const finalManifest = manifestTemplate
  .replace("__API_PERMISSION__", apiPermission)
  .replace("__GOOGLE_CLIENT_ID__", googleClientId);

fs.writeFileSync(outputPath, finalManifest, "utf-8");

