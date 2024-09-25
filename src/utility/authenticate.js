module.exports = (req, res, next) => {
    if (req.session && req.session.is_admin === true) {
      next();
    } else {
      res.cookie('redirect_url', req.originalUrl);
      res.status(401).redirect('/admin/login');
    }
}