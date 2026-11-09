/*
  TARQ - Noon Data Source Adapter
  Stage 8.5

  Purpose:
  - Keep Noon integration isolated from TARQ core
  - Never create synthetic product/price data
  - Normalize authorized external data into TARQ format
  - Prepare for official API credentials when available
*/

const SOURCE_NAME = "noon";

function normalizeNoonOffer(rawOffer = {}) {
  if (!rawOffer || typeof rawOffer !== "object") {
    throw new Error("Invalid Noon offer data");
  }

  const priceValue =
    rawOffer.price ??
    rawOffer.sale_price ??
    rawOffer.current_price ??
    null;

  const price =
    priceValue === null
      ? null
      : Number(priceValue);

  if (
    price !== null &&
    (!Number.isFinite(price) || price < 0)
  ) {
    throw new Error("Invalid Noon price");
  }

  const stockValue =
    rawOffer.in_stock ??
    rawOffer.available ??
    rawOffer.stock_available ??
    null;

  const normalized = {
    source: SOURCE_NAME,

    external_product_id:
      rawOffer.product_id ??
      rawOffer.sku ??
      rawOffer.id ??
      null,

    title:
      rawOffer.title ??
      rawOffer.name ??
      null,

    brand:
      rawOffer.brand ??
      null,

    price,

    currency:
      rawOffer.currency ??
      "SAR",

    in_stock:
      stockValue === null
        ? null
        : Boolean(stockValue),

    seller_name:
      rawOffer.seller_name ??
      rawOffer.seller ??
      null,

    product_url:
      rawOffer.product_url ??
      rawOffer.url ??
      null,

    checked_at:
      new Date().toISOString(),

    source_reference:
      rawOffer.source_reference ??
      rawOffer.product_id ??
      rawOffer.sku ??
      null
  };

  return normalized;
}

function validateTarqOffer(offer) {
  const errors = [];

  if (!offer.external_product_id) {
    errors.push("external_product_id missing");
  }

  if (!offer.title) {
    errors.push("title missing");
  }

  if (
    offer.price === null ||
    !Number.isFinite(offer.price)
  ) {
    errors.push("valid price missing");
  }

  if (!offer.currency) {
    errors.push("currency missing");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

async function fetchNoonOffer() {
  throw new Error(
    "Noon live API is not enabled yet. Official partner/API access and credentials must be verified before live requests are made."
  );
}

module.exports = {
  SOURCE_NAME,
  normalizeNoonOffer,
  validateTarqOffer,
  fetchNoonOffer
};