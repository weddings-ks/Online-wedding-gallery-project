const slugify = require("./slugify");

function generateGuestSectionSlug(title) {
  const base = slugify(title || "guest-section");
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}-${random}`;
}

module.exports = generateGuestSectionSlug;