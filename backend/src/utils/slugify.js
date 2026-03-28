function slugify(text) {
  return (text || "")
    .toString()
    .normalize("NFD") // heq shkronjat speciale (ë, ç, etj)
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // lejon vetëm a-z, 0-9, space dhe -
    .replace(/\s+/g, "-") // space -> -
    .replace(/-+/g, "-") // shumë - -> një -
    .replace(/^-+|-+$/g, ""); // heq - në fillim/fund
}

module.exports = slugify;