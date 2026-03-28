const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  try {
    let token = null;

    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Nuk ka token. Qasja u refuzua."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      tenantId: decoded.tenantId ?? null,
      role: decoded.role
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token i pavlefshëm ose i skaduar.",
      error: error.message
    });
  }
}

module.exports = authMiddleware;