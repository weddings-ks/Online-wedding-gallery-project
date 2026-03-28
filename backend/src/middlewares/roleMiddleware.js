function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Nuk je i autorizuar."
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Nuk ke leje për këtë veprim."
      });
    }

    next();
  };
}

module.exports = roleMiddleware;