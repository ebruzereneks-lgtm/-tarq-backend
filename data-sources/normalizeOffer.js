/*
  TARQ - Common Offer Normalizer
  Stage 8.5

  Amaç:
  Amazon, Noon, Jarir, eXtra ve ileride eklenecek
  diğer yetkili veri kaynaklarını tek TARQ formatına çevirmek.

  Bu dosya internetten veri çekmez.
  Sadece yetkili kaynaklardan gelen veriyi normalize eder.
*/

const ALLOWED_CURRENCIES = [
  "SAR",
  "USD",
  "EUR",
  "TRY",
  "AED"
];

function cleanText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function cleanPrice(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const price = Number(value);

  if (
    !Number.isFinite(price) ||
    price < 0
  ) {
    return null;
  }

  return Number(price.toFixed(2));
}

function cleanCurrency(value) {
  if (typeof value !== "string") {
    return "SAR";
  }

  const currency =
    value.trim().toUpperCase();

  return ALLOWED_CURRENCIES.includes(
    currency
  )
    ? currency
    : "SAR";
}

function cleanStock(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    const normalized =
      value.trim().toLowerCase();

    if (
      [
        "in_stock",
        "in stock",
        "available",
        "true",
        "yes"
      ].includes(normalized)
    ) {
      return true;
    }

    if (
      [
        "out_of_stock",
        "out of stock",
        "unavailable",
        "false",
        "no"
      ].includes(normalized)
    ) {
      return false;
    }
  }

  return null;
}

function normalizeOffer(input = {}) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new Error(
      "Offer data must be an object"
    );
  }

  const source =
    cleanText(input.source);

  const externalProductId =
    cleanText(
      input.external_product_id ??
      input.product_id ??
      input.sku ??
      input.asin ??
      input.id
    );

  const title =
    cleanText(
      input.title ??
      input.name
    );

  const brand =
    cleanText(input.brand);

  const price =
    cleanPrice(
      input.price ??
      input.sale_price ??
      input.current_price
    );

  const currency =
    cleanCurrency(input.currency);

  const inStock =
    cleanStock(
      input.in_stock ??
      input.available ??
      input.availability
    );

  const sellerName =
    cleanText(
      input.seller_name ??
      input.seller
    );

  const productUrl =
    cleanText(
      input.product_url ??
      input.url
    );

  const sourceReference =
    cleanText(
      input.source_reference ??
      externalProductId
    );

  return {
    source,
    external_product_id:
      externalProductId,
    title,
    brand,
    price,
    currency,
    in_stock: inStock,
    seller_name: sellerName,
    product_url: productUrl,
    source_reference:
      sourceReference,
    checked_at:
      new Date().toISOString()
  };
}

function validateNormalizedOffer(
  offer
) {
  const errors = [];

  if (!offer.source) {
    errors.push(
      "source missing"
    );
  }

  if (!offer.external_product_id) {
    errors.push(
      "external_product_id missing"
    );
  }

  if (!offer.title) {
    errors.push(
      "title missing"
    );
  }

  if (
    offer.price === null ||
    !Number.isFinite(offer.price)
  ) {
    errors.push(
      "valid price missing"
    );
  }

  if (!offer.currency) {
    errors.push(
      "currency missing"
    );
  }

  return {
    valid:
      errors.length === 0,
    errors
  };
}

function prepareOffer(
  input
) {
  const offer =
    normalizeOffer(input);

  const validation =
    validateNormalizedOffer(
      offer
    );

  return {
    offer,
    validation
  };
}

module.exports = {
  normalizeOffer,
  validateNormalizedOffer,
  prepareOffer
};