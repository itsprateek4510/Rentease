const router = require('express').Router();
const { h, limit } = require('../middleware/auth');
const { postalLocation, reverseLocation } = require('../utils/location');
router.get('/pincode/:pincode', limit(60, 60e3), h(async (req, res) => res.json(await postalLocation(req.params.pincode, true))));
router.get('/reverse', limit(30, 60e3), h(async (req, res) => res.json(await reverseLocation(Number(req.query.lat), Number(req.query.lng)))));
module.exports = router;
