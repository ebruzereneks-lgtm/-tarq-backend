const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;

    const result = await pool.query(
      `SELECT
         pp.id,
         pp.product_id,
         pp.store_id,
         pp.price,
         pp.currency,
         pp.in_stock,
         pp.checked_at,
         s.name AS store_name,
         s.is_verified,
         s.verification_status,
         s.trust_score,
         s.authenticity_risk
       FROM product_prices pp
       LEFT JOIN stores s
         ON s.id = pp.store_id
       WHERE pp.product_id = $1
       ORDER BY pp.checked_at ASC`,
      [productId]
    );

    const history = result.rows;

    if (history.length === 0) {
      return res.status(404).json({
        message: "Price history not found"
      });
    }

    const firstRecord = history[0];
    const currentRecord = history[history.length - 1];

    const firstPrice = Number(firstRecord.price);
    const currentPrice = Number(currentRecord.price);

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

    const inStock = currentRecord.in_stock === true;
    const isVerified = currentRecord.is_verified === true;

    const trustScore =
      currentRecord.trust_score === null
        ? null
        : Number(currentRecord.trust_score);

    const authenticityRisk =
      currentRecord.authenticity_risk || "unknown";

    let status = "BEKLE";
    let confidence = "medium";
    const reasons = [];
    const warnings = [];

    // STOK KONTROLU
    if (!inStock) {
      status = "ALMA";
      confidence = "high";
      reasons.push("Ürün şu anda stokta değil.");
    }

    // SAHTE / ORIJINALLIK RISKI
    if (authenticityRisk === "high") {
      status = "ALMA";
      confidence = "high";
      reasons.push("Ürünün orijinallik riski yüksek.");
    } else if (authenticityRisk === "medium") {
      if (status !== "ALMA") {
        status = "BEKLE";
      }

      warnings.push(
        "Ürünün orijinallik riski orta seviyede."
      );
    } else if (authenticityRisk === "low") {
      reasons.push("Ürünün orijinallik riski düşük.");
    } else {
      warnings.push(
        "Ürünün orijinallik riski henüz belirlenmedi."
      );
    }

    // SATICI DOGRULAMA
    if (isVerified) {
      reasons.push("Satıcı doğrulanmış.");
    } else {
      if (status !== "ALMA") {
        status = "BEKLE";
      }

      warnings.push("Satıcı henüz doğrulanmamış.");
    }

    // GUVEN PUANI
    if (trustScore !== null) {
      if (trustScore >= 80) {
        reasons.push(
          `Satıcı güven puanı yüksek: ${trustScore}/100.`
        );
      } else if (trustScore >= 60) {
        if (status !== "ALMA") {
          status = "BEKLE";
        }

        warnings.push(
          `Satıcı güven puanı orta seviyede: ${trustScore}/100.`
        );
      } else {
        status = "ALMA";
        confidence = "high";

        reasons.push(
          `Satıcı güven puanı düşük: ${trustScore}/100.`
        );
      }
    } else {
      warnings.push("Satıcı güven puanı henüz bulunmuyor.");
    }

    // FIYAT KARARI
    const trustConditionsPassed =
      inStock &&
      isVerified &&
      trustScore !== null &&
      trustScore >= 80 &&
      authenticityRisk === "low";

    if (
      status !== "ALMA" &&
      percentageChange <= -5 &&
      trustConditionsPassed
    ) {
      status = "AL";
      confidence = "high";

      reasons.unshift(
        `Fiyat ilk kayda göre %${Math.abs(
          percentageChange
        ).toFixed(2)} düştü.`
      );
    } else if (
      status !== "ALMA" &&
      percentageChange >= 5
    ) {
      status = "ALMA";
      confidence = "high";

      reasons.unshift(
        `Fiyat ilk kayda göre %${percentageChange.toFixed(
          2
        )} yükseldi.`
      );
    } else if (
      status !== "ALMA" &&
      percentageChange > -5 &&
      percentageChange < 5
    ) {
      status = "BEKLE";

      reasons.unshift(
        "Fiyat değişimi henüz güçlü bir alım sinyali oluşturmuyor."
      );
    } else if (
      status !== "ALMA" &&
      percentageChange <= -5 &&
      !trustConditionsPassed
    ) {
      status = "BEKLE";

      warnings.unshift(
        "Fiyat avantajlı olsa da güven koşullarının tamamı sağlanmadı."
      );
    }

    return res.json({
      product_id: Number(productId),
      history,
      analysis: {
        first_price: firstPrice,
        current_price: currentPrice,
        difference,
        percentage_change: percentageChange,
        direction,
        in_stock: inStock
      },
      seller_intelligence: {
        store_id: currentRecord.store_id,
        store_name: currentRecord.store_name,
        is_verified: isVerified,
        verification_status:
          currentRecord.verification_status || "unknown",
        trust_score: trustScore
      },
      authenticity_intelligence: {
        risk: authenticityRisk
      },
      decision: {
        status,
        confidence,
        reasons,
        warnings,
        evidence: {
          price_history: true,
          stock: true,
          seller_verification: true,
          trust_score: trustScore !== null,
          authenticity_risk:
            authenticityRisk !== "unknown"
        }
      }
    });
  } catch (error) {
    console.error(
      "Price History Decision Intelligence error:",
      error
    );

    return res.status(500).json({
      error: "Server error"
    });
  }
});

module.exports = router;