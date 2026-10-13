const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "..", "data", "users.json");

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const users = JSON.parse(raw);
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findByEmail(email) {
  const normalized = email.toLowerCase();
  return readUsers().find((user) => user.email === normalized) || null;
}

function createUser(user) {
  const users = readUsers();
  users.push(user);
  writeUsers(users);
  return user;
}

module.exports = {
  findByEmail,
  createUser,
};
