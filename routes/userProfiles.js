const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_CURRENCIES = [
  "SAR",
  "TRY",
  "USD",
  "EUR"
];

const ALLOWED_RISK_LEVELS = [
  "low",
  "medium",
  "high"
];

function normalizeBrands(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  ];
}

async function findAuthenticatedUser(email) {
  const result = await pool.query(
    `SELECT id, name, email
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email]
  );

  return result.rows[0] || null;
}

/*
  GET /api/user-profiles/me

  Giriş yapan kullanıcının kişiselleştirme
  profilini getirir.
*/
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await findAuthenticatedUser(
      req.user.email
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    const result = await pool.query(
      `SELECT
         user_id,
         budget,
         budget_currency,
         preferred_brands,
         trusted_seller_required,
         authenticity_risk_tolerance,
         preferences_json,
         created_at,
         updated_at
       FROM user_profiles
       WHERE user_id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        profile: null,
        message:
          "User profile has not been created yet"
      });
    }

    const profile = result.rows[0];

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      profile: {
        ...profile,
        budget:
          profile.budget === null
            ? null
            : Number(profile.budget)
      }
    });
  } catch (error) {
    console.error(
      "Get user profile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile"
    });
  }
});

/*
  PUT /api/user-profiles/me

  Profili ilk kez oluşturur veya mevcut
  profili günceller.
*/
router.put("/me", requireAuth, async (req, res) => {
  try {
    const user = await findAuthenticatedUser(
      req.user.email
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    const {
      budget,
      budget_currency,
      preferred_brands,
      trusted_seller_required,
      authenticity_risk_tolerance,
      preferences_json
    } = req.body || {};

    let selectedBudget = null;

    if (
      budget !== undefined &&
      budget !== null &&
      budget !== ""
    ) {
      selectedBudget = Number(budget);

      if (
        !Number.isFinite(selectedBudget) ||
        selectedBudget < 0 ||
        selectedBudget > 9999999999.99
      ) {
        return res.status(400).json({
          success: false,
          message:
            "budget must be a valid positive number"
        });
      }
    }

    const selectedCurrency =
      typeof budget_currency === "string"
        ? budget_currency.trim().toUpperCase()
        : "SAR";

    if (
      !ALLOWED_CURRENCIES.includes(
        selectedCurrency
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "budget_currency must be SAR, TRY, USD or EUR"
      });
    }

    if (
      preferred_brands !== undefined &&
      !Array.isArray(preferred_brands)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "preferred_brands must be an array"
      });
    }

    const selectedBrands = normalizeBrands(
      preferred_brands
    );

    const selectedTrustedSellerRequired =
      typeof trusted_seller_required ===
      "boolean"
        ? trusted_seller_required
        : true;

    const selectedRiskTolerance =
      typeof authenticity_risk_tolerance ===
      "string"
        ? authenticity_risk_tolerance
            .trim()
            .toLowerCase()
        : "low";

    if (
      !ALLOWED_RISK_LEVELS.includes(
        selectedRiskTolerance
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "authenticity_risk_tolerance must be low, medium or high"
      });
    }

    const selectedPreferences =
      preferences_json &&
      typeof preferences_json === "object" &&
      !Array.isArray(preferences_json)
        ? preferences_json
        : {};

    const result = await pool.query(
      `INSERT INTO user_profiles (
         user_id,
         budget,
         budget_currency,
         preferred_brands,
         trusted_seller_required,
         authenticity_risk_tolerance,
         preferences_json,
         created_at,
         updated_at
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7::jsonb,
         CURRENT_TIMESTAMP,
         CURRENT_TIMESTAMP
       )
       ON CONFLICT (user_id)
       DO UPDATE SET
         budget = EXCLUDED.budget,
         budget_currency =
           EXCLUDED.budget_currency,
         preferred_brands =
           EXCLUDED.preferred_brands,
         trusted_seller_required =
           EXCLUDED.trusted_seller_required,
         authenticity_risk_tolerance =
           EXCLUDED.authenticity_risk_tolerance,
         preferences_json =
           EXCLUDED.preferences_json,
         updated_at = CURRENT_TIMESTAMP
       RETURNING
         user_id,
         budget,
         budget_currency,
         preferred_brands,
         trusted_seller_required,
         authenticity_risk_tolerance,
         preferences_json,
         created_at,
         updated_at`,
      [
        user.id,
        selectedBudget,
        selectedCurrency,
        selectedBrands,
        selectedTrustedSellerRequired,
        selectedRiskTolerance,
        JSON.stringify(selectedPreferences)
      ]
    );

    const profile = result.rows[0];

    return res.json({
      success: true,
      message:
        "User profile saved successfully",
      profile: {
        ...profile,
        budget:
          profile.budget === null
            ? null
            : Number(profile.budget)
      },
      decision_preferences: {
        maximum_budget:
          profile.budget === null
            ? null
            : Number(profile.budget),
        currency: profile.budget_currency,
        preferred_brands:
          profile.preferred_brands || [],
        trusted_seller_required:
          profile.trusted_seller_required,
        authenticity_risk_tolerance:
          profile.authenticity_risk_tolerance
      }
    });
  } catch (error) {
    console.error(
      "Save user profile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save user profile"
    });
  }
});

module.exports = router;