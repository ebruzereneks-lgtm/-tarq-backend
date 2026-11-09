/*
  TARQ - Authorized Offer Import Service
  Stage 8.5

  Amaç:
  - Normalize edilmiş teklifleri doğrulamak
  - Ürün ve mağaza kayıtlarını kontrol etmek
  - Yeni fiyatı product_prices tablosuna eklemek
  - Eski fiyat kayıtlarını silmemek
  - Price History yapısını korumak
  - Kaynağı belirsiz veriyi reddetmek
*/

const pool = require("../db");

const {
  prepareOffer
} = require("./normalizeOffer");

async function importOffer({
  rawOffer,
  productId,
  storeId,
  isTest = false
}) {
  const selectedProductId =
    Number(productId);

  const selectedStoreId =
    Number(storeId);

  if (
    !Number.isInteger(
      selectedProductId
    ) ||
    selectedProductId <= 0
  ) {
    throw new Error(
      "Valid productId is required"
    );
  }

  if (
    !Number.isInteger(
      selectedStoreId
    ) ||
    selectedStoreId <= 0
  ) {
    throw new Error(
      "Valid storeId is required"
    );
  }

  const {
    offer,
    validation
  } = prepareOffer(rawOffer);

  if (!validation.valid) {
    throw new Error(
      `Offer validation failed: ${validation.errors.join(
        ", "
      )}`
    );
  }

  if (!offer.source_reference) {
    throw new Error(
      "Authorized source reference is required"
    );
  }

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const productResult =
      await client.query(
        `SELECT
           id,
           name,
           is_test
         FROM products
         WHERE id = $1
         LIMIT 1`,
        [selectedProductId]
      );

    if (
      productResult.rows.length === 0
    ) {
      throw new Error(
        "Product not found"
      );
    }

    const storeResult =
      await client.query(
        `SELECT
           id,
           name,
           is_test,
           is_verified,
           verification_status,
           trust_score,
           authenticity_risk
         FROM stores
         WHERE id = $1
         LIMIT 1`,
        [selectedStoreId]
      );

    if (
      storeResult.rows.length === 0
    ) {
      throw new Error(
        "Store not found"
      );
    }

    const product =
      productResult.rows[0];

    const store =
      storeResult.rows[0];

    const selectedIsTest =
      isTest === true ||
      product.is_test === true ||
      store.is_test === true;

    /*
      Üretim kaydı için kaynak ve
      ürün kimliği zorunludur.
    */
    if (
      !selectedIsTest &&
      !offer.external_product_id
    ) {
      throw new Error(
        "External product id is required for production data"
      );
    }

    const insertResult =
      await client.query(
        `INSERT INTO product_prices (
           product_id,
           store_id,
           price,
           currency,
           product_url,
           in_stock,
           checked_at,
           is_test
         )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           CURRENT_TIMESTAMP,
           $7
         )
         RETURNING
           id,
           product_id,
           store_id,
           price,
           currency,
           product_url,
           in_stock,
           checked_at,
           is_test`,
        [
          selectedProductId,
          selectedStoreId,
          offer.price,
          offer.currency,
          offer.product_url,
          offer.in_stock,
          selectedIsTest
        ]
      );

    await client.query("COMMIT");

    const priceRecord =
      insertResult.rows[0];

    return {
      success: true,

      message:
        "Authorized offer imported successfully",

      source: {
        name: offer.source,
        external_product_id:
          offer.external_product_id,
        source_reference:
          offer.source_reference,
        checked_at:
          offer.checked_at
      },

      product: {
        id: product.id,
        name: product.name
      },

      store: {
        id: store.id,
        name: store.name,
        is_verified:
          store.is_verified,
        verification_status:
          store.verification_status,
        trust_score:
          store.trust_score,
        authenticity_risk:
          store.authenticity_risk
      },

      imported_offer: {
        ...priceRecord,
        price:
          Number(priceRecord.price)
      },

      price_history: {
        append_only: true,
        previous_prices_preserved:
          true
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  importOffer
};