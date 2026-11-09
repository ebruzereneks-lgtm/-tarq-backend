const express = require("express");

const {
  requireAuth
} = require("../middleware/auth");

const {
  normalizeOffer,
  validateNormalizedOffer
} = require("../data-sources/normalizeOffer");

const {
  importOffer
} = require("../data-sources/importOffer");

const router = express.Router();

/*
  TARQ Stage 8.5
  Authorized Data Sources API

  IMPORTANT:
  - Synthetic live data is prohibited.
  - Import requires explicit source metadata.
  - Data must pass normalization and validation.
*/

/*
  POST /api/data-sources/validate

  Veri tabanına yazmadan önce
  dış kaynak teklifini normalize eder
  ve doğrular.
*/
router.post(
  "/validate",
  requireAuth,
  async (req, res) => {
    try {
      const rawOffer = req.body;

      const offer =
        normalizeOffer(rawOffer);

      const validation =
        validateNormalizedOffer(
          offer
        );

      return res.json({
        success: true,
        writable:
          validation.valid,
        offer,
        validation
      });
    } catch (error) {
      console.error(
        "Data source validation error:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Data source validation failed"
      });
    }
  }
);

/*
  POST /api/data-sources/import

  Yalnız doğrulanmış normalize teklifleri
  PostgreSQL product_prices tablosuna ekler.

  Price History append-only korunur.
*/
router.post(
  "/import",
  requireAuth,
  async (req, res) => {
    try {
      const {
        rawOffer,
        productId,
        storeId,
        isTest
      } = req.body || {};

      if (
        !rawOffer ||
        typeof rawOffer !== "object" ||
        Array.isArray(rawOffer)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "rawOffer is required"
        });
      }

      if (!rawOffer.source) {
        return res.status(400).json({
          success: false,
          message:
            "Authorized data source is required"
        });
      }

      if (
        !rawOffer.source_reference &&
        !rawOffer.external_product_id &&
        !rawOffer.product_id &&
        !rawOffer.sku &&
        !rawOffer.asin
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Source reference is required"
        });
      }

      const result = await importOffer({
        rawOffer,
        productId,
        storeId,
        isTest:
          isTest === true
      });

      return res.status(201).json(
        result
      );
    } catch (error) {
      console.error(
        "Data source import error:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Offer import failed"
      });
    }
  }
);

/*
  GET /api/data-sources/status

  Gerçek kaynak erişimi açılmadan
  mevcut data-source hazırlığını gösterir.
*/
router.get(
  "/status",
  requireAuth,
  (req, res) => {
    return res.json({
      success: true,

      stage: "8.5",

      architecture: {
        normalization: "ready",
        validation: "ready",
        import_service: "ready",
        price_history:
          "append_only"
      },

      sources: {
        noon: {
          adapter: "ready",
          live_access:
            "credentials_required"
        },

        amazon: {
          adapter:
            "not_configured",
          live_access:
            "credentials_required"
        }
      },

      safety: {
        synthetic_live_data:
          false,
        source_reference_required:
          true,
        existing_price_history_preserved:
          true
      }
    });
  }
);

module.exports = router;