import * as dotenv from "dotenv";

import * as path from "path";
import * as fs from "fs";
import * as express from "express";

import { createServer } from "https";
import { SocketServer } from "./utils/socket-server";

dotenv.config();

const { HOST, PORT, ENV } = process.env;

const app = express();

const clientDistFolder = "./dist";

console.log(`> Serving frontend from ${clientDistFolder}`);

app.use(express.static(path.join(__dirname, clientDistFolder)));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, clientDistFolder, "index.html"));
});

if (ENV === "production") {
  const privateKey = fs.readFileSync("/etc/letsencrypt/live/app.avcore.io/privkey.pem", "utf8");
  const certificate = fs.readFileSync("/etc/letsencrypt/live/app.avcore.io/cert.pem", "utf8");
  const ca = fs.readFileSync("/etc/letsencrypt/live/app.avcore.io/chain.pem", "utf8");

  const credentials = {
    key: privateKey,
    cert: certificate,
    ca,
  };

  const httpsServer = createServer(credentials, app);
  new SocketServer(httpsServer);

  httpsServer.listen(PORT, () => {
    console.log(`> HTTPS Server running on port ${PORT}`);
  });
} else {
  app.listen(Number(PORT), HOST, () => {
    console.log("listening");
  });
}
