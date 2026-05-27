import { createApp } from "./app";
import { readApiConfig } from "./config";

const config = readApiConfig();
const app = createApp();

async function start() {
  try {
    await app.listen({
      port: config.apiPort,
      host: "0.0.0.0"
    });

    console.log(`API listening on http://localhost:${config.apiPort}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

void start();
