// Loads .env into process.env if present. Must run before anything below reads
// process.env.ANTHROPIC_API_KEY (agents.js / providers/anthropic.js). A real OS-level
// environment variable, if already set, still takes precedence -- dotenv never
// overwrites an existing value.
require("dotenv").config();

const express = require("express");
const path = require("path");

const campaignsRouter = require("./routes/campaigns");
const playRouter = require("./routes/play");
const recordsRouter = require("./routes/records");
const { isConfigured } = require("./agents");

const app = express();
const PORT = process.env.PORT || 4173;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Available to every view without threading it through each render() call.
app.use((req, res, next) => {
  res.locals.llmConfigured = isConfigured();
  res.locals.currentPath = req.path;
  next();
});

app.use("/", campaignsRouter);
app.use("/campaigns/:id", playRouter);
app.use("/campaigns/:id", recordsRouter);

app.use((req, res) => {
  res.status(404).render("not-found", { path: req.path });
});

app.listen(PORT, () => {
  console.log(`D&D Duo Engine UI running at http://localhost:${PORT}`);
  console.log(`Live agent bridge: ${isConfigured() ? "ENABLED" : "disabled (no ANTHROPIC_API_KEY)"}`);
});
