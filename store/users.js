const pool = require("../db");

async function findByEmail(email) {
  const normalized = email.toLowerCase();

  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [normalized]
  );

  return result.rows[0] || null;
}

async function createUser(user) {
  const result = await pool.query(
    `INSERT INTO users (name, email, password)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [user.name, user.email, user.password]
  );

  return result.rows[0];
}

module.exports = {
  findByEmail,
  createUser,
};