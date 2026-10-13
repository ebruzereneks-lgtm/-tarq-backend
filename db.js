const { Pool } = require("pg");

const pool = new Pool({
  user: "hkostereli",
  host: "localhost",
  database: "tarq",
  port: 5432,
});

module.exports = pool;