import * as dotenv from "dotenv";

import * as path from "path";
import * as express from "express";

dotenv.config();

const { HOST, PORT } = process.env;
console.log(PORT);

const app = express();

const clientDistFolder = "./dist";

console.log(`> Serving frontend from ${clientDistFolder}`);

app.use(express.static(path.join(__dirname, clientDistFolder)));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, clientDistFolder, "index.html"));
});

app.listen(Number(PORT), HOST, () => {
  console.log("listening");
});
