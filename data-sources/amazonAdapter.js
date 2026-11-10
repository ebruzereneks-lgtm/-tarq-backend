/*
  TARQ - Amazon Creators API Adapter
  Stage 9.6

  Purpose:
  - Keep Amazon integration isolated from TARQ core
  - Never create synthetic product or price data
  - Normalize authorized Amazon catalog data into TARQ format
  - Keep live requests disabled until official credentials are available
*/

const SOURCE_NAME = "amazon";

function normalizeAmazonOffer(rawItem = {}) {
  if (!rawItem || typeof rawItem !== "object") {
    throw new Error("Invalid Amazon item data");
  }

  const priceValue =
    rawItem.price ??
    rawItem.current_price ??
    rawItem.offer_price ??
    null;

  const price =
    priceValue === null
      ? null
      : Number(priceValue);

  if (
    price !== null &&
    (!Number.isFinite(price) || price < 0)
  ) {
    throw new Error("Invalid Amazon price");
  }

  const stockValue =
    rawItem.in_stock ??
    rawItem.available ??
    null;

  return {
    source: SOURCE_NAME,

    external_product_id:
      rawItem.asin ??
      rawItem.product_id ??
      rawItem.id ??
      null,

    title:
      rawItem.title ??
      rawItem.name ??
      null,

    brand:
      rawItem.brand ??
      null,

    price,

    currency:
      rawItem.currency ??
      "SAR",

    in_stock:
      stockValue === null
        ? null
        : Boolean(stockValue),

    seller_name:
      rawItem.seller_name ??
      rawItem.seller ??
      null,

    product_url:
      rawItem.product_url ??
      rawItem.url ??
      null,

    checked_at:
      new Date().toISOString(),

    source_reference:
      rawItem.asin ??
      rawItem.source_reference ??
      rawItem.product_id ??
      null
  };
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

async function fetchAmazonOffer() {
  throw new Error(
    "Amazon Creators API live access is not enabled yet. Official Associates/API eligibility and credentials must be verified before live requests are made."
  );
}

module.exports = {
  SOURCE_NAME,
  normalizeAmazonOffer,
  validateTarqOffer,
  fetchAmazonOffer
};
