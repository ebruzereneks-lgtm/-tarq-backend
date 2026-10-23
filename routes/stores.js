const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM stores
       WHERE is_test = FALSE
       ORDER BY name ASC`
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch stores" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT *
       FROM stores
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Store not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch store" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, website_url, country, currency } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Store name is required" });
    }

    const result = await pool.query(
      `INSERT INTO stores (name, website_url, country, currency)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        name.trim(),
        website_url || null,
        country || null,
        currency || "SAR",
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create store" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, website_url, country, currency } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Store name is required" });
    }

    const result = await pool.query(
      `UPDATE stores
       SET name = $1,
           website_url = $2,
           country = $3,
           currency = $4
       WHERE id = $5
       RETURNING *`,
      [
        name.trim(),
        website_url || null,
        country || null,
        currency || "SAR",
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Store not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update store" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM stores
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Store not found" });
    }

    return res.json({ message: "Store deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete store" });
  }
});

module.exports = router;
