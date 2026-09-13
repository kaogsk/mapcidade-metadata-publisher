import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3340);
const lastConnectionFile = process.env.LAST_CONNECTION_FILE ?? ".mapcidade_last_connection.json";

const app = createApp({ lastConnectionFile });

app.listen(port, () => {
  console.log(`Publicador de Metadados — API em http://127.0.0.1:${String(port)}/api`);
});
