const express = require('express');
const router = express.Router();
const classBookingController = require('../controllers/classBookingController');
const coachController = require('../controllers/coachController');
const authGuard = require('../middleware/authGuard');

router.use(authGuard);

// 1. Get Scheduled Classes (All authenticated roles)
router.get('/', classBookingController.getAllClasses);

// 1.1 Schedule New Studio Class (Coach / Staff)
router.post('/', coachController.scheduleClass);

// 1.2 Remove / Cancel Scheduled Class
router.delete('/:classId', coachController.deleteClass);

// 2. Athlete Bookings & Standings
router.get('/my-bookings', classBookingController.getMyBookings);

// 3. Get Class Roster
router.get('/:classId/roster', classBookingController.getClassRoster);

// 4. Book Class or Join Waitlist
router.post('/:classId/book', classBookingController.bookClass);

// 5. Cancel Booking with Auto-Waitlist Promotion
router.post('/:classId/cancel', classBookingController.cancelBooking);

// 6. Front-Desk Staff Walk-In Registration
router.post('/:classId/walk-in', classBookingController.registerWalkIn);

module.exports = router;
