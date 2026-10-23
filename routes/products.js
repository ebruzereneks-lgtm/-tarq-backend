const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (q) {
      const search = `%${q}%`;
      const result = await pool.query(
        `SELECT *
         FROM products
         WHERE is_test = FALSE
           AND (
             name ILIKE $1
             OR brand ILIKE $1
             OR category ILIKE $1
           )
         ORDER BY created_at DESC`,
        [search]
      );

      return res.json(result.rows);
    }

    const result = await pool.query(
      `SELECT *
       FROM products
       WHERE is_test = FALSE
       ORDER BY created_at DESC`
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const productResult = await pool.query(
      `SELECT *
       FROM products
       WHERE id = $1`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const pricesResult = await pool.query(
      `SELECT pp.*, s.name AS store_name, s.website_url, s.country,
              s.is_verified, s.verification_status
       FROM product_prices pp
       JOIN stores s ON s.id = pp.store_id
       WHERE pp.product_id = $1
         AND pp.is_test = FALSE
         AND s.is_test = FALSE
       ORDER BY pp.price ASC`,
      [id]
    );

    return res.json({
      product: productResult.rows[0],
      prices: pricesResult.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch product" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, brand, category, description, image_url } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Product name is required" });
    }

    const result = await pool.query(
      `INSERT INTO products (name, brand, category, description, image_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        brand || null,
        category || null,
        description || null,
        image_url || null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create product" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, category, description, image_url } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Product name is required" });
    }

    const result = await pool.query(
      `UPDATE products
       SET name = $1,
           brand = $2,
           category = $3,
           description = $4,
           image_url = $5
       WHERE id = $6
       RETURNING *`,
      [
        name.trim(),
        brand || null,
        category || null,
        description || null,
        image_url || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update product" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM products
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

module.exports = router;
