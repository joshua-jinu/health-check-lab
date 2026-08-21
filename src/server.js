const express = require("express");
const db = require("./db");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Orders API" });
});

// Liveness check: only verifies that the application process is alive.
// It intentionally does NOT access the database.
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Readiness check: verifies that the application can reach the database.
app.get("/ready", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).send("READY");
  } catch (err) {
    console.error("Readiness check failed:", err.message);
    res.status(503).send("NOT READY");
  }
});

app.get("/orders", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM orders ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching orders:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Orders API running on port ${port}`);
});
