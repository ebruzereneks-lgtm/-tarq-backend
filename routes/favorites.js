const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// Tüm Price Alerts işlemleri giriş gerektirir
router.use(auth);

// Kullanıcının kendi fiyat alarmlarını getir
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM price_alerts
       WHERE user_id = $1
       ORDER BY id DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Price Alerts error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Yeni fiyat alarmı oluştur
router.post("/", async (req, res) => {
  try {
    const {
      product_id,
      target_price,
      currency = "SAR"
    } = req.body;

    if (!product_id || !target_price) {
      return res.status(400).json({
        error: "product_id and target_price are required"
      });
    }

    if (Number(target_price) <= 0) {
      return res.status(400).json({
        error: "target_price must be greater than 0"
      });
    }

    // Ürünü kontrol et
    const productResult = await pool.query(
      `SELECT id, is_test
       FROM products
       WHERE id = $1`,
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    // Test ürünü gerçek alarma eklenemez
    if (productResult.rows[0].is_test === true) {
      return res.status(400).json({
        error: "Test products cannot be used for price alerts"
      });
    }

    const result = await pool.query(
      `INSERT INTO price_alerts
       (user_id, product_id, target_price, currency)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        req.user.id,
        product_id,
        target_price,
        currency
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create Price Alert error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Kullanıcının kendi alarmını güncelle
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { target_price, currency, is_active } = req.body;

    if (
      target_price !== undefined &&
      Number(target_price) <= 0
    ) {
      return res.status(400).json({
        error: "target_price must be greater than 0"
      });
    }

    const result = await pool.query(
      `UPDATE price_alerts
       SET target_price = COALESCE($1, target_price),
           currency = COALESCE($2, currency),
           is_active = COALESCE($3, is_active)
       WHERE id = $4
         AND user_id = $5
       RETURNING *`,
      [
        target_price ?? null,
        currency ?? null,
        is_active ?? null,
        id,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Price alert not found"
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update Price Alert error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Kullanıcının kendi alarmını sil
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM price_alerts
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Price alert not found"
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Delete Price Alert error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

