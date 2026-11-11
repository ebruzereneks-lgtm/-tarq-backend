const { Pool } = require("pg");

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  : new Pool({
      user: "hkostereli",
      host: "localhost",
      database: "tarq",
      port: 5432,
    });

module.exports = pool;