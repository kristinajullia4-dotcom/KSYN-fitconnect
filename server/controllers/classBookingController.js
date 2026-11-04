const { memoryStore, query, isPostgres } = require('../config/db');
const { logAuditEvent } = require('../middleware/auditLogger');
const { sendWaitlistPromotionAlert } = require('../utils/smsGateway');

function initClassStore() {
  const existing = Array.isArray(memoryStore.classes) ? memoryStore.classes : [];
  if (!memoryStore.classes || memoryStore.classes.length < 8 || !memoryStore.classes.some(c => c.id === 'cls-yoga-02')) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
    const dayAfterStr = new Date(now.getTime() + 172800000).toISOString().split('T')[0];

    const seedClasses = [
      // ---------------------------------------------------------------------
      // TODAY'S CLASSES
      // ---------------------------------------------------------------------
      {
        id: 'cls-yoga-01',
        time: '07:00 AM – 08:00 AM',
        date: todayStr,
        category: 'Yoga & Recovery',
        type: 'Yoga & Recovery',
        name: 'Sunrise Vinyasa Flow & Mobility',
        instructor: 'Coach Sofia Cruz',
        coach_name: 'Coach Sofia Cruz',
        coach_id: 'u1000000-0000-0000-0000-000000000005',
        room: 'Studio A (Recovery Lounge)',
        branch_id: 'b-mkt-01',
        capacity: 20,
        enrolled: [
          { id: 'u1000000-0000-0000-0000-000000000010', user_id: 'u1000000-0000-0000-0000-000000000010', name: 'Elena Rostova', email: 'owner.makati@ksyn.com', tier: '1-Month Pass', status: 'Checked In', booking_type: 'Reserved Class Booking', verified_via: 'Front Desk Turnstile QR', checked_in_at: new Date('2026-10-20T06:58:00Z'), checkInTime: '06:58 AM', booked_at: new Date('2026-10-14T06:05:00Z') },
          { id: 'u-ath-002', user_id: 'u-ath-002', name: 'Camille Villar', email: 'camille@ksyn.com', tier: '1-Year Pass', status: 'Checked In', booking_type: 'Reserved Class Booking', verified_via: 'Front Desk Turnstile QR', checked_in_at: new Date('2026-10-20T07:02:00Z'), checkInTime: '07:02 AM', booked_at: new Date('2026-10-14T06:15:00Z') },
          { id: 'u-ath-001', user_id: 'u-ath-001', name: 'Liam Archer', email: 'liam@ksyn.com', tier: 'Black Elite', status: 'Checked In', booking_type: 'Reserved Class Booking', verified_via: 'Turnstile RFID Scanner Gate 1', checked_in_at: new Date('2026-10-20T07:04:00Z'), checkInTime: '07:04 AM', booked_at: new Date('2026-10-14T06:20:00Z') },
          { id: 'u-ath-003', user_id: 'u-ath-003', name: 'Gabriel Lopez', email: 'gabriel@ksyn.com', tier: '1-Month Pass', status: 'Checked In', booking_type: 'Reserved Class Booking', verified_via: 'Front Desk Turnstile QR', checked_in_at: new Date('2026-10-20T07:05:00Z'), checkInTime: '07:05 AM', booked_at: new Date('2026-10-14T06:25:00Z') },
          { id: 'ath-06', user_id: 'ath-06', name: 'Patricia Gomez', email: 'patricia@ksyn.com', tier: '1-Month Pass', status: 'Checked In', booking_type: 'Reserved Class Booking', verified_via: 'Front Desk Turnstile QR', checked_in_at: new Date('2026-10-20T07:07:00Z'), checkInTime: '07:07 AM', booked_at: new Date('2026-10-14T06:30:00Z') },
          { id: 'ath-08', user_id: 'ath-08', name: 'Beatrice Tan', email: 'beatrice@ksyn.com', tier: '3-Months Pass', status: 'Checked In', booking_type: 'Reserved Class Booking', verified_via: 'Turnstile RFID Scanner Gate 1', checked_in_at: new Date('2026-10-20T07:08:00Z'), checkInTime: '07:08 AM', booked_at: new Date('2026-10-14T06:35:00Z') },
          { id: 'ath-09', user_id: 'ath-09', name: 'Marco Rossi', email: 'marco@ksyn.com', tier: 'Black Elite', status: 'Checked In', booking_type: 'Reserved Class Booking', verified_via: 'Turnstile RFID Scanner Gate 1', checked_in_at: new Date('2026-10-20T07:10:00Z'), checkInTime: '07:10 AM', booked_at: new Date('2026-10-14T06:40:00Z') },
          { id: 'ath-10', user_id: 'ath-10', name: 'Chloe Davenport', email: 'chloe@ksyn.com', tier: '1-Month Pass', status: 'Checked In', booking_type: 'Reserved Class Booking', verified_via: 'Front Desk Turnstile QR', checked_in_at: new Date('2026-10-20T07:11:00Z'), checkInTime: '07:11 AM', booked_at: new Date('2026-10-14T06:45:00Z') },
          { id: 'ath-12', user_id: 'ath-12', name: 'Valerie Ramos', email: 'valerie.ramos@ksyn.com', tier: '1-Month Pass', status: 'Checked In', booking_type: 'Reserved Class Booking', verified_via: 'Front Desk Turnstile QR', checked_in_at: new Date('2026-10-20T07:14:00Z'), checkInTime: '07:14 AM', booked_at: new Date('2026-10-14T06:55:00Z') },
          { id: 'ath-13', user_id: 'ath-13', name: 'Kyle Robinson', email: 'kyle@ksyn.com', tier: '1-Month Pass', status: 'Checked In', booking_type: 'Reserved Class Booking', verified_via: 'Turnstile RFID Scanner Gate 1', checked_in_at: new Date('2026-10-20T07:15:00Z'), checkInTime: '07:15 AM', booked_at: new Date('2026-10-14T06:58:00Z') },
          { id: 'ath-14', user_id: 'ath-14', name: 'Hannah Morales', email: 'hannah@ksyn.com', tier: '3-Months Pass', status: 'Confirmed', booking_type: 'Reserved Class Booking', verified_via: null, checked_in_at: null, booked_at: new Date('2026-10-14T07:00:00Z') },
          { id: 'ath-15', user_id: 'ath-15', name: 'Justin Reyes', email: 'justin@ksyn.com', tier: '1-Month Pass', status: 'Confirmed', booking_type: 'Reserved Class Booking', verified_via: null, checked_in_at: null, booked_at: new Date('2026-10-14T07:02:00Z') },
          { id: 'ath-16', user_id: 'ath-16', name: 'Denise Castro', email: 'denise@ksyn.com', tier: '1-Month Pass', status: 'Confirmed', booking_type: 'Reserved Class Booking', verified_via: null, checked_in_at: null, booked_at: new Date('2026-10-14T07:05:00Z') },
          { id: 'u1000000-0000-0000-0000-000000000077', user_id: 'u1000000-0000-0000-0000-000000000077', name: 'Kristina Jullia', email: 'kristinajullia4@gmail.com', tier: '1-Month Pass', status: 'Confirmed', booking_type: 'Reserved Class Booking', verified_via: null, checked_in_at: null, booked_at: new Date('2026-10-14T07:10:00Z') },
          { id: 'ath-18', user_id: 'ath-18', name: 'Mia Santos', email: 'mia@ksyn.com', tier: '1-Month Pass', status: 'Confirmed', booking_type: 'Reserved Class Booking', verified_via: null, checked_in_at: null, booked_at: new Date('2026-10-14T07:12:00Z') }
        ],
        waitlist: []
      },
      {
        id: 'cls-hiit-02',
        time: '10:00 AM – 11:00 AM',
        date: todayStr,
        category: 'HIIT Conditioning',
        type: 'HIIT Conditioning',
        name: 'Metabolic Athletic Conditioning',
        instructor: 'Coach Marcus Reyes',
        coach_name: 'Coach Marcus Reyes',
        coach_id: 'u1000000-0000-0000-0000-000000000005',
        room: 'Studio B (Turf Zone)',
        branch_id: 'b-kat-02',
        capacity: 15,
        enrolled: [
          'Carlos Mendoza', 'Sofia Cruz', 'Rafael Silva', 'Maya Lin', 'Antonio Luna',
          'Fernando Poe', 'Andres Bonifacio', 'Emilio Aguinaldo', 'Jose Rizal', 'Apolinario Mabini',
          'Melchora Aquino', 'Gabriela Silang', 'Teresa Magbanua', 'Gregorio Del Pilar', 'Manuel Quezon'
        ].map((name, i) => ({
          id: `ath-hiit-${i + 1}`,
          user_id: `ath-hiit-${i + 1}`,
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@ksyn.ph`,
          tier: '1-Month Pass',
          status: i < 9 ? 'Checked In' : 'Confirmed',
          booking_type: 'Reserved Class Booking',
          verified_via: i < 9 ? 'Front Desk Turnstile QR' : null,
          checked_in_at: i < 9 ? new Date('2026-10-20T09:50:00Z') : null,
          checkInTime: i < 9 ? '09:50 AM' : null,
          booked_at: new Date('2026-10-14T08:00:00Z')
        })),
        waitlist: []
      },
      {
        id: 'cls-zumba-03',
        time: '05:30 PM – 06:30 PM',
        date: todayStr,
        category: 'Zumba & Dance Cardio',
        type: 'Zumba & Dance Cardio',
        name: 'High-Energy Rhythmic Cardio',
        instructor: 'Coach Valerie Tan',
        coach_name: 'Coach Valerie Tan',
        coach_id: 'u1000000-0000-0000-0000-000000000005',
        room: 'Main Aerobic Stage',
        branch_id: 'b-alb-03',
        capacity: 25,
        enrolled: Array.from({ length: 22 }, (_, i) => ({
          id: `ath-zumba-${i + 1}`,
          user_id: `ath-zumba-${i + 1}`,
          name: `Zumba Dancer ${i + 1}`,
          email: `zumba.${i + 1}@ksyn.ph`,
          tier: '1-Month Pass',
          status: i < 14 ? 'Checked In' : 'Confirmed',
          booking_type: 'Reserved Class Booking',
          verified_via: i < 14 ? 'Turnstile RFID Scanner Gate 1' : null,
          checked_in_at: i < 14 ? new Date('2026-10-20T17:15:00Z') : null,
          checkInTime: i < 14 ? '05:15 PM' : null,
          booked_at: new Date('2026-10-14T10:00:00Z')
        })),
        waitlist: []
      },
      {
        id: 'cls-box-04',
        time: '07:00 PM – 08:00 PM',
        date: todayStr,
        category: 'Boxing & Strike',
        type: 'Boxing & Strike',
        name: 'Combat Heavy-Bag Power Circuit',
        instructor: 'Coach Diego Alcantara',
        coach_name: 'Coach Diego Alcantara',
        coach_id: 'u1000000-0000-0000-0000-000000000005',
        room: 'Combat Boxing Ring',
        branch_id: 'b-mkt-01',
        capacity: 12,
        enrolled: Array.from({ length: 12 }, (_, i) => ({
          id: `ath-box-${i + 1}`,
          user_id: `ath-box-${i + 1}`,
          name: `Boxer Athlete ${i + 1}`,
          email: `boxer.${i + 1}@ksyn.ph`,
          tier: '1-Month Pass',
          status: i < 7 ? 'Checked In' : 'Confirmed',
          booking_type: 'Reserved Class Booking',
          verified_via: i < 7 ? 'Front Desk Turnstile QR' : null,
          checked_in_at: i < 7 ? new Date('2026-10-20T18:45:00Z') : null,
          checkInTime: i < 7 ? '06:45 PM' : null,
          booked_at: new Date('2026-10-14T11:00:00Z')
        })),
        waitlist: []
      },

      // ---------------------------------------------------------------------
      // UPCOMING CLASSES (TOMORROW & SUBSEQUENT DAYS)
      // ---------------------------------------------------------------------
      {
        id: 'cls-yoga-02',
        time: '05:00 PM – 06:00 PM',
        date: tomorrowStr,
        category: 'Yoga & Recovery',
        type: 'Yoga & Recovery',
        name: 'Sunset Sound Bath & Mobility Flow',
        instructor: 'Coach Sofia Cruz',
        coach_name: 'Coach Sofia Cruz',
        coach_id: 'u1000000-0000-0000-0000-000000000005',
        room: 'Studio A (Recovery Lounge)',
        branch_id: 'b-mkt-01',
        capacity: 20,
        enrolled: [
          'Samantha Nicole Perez', 'Elena Rostova', 'Juan Dela Cruz', 'Camille Villar',
          'Liam Archer', 'Patricia Gomez', 'Gabriel Lopez', 'Beatrice Tan',
          'Marco Rossi', 'Chloe Davenport', 'Derrick Sterling', 'Valerie Ramos',
          'Kyle Robinson', 'Hannah Morales', 'Denise Castro', 'Mia Santos'
        ].map((name, i) => ({
          id: `ath-yoga2-${i + 1}`,
          user_id: `ath-yoga2-${i + 1}`,
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@ksyn.com`,
          tier: i % 3 === 0 ? 'Black Elite' : '1-Month Pass',
          status: 'Confirmed',
          booking_type: 'Reserved Class Booking',
          verified_via: null,
          checked_in_at: null,
          checkInTime: null,
          booked_at: new Date('2026-10-15T09:00:00Z')
        })),
        waitlist: []
      },
      {
        id: 'cls-yoga-03',
        time: '07:00 AM – 08:00 AM',
        date: dayAfterStr,
        category: 'Yoga & Recovery',
        type: 'Yoga & Recovery',
        name: 'Power Ashtanga & Core Inversion',
        instructor: 'Coach Sofia Cruz',
        coach_name: 'Coach Sofia Cruz',
        coach_id: 'u1000000-0000-0000-0000-000000000005',
        room: 'Studio A (Recovery Lounge)',
        branch_id: 'b-mkt-01',
        capacity: 18,
        enrolled: [
          'Samantha Nicole Perez', 'Juan Dela Cruz', 'Camille Villar', 'Liam Archer',
          'Gabriel Lopez', 'Beatrice Tan', 'Marco Rossi', 'Chloe Davenport',
          'Derrick Sterling', 'Kyle Robinson', 'Justin Reyes', 'Denise Castro'
        ].map((name, i) => ({
          id: `ath-yoga3-${i + 1}`,
          user_id: `ath-yoga3-${i + 1}`,
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@ksyn.com`,
          tier: i % 2 === 0 ? 'Black Elite' : '3-Months Pass',
          status: 'Confirmed',
          booking_type: 'Reserved Class Booking',
          verified_via: null,
          checked_in_at: null,
          checkInTime: null,
          booked_at: new Date('2026-10-15T11:00:00Z')
        })),
        waitlist: []
      },
      {
        id: 'cls-hiit-03',
        time: '10:00 AM – 11:00 AM',
        date: tomorrowStr,
        category: 'HIIT Conditioning',
        type: 'HIIT Conditioning',
        name: 'Turf Agility & Power Sprints',
        instructor: 'Coach Marcus Reyes',
        coach_name: 'Coach Marcus Reyes',
        coach_id: 'u1000000-0000-0000-0000-000000000005',
        room: 'Studio B (Turf Zone)',
        branch_id: 'b-mkt-01',
        capacity: 16,
        enrolled: [
          'Carlos Mendoza', 'Rafael Silva', 'Maya Lin', 'Antonio Luna',
          'Fernando Poe', 'Andres Bonifacio', 'Emilio Aguinaldo', 'Jose Rizal',
          'Apolinario Mabini', 'Melchora Aquino', 'Gabriela Silang', 'Teresa Magbanua',
          'Gregorio Del Pilar', 'Manuel Quezon'
        ].map((name, i) => ({
          id: `ath-hiit3-${i + 1}`,
          user_id: `ath-hiit3-${i + 1}`,
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@ksyn.ph`,
          tier: '1-Month Pass',
          status: 'Confirmed',
          booking_type: 'Reserved Class Booking',
          verified_via: null,
          checked_in_at: null,
          checkInTime: null,
          booked_at: new Date('2026-10-15T14:00:00Z')
        })),
        waitlist: []
      },
      {
        id: 'cls-zumba-04',
        time: '05:30 PM – 06:30 PM',
        date: tomorrowStr,
        category: 'Zumba & Dance Cardio',
        type: 'Zumba & Dance Cardio',
        name: 'Afrobeats Cardio Sculpt',
        instructor: 'Coach Valerie Tan',
        coach_name: 'Coach Valerie Tan',
        coach_id: 'u1000000-0000-0000-0000-000000000005',
        room: 'Main Aerobic Stage',
        branch_id: 'b-alb-03',
        capacity: 25,
        enrolled: Array.from({ length: 20 }, (_, i) => ({
          id: `ath-zumba4-${i + 1}`,
          user_id: `ath-zumba4-${i + 1}`,
          name: `Cardio Athlete ${i + 1}`,
          email: `cardio.${i + 1}@ksyn.ph`,
          tier: '1-Month Pass',
          status: 'Confirmed',
          booking_type: 'Reserved Class Booking',
          verified_via: null,
          checked_in_at: null,
          checkInTime: null,
          booked_at: new Date('2026-10-15T15:00:00Z')
        })),
        waitlist: []
      },
      {
        id: 'cls-box-05',
        time: '07:00 PM – 08:00 PM',
        date: tomorrowStr,
        category: 'Boxing & Strike',
        type: 'Boxing & Strike',
        name: 'Muay Thai Clinch & Strike',
        instructor: 'Coach Diego Alcantara',
        coach_name: 'Coach Diego Alcantara',
        coach_id: 'u1000000-0000-0000-0000-000000000005',
        room: 'Combat Boxing Ring',
        branch_id: 'b-mkt-01',
        capacity: 12,
        enrolled: Array.from({ length: 10 }, (_, i) => ({
          id: `ath-box5-${i + 1}`,
          user_id: `ath-box5-${i + 1}`,
          name: `Striker ${i + 1}`,
          email: `striker.${i + 1}@ksyn.ph`,
          tier: 'Black Elite',
          status: 'Confirmed',
          booking_type: 'Reserved Class Booking',
          verified_via: null,
          checked_in_at: null,
          checkInTime: null,
          booked_at: new Date('2026-10-15T16:00:00Z')
        })),
        waitlist: []
      }
    ];

    // Preserve any valid user-created/scheduled classes (excluding legacy unclassified Studio Class)
    const customClasses = existing.filter(c => !seedClasses.some(s => s.id === c.id) && c.id !== 'cls-mvrxzyvu-6tqc' && c.category !== 'Studio Class' && c.type !== 'Studio Class');
    memoryStore.classes = [...customClasses, ...seedClasses];

    // Ensure enrolled and roster references are identical for roll call synchronization
    memoryStore.classes.forEach(c => {
      c.roster = c.enrolled;
      c.enrolled_count = c.enrolled.length;
    });

    memoryStore.branch_classes = memoryStore.classes;
  }
}

initClassStore();

// Helper to find class by ID supporting both new, legacy, and front-end identifiers
function findClassById(classId) {
  if (!memoryStore.classes) initClassStore();
  if (!classId) return null;
  const clean = String(classId).trim();
  return memoryStore.classes.find(c => {
    if (c.id === clean) return true;
    if (clean === 'cls-1' && (c.id === 'cls-yoga-01' || c.id === 'cls-001')) return true;
    if (clean === 'cls-2' && (c.id === 'cls-hiit-02' || c.id === 'cls-002')) return true;
    if (clean === 'cls-3' && (c.id === 'cls-zumba-03' || c.id === 'cls-003')) return true;
    if (clean === 'cls-4' && (c.id === 'cls-box-04' || c.id === 'cls-004')) return true;
    if (clean === 'cls-001' && (c.id === 'cls-yoga-01' || c.id === 'cls-1')) return true;
    if (clean === 'cls-002' && (c.id === 'cls-hiit-02' || c.id === 'cls-2')) return true;
    if (clean === 'cls-003' && (c.id === 'cls-zumba-03' || c.id === 'cls-3')) return true;
    if (clean === 'cls-004' && (c.id === 'cls-box-04' || c.id === 'cls-4')) return true;
    if (clean === 'cls-yoga-01' && (c.id === 'cls-001' || c.id === 'cls-1')) return true;
    if (clean === 'cls-hiit-02' && (c.id === 'cls-002' || c.id === 'cls-2')) return true;
    if (clean === 'cls-zumba-03' && (c.id === 'cls-003' || c.id === 'cls-3')) return true;
    if (clean === 'cls-box-04' && (c.id === 'cls-004' || c.id === 'cls-4')) return true;
    if (c.name && clean.toLowerCase() === c.name.toLowerCase()) return true;
    return false;
  });
}

// Helper to determine if a class date/time has already passed
function isClassConcluded(cls) {
  if (!cls) return false;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const classDate = cls.date ? String(cls.date).split('T')[0] : todayStr;

  if (classDate < todayStr) return true;
  if (classDate > todayStr) return false;

  // If date is today, check end time
  const timeStr = cls.time || '';
  const parts = timeStr.split(/[\u2013\u2014-]/).map(s => s.trim());
  const endTimeStr = parts.length >= 2 ? parts[1] : parts[0];
  if (!endTimeStr) return false;

  const match = endTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return false;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  const endDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  return now >= endDateTime;
}

// 1. Get Scheduled Classes with Live Enrolled Roster & Waitlist Status
async function getAllClasses(req, res) {
  try {
    initClassStore();
    const user = req.user || {};
    const classes = memoryStore.classes.map(c => {
      const isEnrolled = (c.enrolled || []).some(e => e.user_id === user.id || e.id === user.id);
      const waitlistEntry = (c.waitlist || []).find(w => w.user_id === user.id);
      const availableSlots = Math.max(0, c.capacity - (c.enrolled?.length || 0));

      const { resolvePlan } = require('../config/membershipRates');
      const rosterList = (c.enrolled || []).map(a => {
        const u = (memoryStore.users || []).find(usr => usr.id === (a.user_id || a.id) || (usr.email && a.email && usr.email.toLowerCase() === a.email.toLowerCase()));
        const sub = u ? (memoryStore.subscriptions || []).find(s => s.user_id === u.id) : null;
        const userPlan = sub?.plan || u?.membership_plan;
        const resolvedPlan = userPlan ? resolvePlan(userPlan) : null;
        const displayTier = resolvedPlan ? resolvedPlan.name : (a.tier || '1-Month Pass');

        return {
          id: a.user_id || a.id,
          user_id: a.user_id || a.id,
          name: a.name,
          email: a.email,
          phone: a.phone,
          tier: displayTier,
          status: a.status || 'Confirmed',
          booking_type: a.booking_type || 'Reserved Class Booking',
          verified_via: a.verified_via || null,
          checked_in_at: a.checked_in_at || null,
          checkInTime: a.checked_in_at ? new Date(a.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (a.checkInTime || null),
          booked_at: a.booked_at
        };
      });

      const branchObj = (memoryStore.branches || []).find(b => b.id === c.branch_id || b.code === c.branch_id);
      const branchName = branchObj ? branchObj.name : 'KSYN Fitness Makati';
      const branchCode = branchObj ? branchObj.code : 'MKT-01';

      const rawCat = c.category || c.type || '';
      let resolvedCategory = rawCat;
      if (!rawCat || rawCat === 'Studio Class') {
        const lower = (c.name || '').toLowerCase();
        if (lower.includes('yoga') || lower.includes('vinyasa') || lower.includes('mobility')) resolvedCategory = 'Yoga & Recovery';
        else if (lower.includes('zumba') || lower.includes('dance')) resolvedCategory = 'Zumba & Dance';
        else if (lower.includes('boxing') || lower.includes('strike')) resolvedCategory = 'Boxing & Strike';
        else resolvedCategory = 'HIIT Conditioning';
      }

      return {
        id: c.id,
        name: c.name,
        category: resolvedCategory,
        type: resolvedCategory,
        room: c.room,
        time: c.time,
        date: c.date,
        coach_name: c.coach_name || c.instructor,
        instructor: c.instructor || c.coach_name,
        branch_id: c.branch_id || (branchObj ? branchObj.id : 'b-mkt-01'),
        branch: branchName,
        branch_name: branchName,
        branch_code: branchCode,
        capacity: c.capacity,
        enrolled_count: rosterList.length,
        enrolled: rosterList,
        roster: rosterList,
        available_slots: availableSlots,
        is_full: availableSlots === 0,
        is_concluded: isClassConcluded(c),
        waitlist_count: c.waitlist?.length || 0,
        waitlist: c.waitlist || [],
        my_booking: isEnrolled
          ? { status: 'Confirmed', booked_at: c.enrolled.find(e => (e.user_id === user.id || e.id === user.id))?.booked_at }
          : (waitlistEntry ? { status: 'Waitlisted', position: waitlistEntry.position } : null)
      };
    });

    res.json({ success: true, count: classes.length, classes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, classes: [] });
  }
}

// 2. Get Live Class Roster
async function getClassRoster(req, res) {
  try {
    initClassStore();
    const { classId } = req.params;
    const classItem = findClassById(classId);
    if (!classItem) {
      return res.status(404).json({ success: false, message: 'Class session not found.' });
    }

    const roster = (classItem.enrolled || []).map(a => ({
      id: a.user_id || a.id,
      user_id: a.user_id || a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      tier: a.tier || '1-Month Pass',
      status: a.status || 'Confirmed',
      booking_type: a.booking_type || 'Reserved Class Booking',
      verified_via: a.verified_via || null,
      checked_in_at: a.checked_in_at || null,
      checkInTime: a.checked_in_at ? new Date(a.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (a.checkInTime || null),
      booked_at: a.booked_at
    }));

    res.json({
      success: true,
      class_id: classItem.id,
      name: classItem.name,
      capacity: classItem.capacity,
      enrolled_count: roster.length,
      enrolled: roster,
      roster
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 3. Front-Desk Staff Walk-In Registration with Strict Time & Capacity Controls
async function registerWalkIn(req, res) {
  try {
    initClassStore();
    const { classId } = req.params;
    const { name, member_name, tier, membership_tier, member_id } = req.body;
    const staffUser = req.user;

    const classItem = findClassById(classId);
    if (!classItem) {
      return res.status(404).json({ success: false, message: 'Class session not found.' });
    }

    // 1. Time Constraint Check: Current time must be <= classEndTime
    const timeStr = classItem.time;
    if (timeStr) {
      const parts = timeStr.split(/[\u2013\u2014-]/).map(s => s.trim());
      if (parts.length === 2) {
        const match = parts[1].match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (match) {
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const modifier = match[3].toUpperCase();
          if (modifier === 'PM' && hours < 12) hours += 12;
          if (modifier === 'AM' && hours === 12) hours = 0;
          const endD = new Date();
          endD.setHours(hours, minutes, 0, 0);

          if (new Date() > endD) {
            return res.status(400).json({
              success: false,
              error: 'CLASS_CONCLUDED',
              message: 'Class session has already ended.'
            });
          }
        }
      }
    }

    // 2. Capacity Constraint Check: enrolled.length < capacity
    if (!classItem.enrolled) classItem.enrolled = [];
    if (classItem.enrolled.length >= classItem.capacity) {
      return res.status(400).json({
        success: false,
        error: 'CAPACITY_REACHED',
        message: 'Studio room capacity limit reached.'
      });
    }

    // 3. Register Walk-In Record
    const athleteName = (name || member_name || 'Walk-In Athlete').trim();
    const athleteTier = tier || membership_tier || 'Walk-in Day Pass';
    const athleteId = member_id || `ath-walkin-${Date.now()}`;

    const walkInRecord = {
      id: athleteId,
      user_id: athleteId,
      name: athleteName,
      tier: athleteTier,
      booking_type: 'Front-Desk Walk-In',
      status: 'Walk-In Registered',
      verified_via: 'Front-Desk Reception',
      checked_in_at: new Date().toISOString(),
      checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      booked_at: new Date()
    };

    classItem.enrolled.push(walkInRecord);
    classItem.roster = classItem.enrolled;
    classItem.enrolled_count = classItem.enrolled.length;

    // 4. Log Audit Event
    await logAuditEvent({
      branch_id: classItem.branch_id || staffUser?.branch_id,
      user_id: staffUser?.id || 'staff',
      user_role: staffUser?.role || 'front_desk',
      action: 'CLASS_WALKIN_REGISTERED',
      resource: `CLASS:${classItem.id}`,
      ip_address: req.ip || '127.0.0.1',
      details: {
        class_name: classItem.name,
        athlete_name: athleteName,
        total_enrolled: classItem.enrolled.length,
        capacity: classItem.capacity
      }
    });

    return res.status(201).json({
      success: true,
      message: `Walk-in registered for ${athleteName} in ${classItem.name}.`,
      athlete: walkInRecord,
      enrolled_count: classItem.enrolled.length,
      capacity: classItem.capacity
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Book a Class (Instant Confirmation or Auto-Waitlist Queue)
async function bookClass(req, res) {
  try {
    initClassStore();
    const user = req.user;
    const { classId } = req.params;

    const classItem = findClassById(classId);
    if (!classItem) {
      return res.status(404).json({ success: false, message: 'Class session not found.' });
    }

    // Time Constraint Check: Prevent booking concluded / past classes
    if (isClassConcluded(classItem)) {
      return res.status(400).json({
        success: false,
        error: 'CLASS_CONCLUDED',
        message: 'This class session has already ended and cannot be booked.'
      });
    }

    if (!classItem.enrolled) classItem.enrolled = [];
    if (!classItem.waitlist) classItem.waitlist = [];

    // Check if already confirmed
    if (classItem.enrolled.some(e => e.user_id === user.id || e.id === user.id)) {
      return res.status(409).json({
        success: false,
        error: 'ALREADY_BOOKED',
        message: 'You are already confirmed for this class session.'
      });
    }

    // Check if already waitlisted
    const existingWaitlist = classItem.waitlist.find(w => w.user_id === user.id);
    if (existingWaitlist) {
      return res.status(409).json({
        success: false,
        error: 'ALREADY_WAITLISTED',
        message: `You are already on the standby waitlist at position #${existingWaitlist.position}.`
      });
    }

    // Check capacity
    if (classItem.enrolled.length < classItem.capacity) {
      // Confirmed Booking
      const bookingEntry = {
        id: user.id,
        user_id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        tier: user.membership_plan || '1-Month Pass',
        booking_type: 'Mobile App Booking',
        status: 'Confirmed',
        verified_via: null,
        checked_in_at: null,
        booked_at: new Date()
      };
      classItem.enrolled.push(bookingEntry);
      classItem.roster = classItem.enrolled;
      classItem.enrolled_count = classItem.enrolled.length;

      try {
        const { savePersistentStoreSync, savePersistentStore } = require('../config/db');
        if (typeof savePersistentStoreSync === 'function') {
          savePersistentStoreSync();
        } else if (typeof savePersistentStore === 'function') {
          savePersistentStore();
        }
      } catch (err) {}

      await logAuditEvent({
        branch_id: classItem.branch_id,
        user_id: user.id,
        user_role: user.role,
        action: 'CLASS_BOOKING_CONFIRMED',
        resource: `CLASS:${classItem.id}`,
        ip_address: req.ip || '127.0.0.1',
        details: { class_name: classItem.name, remaining_slots: classItem.capacity - classItem.enrolled.length }
      });

      return res.status(201).json({
        success: true,
        booking_status: 'CONFIRMED',
        message: `Booking confirmed for ${classItem.name}! See you in ${classItem.room}.`,
        class_id: classItem.id,
        enrolled_count: classItem.enrolled.length,
        capacity: classItem.capacity
      });
    } else {
      // Capacity Exceeded: Auto-Join Standby Waitlist
      const position = classItem.waitlist.length + 1;
      const waitlistEntry = {
        user_id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        position,
        queued_at: new Date()
      };
      classItem.waitlist.push(waitlistEntry);

      await logAuditEvent({
        branch_id: classItem.branch_id,
        user_id: user.id,
        user_role: user.role,
        action: 'CLASS_WAITLIST_JOINED',
        resource: `CLASS:${classItem.id}`,
        ip_address: req.ip || '127.0.0.1',
        details: { class_name: classItem.name, position }
      });

      return res.status(200).json({
        success: true,
        booking_status: 'WAITLISTED',
        message: `Class is currently full (${classItem.capacity}/${classItem.capacity}). You are added to the Standby Waitlist at position #${position}. You will be automatically enrolled if an athlete cancels.`,
        class_id: classItem.id,
        waitlist_position: position,
        total_waitlisted: classItem.waitlist.length
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 5. Cancel Booking & Trigger Auto-Promotion of Next Waitlist Athlete
async function cancelBooking(req, res) {
  try {
    initClassStore();
    const user = req.user;
    const { classId } = req.params;

    const classItem = findClassById(classId);
    if (!classItem) {
      return res.status(404).json({ success: false, message: 'Class session not found.' });
    }

    // Robust user matcher: ID, email, or name
    const matchesUser = (e) => {
      if (!e || !user) return false;
      const eId = String(e.user_id || e.id || '');
      const uId = String(user.id || '');
      if (eId && uId && eId === uId) return true;
      if (e.email && user.email && e.email.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;
      if (e.name && user.name && e.name.toLowerCase().trim() === user.name.toLowerCase().trim()) return true;
      return false;
    };

    const enrolledIndex = (classItem.enrolled || []).findIndex(matchesUser);
    const waitlistIndex = (classItem.waitlist || []).findIndex(matchesUser);

    if (enrolledIndex === -1 && waitlistIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'You do not have an active booking or waitlist entry for this class.'
      });
    }

    let promotedAthlete = null;

    if (enrolledIndex !== -1) {
      const removedAthlete = classItem.enrolled.splice(enrolledIndex, 1)[0];
      classItem.roster = classItem.enrolled;
      classItem.enrolled_count = classItem.enrolled.length;

      // Sync across all references in memoryStore
      if (Array.isArray(memoryStore.classes)) {
        memoryStore.classes.forEach(c => {
          if (c.id === classItem.id || c.name === classItem.name) {
            c.enrolled = classItem.enrolled;
            c.roster = classItem.enrolled;
            c.enrolled_count = classItem.enrolled.length;
          }
        });
      }
      memoryStore.branch_classes = memoryStore.classes;

      try {
        const { savePersistentStoreSync, savePersistentStore } = require('../config/db');
        if (typeof savePersistentStoreSync === 'function') {
          savePersistentStoreSync();
        } else if (typeof savePersistentStore === 'function') {
          savePersistentStore();
        }
      } catch (err) {}

      // Automated Standby Waitlist Promotion
      if (classItem.waitlist && classItem.waitlist.length > 0) {
        const topOfWaitlist = classItem.waitlist.shift();

        promotedAthlete = {
          id: topOfWaitlist.user_id,
          user_id: topOfWaitlist.user_id,
          name: topOfWaitlist.name,
          email: topOfWaitlist.email,
          phone: topOfWaitlist.phone,
          tier: '1-Month Pass',
          status: 'Confirmed',
          booking_type: 'Waitlist Promotion',
          verified_via: null,
          checked_in_at: null,
          promoted_at: new Date(),
          booked_at: new Date()
        };
        classItem.enrolled.push(promotedAthlete);
        classItem.roster = classItem.enrolled;
        classItem.enrolled_count = classItem.enrolled.length;

        classItem.waitlist.forEach((w, idx) => {
          w.position = idx + 1;
        });

        sendWaitlistPromotionAlert(
          promotedAthlete,
          classItem.name,
          classItem.time,
          classItem.room
        ).catch(() => {});

        await logAuditEvent({
          branch_id: classItem.branch_id,
          user_id: topOfWaitlist.user_id,
          user_role: 'member',
          action: 'CLASS_WAITLIST_AUTO_PROMOTED',
          resource: `CLASS:${classItem.id}`,
          ip_address: req.ip || '127.0.0.1',
          details: {
            class_name: classItem.name,
            promoted_athlete: topOfWaitlist.name,
            cancelled_by: user.name
          }
        });
      }

      await logAuditEvent({
        branch_id: classItem.branch_id,
        user_id: user.id,
        user_role: user.role,
        action: 'CLASS_BOOKING_CANCELLED',
        resource: `CLASS:${classItem.id}`,
        ip_address: req.ip || '127.0.0.1',
        details: { class_name: classItem.name, auto_promoted: promotedAthlete ? promotedAthlete.name : 'None' }
      });

      return res.json({
        success: true,
        message: `Your reservation for "${classItem.name}" has been cancelled.`,
        auto_promoted_athlete: promotedAthlete
          ? { name: promotedAthlete.name, email: promotedAthlete.email }
          : null,
        remaining_enrolled: classItem.enrolled.length,
        remaining_waitlist: classItem.waitlist.length
      });
    } else if (waitlistIndex !== -1) {
      classItem.waitlist.splice(waitlistIndex, 1);
      classItem.waitlist.forEach((w, idx) => {
        w.position = idx + 1;
      });

      return res.json({
        success: true,
        message: `You have removed yourself from the standby waitlist for "${classItem.name}".`
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 6. Get My Bookings & Waitlist Standings
async function getMyBookings(req, res) {
  try {
    initClassStore();
    const user = req.user;
    const confirmed = [];
    const waitlisted = [];

    memoryStore.classes.forEach(c => {
      const e = (c.enrolled || []).find(x => x.user_id === user.id || x.id === user.id);
      if (e) {
        confirmed.push({
          class_id: c.id,
          name: c.name,
          category: c.category,
          room: c.room,
          time: c.time,
          date: c.date,
          coach_name: c.coach_name || c.instructor,
          booked_at: e.booked_at,
          status: e.status || 'Confirmed'
        });
      }

      const w = (c.waitlist || []).find(x => x.user_id === user.id);
      if (w) {
        waitlisted.push({
          class_id: c.id,
          name: c.name,
          category: c.category,
          room: c.room,
          time: c.time,
          date: c.date,
          coach_name: c.coach_name || c.instructor,
          position: w.position,
          queued_at: w.queued_at,
          status: 'Waitlisted'
        });
      }
    });

    res.json({
      success: true,
      confirmed_count: confirmed.length,
      waitlisted_count: waitlisted.length,
      confirmed,
      waitlisted
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  initClassStore,
  getAllClasses,
  getClassRoster,
  registerWalkIn,
  bookClass,
  cancelBooking,
  getMyBookings,
  findClassById,
  isClassConcluded
};
