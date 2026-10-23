const express = require("express");
const pool = require("../db");

const router = express.Router();

async function triggerPriceAlerts(
  client,
  productId,
  currentPrice,
  currency
) {
  const alertsResult = await client.query(
    `SELECT
       pa.id,
       pa.user_id,
       pa.target_price,
       p.name AS product_name
     FROM price_alerts pa
     JOIN products p ON p.id = pa.product_id
     WHERE pa.product_id = $1
       AND pa.currency = $2
       AND pa.is_active = TRUE
       AND pa.triggered_at IS NULL
       AND pa.target_price >= $3
     FOR UPDATE`,
    [productId, currency, currentPrice]
  );

  for (const alert of alertsResult.rows) {
    await client.query(
      `UPDATE price_alerts
       SET is_active = FALSE,
           triggered_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND is_active = TRUE
         AND triggered_at IS NULL`,
      [alert.id]
    );

    await client.query(
      `INSERT INTO notifications
       (user_id, title, message, is_read)
       VALUES ($1, $2, $3, FALSE)`,
      [
        alert.user_id,
        "Fiyat alarmı tetiklendi",
        `${alert.product_name} fiyatı ${currentPrice} ${currency} seviyesine düştü. Hedef fiyatınız ${alert.target_price} ${currency}.`
      ]
    );
  }

  return alertsResult.rows.length;
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         pp.id,
         p.name AS product_name,
         p.brand,
         s.name AS store_name,
         pp.price,
         pp.currency,
         pp.in_stock,
         pp.product_url,
         pp.checked_at,
         s.is_verified,
         s.verification_status
       FROM product_prices pp
       JOIN products p ON p.id = pp.product_id
       JOIN stores s ON s.id = pp.store_id
       WHERE pp.is_test = FALSE
         AND p.is_test = FALSE
         AND s.is_test = FALSE
       ORDER BY p.name ASC, pp.price ASC`
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to fetch prices"
    });
  }
});

router.get("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const result = await pool.query(
      `SELECT
         pp.id,
         p.name AS product_name,
         p.brand,
         s.name AS store_name,
         pp.price,
         pp.currency,
         pp.in_stock,
         pp.product_url,
         pp.checked_at,
         s.is_verified,
         s.verification_status
       FROM product_prices pp
       JOIN products p ON p.id = pp.product_id
       JOIN stores s ON s.id = pp.store_id
       WHERE pp.product_id = $1
         AND pp.is_test = FALSE
         AND p.is_test = FALSE
         AND s.is_test = FALSE
       ORDER BY pp.price ASC`,
      [productId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to fetch product prices"
    });
  }
});

router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      product_id,
      store_id,
      price,
      currency,
      product_url,
      in_stock
    } = req.body || {};

    if (
      product_id == null ||
      store_id == null ||
      price == null ||
      price === ""
    ) {
      return res.status(400).json({
        message: "product_id, store_id and price are required"
      });
    }

    const numericPrice = Number(price);
    const selectedCurrency = currency || "SAR";

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        message: "price must be a positive number"
      });
    }

    await client.query("BEGIN");

    const productResult = await client.query(
      `SELECT id, is_test
       FROM products
       WHERE id = $1`,
      [product_id]
    );

    if (productResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Product not found"
      });
    }

    const storeResult = await client.query(
      `SELECT id, is_test
       FROM stores
       WHERE id = $1`,
      [store_id]
    );

    if (storeResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Store not found"
      });
    }

    const isTest =
      productResult.rows[0].is_test === true ||
      storeResult.rows[0].is_test === true;

    const result = await client.query(
      `INSERT INTO product_prices
       (
         product_id,
         store_id,
         price,
         currency,
         product_url,
         in_stock,
         is_test
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        product_id,
        store_id,
        numericPrice,
        selectedCurrency,
        product_url || null,
        in_stock !== undefined ? in_stock : true,
        isTest
      ]
    );

    let triggeredAlertCount = 0;

    if (!isTest) {
      triggeredAlertCount = await triggerPriceAlerts(
        client,
        product_id,
        numericPrice,
        selectedCurrency
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      price: result.rows[0],
      triggered_alert_count: triggeredAlertCount
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return res.status(500).json({
      message: "Failed to create price"
    });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const {
      price,
      currency,
      product_url,
      in_stock
    } = req.body || {};

    if (price == null || price === "") {
      return res.status(400).json({
        message: "price is required"
      });
    }

    const numericPrice = Number(price);
    const selectedCurrency = currency || "SAR";

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        message: "price must be a positive number"
      });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE product_prices
       SET price = $1,
           currency = $2,
           product_url = $3,
           in_stock = $4,
           checked_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        numericPrice,
        selectedCurrency,
        product_url || null,
        in_stock !== undefined ? in_stock : true,
        id
      ]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Price not found"
      });
    }

    let triggeredAlertCount = 0;
    const updatedPrice = result.rows[0];

    if (updatedPrice.is_test !== true) {
      triggeredAlertCount = await triggerPriceAlerts(
        client,
        updatedPrice.product_id,
        numericPrice,
        selectedCurrency
      );
    }

    await client.query("COMMIT");

    return res.json({
      price: updatedPrice,
      triggered_alert_count: triggeredAlertCount
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return res.status(500).json({
      message: "Failed to update price"
    });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM product_prices
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Price not found"
      });
    }

    return res.json({
      message: "Price deleted successfully"
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to delete price"
    });
  }
});

module.exports = router;