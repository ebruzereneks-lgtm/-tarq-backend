const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/:productId", requireAuth, async (req, res) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id"
      });
    }

    const userResult = await pool.query(
      `SELECT id, name, email
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    const user = userResult.rows[0];

    const profileResult = await pool.query(
      `SELECT
         budget,
         budget_currency,
         preferred_brands,
         trusted_seller_required,
         authenticity_risk_tolerance,
         preferences_json
       FROM user_profiles
       WHERE user_id = $1`,
      [user.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User personalization profile not found"
      });
    }

    const profile = profileResult.rows[0];

    const priceResult = await pool.query(
      `SELECT
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
       LEFT JOIN stores s ON s.id = pp.store_id
       WHERE pp.product_id = $1
       ORDER BY pp.checked_at ASC`,
      [productId]
    );

    const history = priceResult.rows;

    if (history.length === 0) {
      return res.status(404).json({
        success: false,
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

    const budget =
      profile.budget === null
        ? null
        : Number(profile.budget);

    const budgetCurrency = profile.budget_currency;
    const productCurrency = currentRecord.currency;

    const currencyMatch =
      budget === null
        ? null
        : budgetCurrency === productCurrency;

    const withinBudget =
      budget !== null && currencyMatch
        ? currentPrice <= budget
        : null;

    const inStock = currentRecord.in_stock === true;
    const isVerified = currentRecord.is_verified === true;

    const trustScore =
      currentRecord.trust_score === null
        ? null
        : Number(currentRecord.trust_score);

    const authenticityRisk =
      currentRecord.authenticity_risk || "unknown";

    const trustedSellerRequired =
      profile.trusted_seller_required === true;

    const riskTolerance =
      profile.authenticity_risk_tolerance || "low";

    let authenticityPassed = false;

    if (riskTolerance === "low") {
      authenticityPassed = authenticityRisk === "low";
    } else if (riskTolerance === "medium") {
      authenticityPassed =
        authenticityRisk === "low" ||
        authenticityRisk === "medium";
    } else {
      authenticityPassed =
        authenticityRisk !== "unknown";
    }

    let status = "BEKLE";
    let confidence = "medium";

    const reasons = [];
    const warnings = [];

    if (budget === null) {
      warnings.push("Kullanıcı bütçesi tanımlanmamış.");
    } else if (!currencyMatch) {
      warnings.push(
        "Ürün ve bütçe para birimleri eşleşmiyor."
      );
    } else if (withinBudget) {
      reasons.push(
        `Ürün ${budget} ${budgetCurrency} bütçenize uygun.`
      );
    } else {
      status = "ALTERNATİF VAR";
      confidence = "high";

      warnings.push(
        `Ürün bütçenizi ${(currentPrice - budget).toFixed(2)} ${productCurrency} aşıyor.`
      );
    }

    if (inStock) {
      reasons.push("Ürün stokta.");
    } else {
      status = "ALMA";
      confidence = "high";
      warnings.push("Ürün şu anda stokta değil.");
    }

    if (trustedSellerRequired && !isVerified) {
      status = "ALMA";
      confidence = "high";

      warnings.push(
        "Kullanıcı doğrulanmış satıcı istiyor ancak satıcı doğrulanmamış."
      );
    } else if (isVerified) {
      reasons.push("Satıcı doğrulanmış.");
    }

    if (trustScore === null) {
      warnings.push("Satıcı güven puanı bulunmuyor.");
    } else if (trustScore >= 80) {
      reasons.push(
        `Satıcı güven puanı yüksek: ${trustScore}/100.`
      );
    } else if (trustScore >= 60) {
      warnings.push(
        `Satıcı güven puanı orta: ${trustScore}/100.`
      );
    } else {
      status = "ALMA";
      confidence = "high";

      warnings.push(
        `Satıcı güven puanı düşük: ${trustScore}/100.`
      );
    }

    if (authenticityPassed) {
      reasons.push(
        `Orijinallik riski tercihinize uygun: ${authenticityRisk}.`
      );
    } else {
      status = "ALMA";
      confidence = "high";

      warnings.push(
        `Orijinallik riski tercihinize uygun değil: ${authenticityRisk}.`
      );
    }

    if (percentageChange <= -5) {
      reasons.push(
        `Fiyat ilk kayda göre %${Math.abs(percentageChange).toFixed(2)} düştü.`
      );
    } else if (percentageChange >= 5) {
      status = "ALMA";
      confidence = "high";

      warnings.push(
        `Fiyat ilk kayda göre %${percentageChange.toFixed(2)} yükseldi.`
      );
    } else {
      reasons.push(
        "Fiyat değişimi güçlü bir alım fırsatı oluşturmuyor."
      );
    }

    const trustPassed =
      inStock &&
      (!trustedSellerRequired || isVerified) &&
      trustScore !== null &&
      trustScore >= 80 &&
      authenticityPassed;

    if (
      status !== "ALMA" &&
      status !== "ALTERNATİF VAR" &&
      percentageChange <= -5 &&
      trustPassed &&
      withinBudget !== false
    ) {
      status = "AL";
      confidence = "high";
    }

    const evidence = {
      user_profile: true,
      price_history: true,
      stock: true,
      seller_verification: true,
      trust_score: trustScore !== null,
      authenticity_risk: authenticityRisk !== "unknown"
    };

    const evidenceCount =
      Object.values(evidence).filter(Boolean).length;

    const evidenceTotal = Object.keys(evidence).length;

    let title;
    let summary;
    let nextAction;

    if (status === "AL") {
      title = "Bu ürün şu anda alınabilir";
      summary =
        "Fiyat, bütçe, stok, satıcı güveni ve orijinallik riski birlikte değerlendirildiğinde uygun bir fırsat görünüyor.";
      nextAction =
        "Satın almadan önce mağazadaki güncel fiyat ve stok bilgisini son kez kontrol edin.";
    } else if (status === "ALMA") {
      title = "Bu ürünü şu anda almayın";
      summary =
        "Fiyat, stok, satıcı güveni veya orijinallik riski açısından olumsuz bir sinyal bulundu.";
      nextAction =
        "Daha güvenilir veya daha düşük riskli bir alternatif arayın.";
    } else if (status === "ALTERNATİF VAR") {
      title = "Bütçenize uygun alternatif arayın";
      summary =
        "Mevcut ürün belirlediğiniz bütçe sınırını aşıyor.";
      nextAction =
        "Doğrulanmış satıcılardaki daha uygun fiyatlı alternatifleri karşılaştırın.";
    } else {
      title = "Şimdilik beklemek daha uygun";
      summary =
        "Mevcut veriler henüz güçlü bir satın alma fırsatı oluşturmuyor.";
      nextAction =
        "Fiyat alarmı oluşturup ürünü takip etmeye devam edin.";
    }

    return res.json({
      success: true,
      user,
      product_id: productId,

      personalization: {
        budget,
        budget_currency: budgetCurrency,
        preferred_brands: profile.preferred_brands || [],
        trusted_seller_required: trustedSellerRequired,
        authenticity_risk_tolerance: riskTolerance,
        preferences: profile.preferences_json || {}
      },

      price_analysis: {
        first_price: firstPrice,
        current_price: currentPrice,
        currency: productCurrency,
        difference,
        percentage_change: percentageChange,
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
        risk: authenticityRisk,
        user_tolerance: riskTolerance
      },

      personalized_decision: {
        status,
        confidence,
        reasons,
        warnings,
        checks: {
          within_budget: withinBudget,
          currency_match: currencyMatch,
          in_stock: inStock,
          trusted_seller: isVerified,
          trust_score_passed:
            trustScore !== null && trustScore >= 80,
          authenticity_risk_passed: authenticityPassed,
          price_signal:
            percentageChange <= -5
              ? "buy"
              : percentageChange >= 5
                ? "avoid"
                : "wait"
        },
        evidence
      },

      explainable_ai: {
        title,
        summary,
        recommendation: status,
        confidence,
        evidence_quality:
          evidenceCount === evidenceTotal
            ? "high"
            : evidenceCount >= Math.ceil(evidenceTotal / 2)
              ? "medium"
              : "low",
        evidence_available: evidenceCount,
        evidence_total: evidenceTotal,
        reasons,
        warnings:
          warnings.length > 0
            ? warnings
            : ["Kritik bir uyarı bulunmuyor."],
        next_action: nextAction,
        disclaimer:
          "TARQ kararı mevcut fiyat, stok, satıcı, güven ve risk verilerine dayanır. Satın alma öncesinde güncel mağaza bilgileri yeniden kontrol edilmelidir."
      }
    });
  } catch (error) {
    console.error(
      "Personalized Decision error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create personalized decision"
    });
  }
});

module.exports = router;