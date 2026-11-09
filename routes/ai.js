const express = require("express");

const router = express.Router();

function normalizeText(value = "") {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

router.post("/intent", (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: "query alani zorunludur"
      });
    }

    const text = query.trim();
    const normalized = normalizeText(text);

    // BUTCE
    let budget = null;

    const budgetMatch = normalized.match(
      /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(sar|riyal|tl|try|usd|dolar|eur|euro)?/i
    );

    if (budgetMatch) {
      let rawBudget = budgetMatch[1];

      if (/^\d{1,3}([.,]\d{3})+$/.test(rawBudget)) {
        rawBudget = rawBudget.replace(/[.,]/g, "");
      } else {
        rawBudget = rawBudget.replace(",", ".");
      }

      const parsedBudget = Number(rawBudget);

      if (Number.isFinite(parsedBudget)) {
        budget = parsedBudget;
      }
    }

    // PARA BIRIMI
    let currency = null;

    if (/\b(sar|riyal)\b/i.test(normalized)) {
      currency = "SAR";
    } else if (/\b(tl|try)\b/i.test(normalized)) {
      currency = "TRY";
    } else if (/\b(usd|dolar)\b/i.test(normalized)) {
      currency = "USD";
    } else if (/\b(eur|euro)\b/i.test(normalized)) {
      currency = "EUR";
    }

    // KATEGORI
    let category = null;

    const categories = [
      {
        value: "phone",
        keywords: ["telefon", "phone", "smartphone", "cep telefonu"]
      },
      {
        value: "laptop",
        keywords: ["laptop", "notebook", "bilgisayar"]
      },
      {
        value: "tablet",
        keywords: ["tablet"]
      },
      {
        value: "headphones",
        keywords: ["kulaklik", "headphone", "headphones"]
      },
      {
        value: "tv",
        keywords: ["televizyon", "tv"]
      }
    ];

    for (const item of categories) {
      if (item.keywords.some((keyword) => normalized.includes(keyword))) {
        category = item.value;
        break;
      }
    }

    // MARKA
    let brand = null;

    const brands = [
      "apple",
      "samsung",
      "xiaomi",
      "huawei",
      "honor",
      "oppo",
      "sony",
      "lg",
      "lenovo",
      "asus",
      "acer",
      "hp",
      "dell"
    ];

    for (const item of brands) {
      if (normalized.includes(item)) {
        brand = item;
        break;
      }
    }

    // GUVENILIR SATICI
    const trustedSellerRequired =
      normalized.includes("guvenilir") ||
      normalized.includes("dogrulanmis") ||
      normalized.includes("yetkili satici");

    // ORIJINALLIK / SAHTE URUN RISKI
    const authenticityRequired =
      normalized.includes("orijinal") ||
      normalized.includes("sahte olmasin") ||
      normalized.includes("sahte urun istemiyorum");

    const intent = {
      need: "product_search",
      budget,
      currency,
      category,
      brand,
      trustedSellerRequired,
      authenticityRequired
    };

    return res.json({
      success: true,
      query: text,
      intent,
      nextStage: "decision_intelligence"
    });
  } catch (error) {
    console.error("TARQ AI intent error:", error);

    return res.status(500).json({
      success: false,
      error: "AI intent analysis failed"
    });
  }
});

module.exports = router;