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
    return res.status(500).json({
      message: "Failed to fetch stores",
    });
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
      return res.status(404).json({
        message: "Store not found",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch store",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      name,
      website_url,
      country,
      currency,
      is_test,
      is_verified,
      verification_status,
      trust_score,
      authenticity_risk,
    } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Store name is required",
      });
    }

    const selectedIsTest = is_test === true;
    const selectedIsVerified = is_verified === true;

    const selectedVerificationStatus =
      typeof verification_status === "string"
        ? verification_status.trim()
        : selectedIsVerified
            ? "verified"
            : "unverified";

    let selectedTrustScore = null;

    if (
      trust_score !== undefined &&
      trust_score !== null &&
      trust_score !== ""
    ) {
      selectedTrustScore = Number(trust_score);

      if (
        !Number.isFinite(selectedTrustScore) ||
        selectedTrustScore < 0 ||
        selectedTrustScore > 100
      ) {
        return res.status(400).json({
          message: "trust_score must be between 0 and 100",
        });
      }
    }

    const allowedRisks = [
      "low",
      "medium",
      "high",
    ];

    let selectedAuthenticityRisk = null;

    if (
      typeof authenticity_risk === "string" &&
      authenticity_risk.trim()
    ) {
      selectedAuthenticityRisk =
        authenticity_risk.trim().toLowerCase();

      if (
        !allowedRisks.includes(
          selectedAuthenticityRisk
        )
      ) {
        return res.status(400).json({
          message:
            "authenticity_risk must be low, medium or high",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO stores (
        name,
        website_url,
        country,
        currency,
        is_test,
        is_verified,
        verification_status,
        trust_score,
        authenticity_risk
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      RETURNING *`,
      [
        name.trim(),
        website_url || null,
        country || null,
        currency || "SAR",
        selectedIsTest,
        selectedIsVerified,
        selectedVerificationStatus,
        selectedTrustScore,
        selectedAuthenticityRisk,
      ]
    );

    return res.status(201).json(
      result.rows[0]
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to create store",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      website_url,
      country,
      currency,
      is_test,
      is_verified,
      verification_status,
      trust_score,
      authenticity_risk,
    } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Store name is required",
      });
    }

    const selectedIsTest = is_test === true;
    const selectedIsVerified = is_verified === true;

    const selectedVerificationStatus =
      typeof verification_status === "string"
        ? verification_status.trim()
        : selectedIsVerified
            ? "verified"
            : "unverified";

    let selectedTrustScore = null;

    if (
      trust_score !== undefined &&
      trust_score !== null &&
      trust_score !== ""
    ) {
      selectedTrustScore = Number(trust_score);

      if (
        !Number.isFinite(selectedTrustScore) ||
        selectedTrustScore < 0 ||
        selectedTrustScore > 100
      ) {
        return res.status(400).json({
          message: "trust_score must be between 0 and 100",
        });
      }
    }

    const allowedRisks = [
      "low",
      "medium",
      "high",
    ];

    let selectedAuthenticityRisk = null;

    if (
      typeof authenticity_risk === "string" &&
      authenticity_risk.trim()
    ) {
      selectedAuthenticityRisk =
        authenticity_risk.trim().toLowerCase();

      if (
        !allowedRisks.includes(
          selectedAuthenticityRisk
        )
      ) {
        return res.status(400).json({
          message:
            "authenticity_risk must be low, medium or high",
        });
      }
    }

    const result = await pool.query(
      `UPDATE stores
       SET name = $1,
           website_url = $2,
           country = $3,
           currency = $4,
           is_test = $5,
           is_verified = $6,
           verification_status = $7,
           trust_score = $8,
           authenticity_risk = $9
       WHERE id = $10
       RETURNING *`,
      [
        name.trim(),
        website_url || null,
        country || null,
        currency || "SAR",
        selectedIsTest,
        selectedIsVerified,
        selectedVerificationStatus,
        selectedTrustScore,
        selectedAuthenticityRisk,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Store not found",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to update store",
    });
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
      return res.status(404).json({
        message: "Store not found",
      });
    }

    return res.json({
      message: "Store deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to delete store",
    });
  }
});

module.exports = router;