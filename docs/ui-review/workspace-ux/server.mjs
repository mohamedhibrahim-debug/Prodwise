import next from "next";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
const app = next({ dev: false, dir: fileURLToPath(new URL("../../../", import.meta.url)) });
await app.prepare();
const server = createServer(app.getRequestHandler());
server.listen(3202, "127.0.0.1", () => console.log(`UI_TEST_PORT=${server.address().port}`));