const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin === true) {
    next(); // Access granted, proceed to the route
  } else {
    return res.status(403).json({ 
      success: false, 
      message: "Access denied. Administrative permissions required." 
    });
  }
};

module.exports = isAdmin;