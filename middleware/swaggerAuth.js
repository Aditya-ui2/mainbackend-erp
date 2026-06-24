const verifySwaggerSession = (req, res, next) => {

    if (req.session.swaggerLoggedIn) {
        return next();
    }

    return res.redirect('/swagger-login');
};

module.exports = verifySwaggerSession;