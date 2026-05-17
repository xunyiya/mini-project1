import { env } from "./config/env";
import { createApp } from "./app";

const app = createApp();

app.listen(env.port, () => {
  console.log(`API server listening on http://localhost:${env.port}/api/v1`);
});
