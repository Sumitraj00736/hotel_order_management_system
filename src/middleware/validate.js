const { validationResult } = require('express-validator');

const buildValidationErrorPayload = (errors) => ({
  errors: Array.isArray(errors) ? errors : []
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(buildValidationErrorPayload(errors.array()));
  }
  return next();
};

module.exports = validate;
module.exports.buildValidationErrorPayload = buildValidationErrorPayload;
