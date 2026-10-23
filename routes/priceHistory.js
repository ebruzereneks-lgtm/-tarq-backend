const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;

    const result = await pool.query(
      `SELECT
         id,
         product_id,
         store_id,
         price,
         currency,
         in_stock,
         checked_at
       FROM product_prices
       WHERE product_id = $1
       ORDER BY checked_at ASC`,
      [productId]
    );

    const history = result.rows;

    if (history.length === 0) {
      return res.status(404).json({
        message: "Price history not found"
      });
    }

    const firstPrice = Number(history[0].price);
    const currentPrice = Number(history[history.length - 1].price);

    const difference = Number(
      (currentPrice - firstPrice).toFixed(2)
    );

    const percentageChange = Number(
      (((currentPrice - firstPrice) / firstPrice) * 100).toFixed(2)
    );

    let direction = "same";

    if (difference < 0) {
      direction = "down";
    } else if (difference > 0) {
      direction = "up";
    }

    let status = "BEKLE";
    let reason = "Fiyat değişimi henüz güçlü bir alım sinyali oluşturmuyor.";

    if (percentageChange <= -5) {
      status = "AL";
      reason = "Fiyat ilk kayda göre en az %5 düştü.";
    } else if (percentageChange >= 5) {
      status = "ALMA";
      reason = "Fiyat ilk kayda göre en az %5 yükseldi.";
    }

    return res.json({
      product_id: Number(productId),
      history,
      analysis: {
        first_price: firstPrice,
        current_price: currentPrice,
        difference,
        percentage_change: percentageChange,
        direction
      },
      decision: {
        status,
        reason
      }
    });
  } catch (error) {
    console.error("Price History error:", error);

    return res.status(500).json({
      error: "Server error"
    });
  }
});

module.exports = router;