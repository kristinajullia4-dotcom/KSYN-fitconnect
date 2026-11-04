const express = require('express');
const router = express.Router();
const freePassController = require('../controllers/freePassController');

// Public route to list active branches for the free pass dropdown
router.get('/branches', freePassController.getPublicBranches);

// Public route to submit 1-day free pass raffle entry
router.post('/apply', freePassController.applyFreePass);

module.exports = router;
