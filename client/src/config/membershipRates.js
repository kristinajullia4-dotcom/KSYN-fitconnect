/**
 * KSYN FitConnect Enterprise - Unified Membership Rate Card & Fee Logic
 * 
 * Standard Pricing Architecture (Updated Across Network):
 * - 1-Day Pass: ₱500 standard (₱200 accompanied guest, ₱350 non-peak at select branches)
 * - 1 Month Pass: ₱2,400 base (₱1,700 at West Fairview) | Access Fee: ₱1,000 | Joining Fee: ₱1,000
 * - 3 Months Pass: ₱4,500 total (~₱1,500/month) | Access Fee: ₱1,000 | Joining Fee: ₱1,000
 * - 6 Months Pass: ₱8,400 total (~₱1,400/month) | Access Fee: ₱1,000 | Joining Fee: ₱1,000
 * - 12 Months Annual Elite: ₱15,000 total (~₱1,250/month base) | Joining Fee: ₱0 (WAIVED)
 *   * Makati All-In Annual Promo: ₱12,499 (approx ₱1,041/mo until October 31, 2026; Regular ₱17,999)
 *   * Katipunan Pre-Selling Annual: ₱9,996 (~₱833/mo)
 * 
 * Special & Student Discounts:
 * - Student Rate: ₱1,920 per month (50% off joining fee)
 * - Corporate Packages: Up to 40% off 12-month memberships for accredited partner employees
 * - Duo / Couples Promo: ₱1,200 off per person and waived joining fees
 * - PNP Personnel: 20% discount on presentation of valid PNP ID
 */

export const STANDARD_ANNUAL_FEE = 1000; // Typical branch standard joining/annual fee: ₱1,000 - ₱1,500
export const STANDARD_ACCESS_FEE = 1000; // Physical RFID Card & Turnstile Activation

export const MEMBERSHIP_PLANS = [
  {
    id: '1_day',
    name: '1-Day Pass',
    tag: '1-Day (Walk-In / Guest)',
    badge: 'Walk-In / Day Pass',
    planFee: 500,
    accessFee: 0,
    annualFee: 0,
    totalDue: 500,
    duration: '24-Hour Access',
    durationDays: 1,
    tier: 'basic',
    desc: 'Single club 24-hour pass for travelers, guests & drop-in workouts (₱500 standard / ₱200 accompanied guest).',
    features: ['Single Club 24-Hour Access', 'Standard Gym Hours', 'Locker Room & Shower Access', '24-Hour Digital Turnstile QR Pass']
  },
  {
    id: '1_month',
    name: '1 Month Pass',
    tag: '1 Month (Flexible Walk-In)',
    badge: 'Flexible',
    planFee: 2400,
    accessFee: 1000,
    annualFee: 1000,
    totalDue: 4400,
    duration: '1 Month (30 Days)',
    durationDays: 30,
    tier: 'basic',
    desc: 'Standard non-locked monthly gym access (₱2,400/mo standard; ₱1,700 at West Fairview).',
    features: ['Single Branch Access', 'Standard Gym Hours', 'Locker Room & Shower Access', 'Physical RFID Keycard Included', 'Standard ₱1,000 Joining Fee (Waivable via Promo)']
  },
  {
    id: '3_months',
    name: '3 Months Pass',
    tag: '3 Months (~₱1,500/mo)',
    badge: 'Popular',
    planFee: 4500,
    accessFee: 1000,
    annualFee: 1000,
    totalDue: 6500,
    duration: '3 Months (90 Days)',
    durationDays: 90,
    tier: 'pro',
    desc: 'Quarterly consistency commitment at ~₱1,500/month (₱4,500 total).',
    features: ['Single Branch Access', 'Standard Gym Hours', 'Locker Room & Shower Access', 'Physical RFID Keycard Included', 'Standard ₱1,000 Joining Fee']
  },
  {
    id: '6_months',
    name: '6 Months Pass',
    tag: '6 Months (~₱1,400/mo)',
    badge: 'Best Value',
    planFee: 8400,
    accessFee: 1000,
    annualFee: 1000,
    totalDue: 10400,
    duration: '6 Months (180 Days)',
    durationDays: 180,
    tier: 'pro',
    desc: 'Half-year performance package at ~₱1,400/month (₱8,400 total) with monthly guest visits.',
    features: ['Single Branch Access', '2 Free Guest Passes / mo', 'Complimentary Movement Screening', 'Physical RFID Keycard Included', 'Standard ₱1,000 Joining Fee']
  },
  {
    id: '12_months',
    name: '12 Months Annual Elite',
    tag: '12 Months (~₱1,250/mo - Fee Waived)',
    badge: 'Best Value (Annual Fee Waived)',
    planFee: 15000,
    accessFee: 1000,
    annualFee: 0,
    totalDue: 16000,
    duration: '12 Months (365 Days)',
    durationDays: 365,
    tier: 'elite',
    desc: 'Full-year all-branch nationwide membership at ~₱1,250/month base (₱15,000 total). Annual joining fee waived.',
    features: ['All 7 Branches Roaming Access', 'Unlimited Free Guest Passes', 'Volcanic Stone Sauna & Group Classes', 'Annual Membership Fee Waived (₱1,000 Off)', 'Physical RFID Keycard Included']
  }
];

/**
 * Branch-Specific Rates & Promos Architecture
 */
export const BRANCH_PRICING_OVERRIDES = {
  'Makati': {
    annualPromoPlanFee: 12499,
    regularAnnualFee: 17999,
    dayPassFee: 500,
    inclusions: ['Volcanic stone sauna', 'Basement parking during workouts', 'Free mineral water', 'Unlimited Yoga, Pilates, Zumba']
  },
  'Katipunan': {
    annualPromoPlanFee: 9996, // ~₱833/month
    studentPlanFee: 1920,
    dayPassFee: 350,
    inclusions: ['KSYN Exclusive posing room', '1 Free PT session', '1 Fitness assessment', '4 Multi-branch cross-visits/mo']
  },
  'Fairview': {
    monthPlanFee: 1700,
    dayPassFee: 350,
    dayPassGuestFee: 200,
    inclusions: ['Plate-loaded Hammer Strength zones', 'Shower & lockers', 'Free baseline assessment']
  },
  'Alabang': {
    monthPlanFee: 2400,
    dayPassFee: 500,
    duoDiscount: 1200,
    inclusions: ['Alabang West Parade hub', 'Modern functional turf', 'Couples/Pair discounts']
  }
};

/**
 * Promotional Campaigns with Strict Verification Requirements
 */
export const PROMO_CODES = {
  'MKT25': {
    code: 'MKT25',
    title: 'Makati Exclusive 25% Off Annual Pass',
    description: 'Exclusive promo for KSYN Fitness Makati members! 25% off 12-Month Annual Pass with waived annual joining fee.',
    applicablePlans: ['12_months'],
    discountType: 'percentage',
    discountValue: 25, // 25% off ₱15,000 = ₱3,750 savings
    waiveAnnualFee: true,
    waiveAccessFee: false,
    branchOnly: 'Makati',
    validUntil: '2026-10-31',
    badge: 'MAKATI EXCLUSIVE 25% OFF',
    requiresVerification: 'none',
    terms: 'Valid exclusively for members registered at KSYN Fitness Makati (Alphaland Makati Place) enrolling before Oct 31, 2026.'
  },
  'MAKATI12499': {
    code: 'MAKATI12499',
    title: 'Makati All-In Annual Promo (₱12,499/yr)',
    description: 'Special ₱12,499 all-in 1-year rate (~₱1,041/mo) with waived joining fee running until October 31, 2026.',
    applicablePlans: ['12_months'],
    discountType: 'fixed_price',
    discountValue: 12499,
    waiveAnnualFee: true,
    waiveAccessFee: true,
    branchOnly: 'Makati',
    validUntil: '2026-10-31',
    badge: 'MAKATI ₱12,499 ALL-IN',
    requiresVerification: 'none',
    terms: 'Valid exclusively at KSYN Makati until Oct 31, 2026. Regular rate returns to ₱17,999/yr.'
  },
  'KATIPUNAN833': {
    code: 'KATIPUNAN833',
    title: 'Katipunan Pre-Selling Promo (₱833/mo)',
    description: 'Exclusive 1-year pre-selling annual contract at ₱9,996 total (~₱833/month) for Katipunan athletes.',
    applicablePlans: ['12_months'],
    discountType: 'fixed_price',
    discountValue: 9996,
    waiveAnnualFee: true,
    waiveAccessFee: false,
    branchOnly: 'Katipunan',
    validUntil: '2026-12-31',
    badge: 'KATIPUNAN ₱833/MO',
    requiresVerification: 'none',
    terms: 'Valid exclusively for KSYN Fitness Katipunan (Regis Center) 12-month contract.'
  },
  'STUDENT': {
    code: 'STUDENT',
    title: 'Student Promotional Rate (₱1,920/mo)',
    description: 'Special student-friendly monthly rate of ₱1,920 (saves ₱480/mo) with 50% discount on joining fee.',
    applicablePlans: ['1_month'],
    discountType: 'fixed_price',
    discountValue: 1920, // Lowers 1-month fee to ₱1,920
    waiveAnnualFee: false,
    annualFeeDiscountPercent: 50, // 50% off joining fee (₱500)
    waiveAccessFee: false,
    validUntil: '2026-12-31',
    badge: '₱1,920 STUDENT RATE',
    requiresVerification: 'student',
    verificationLabel: 'Student ID & School Name Verification',
    terms: 'Must provide valid Philippine School / University Name & Student ID Number. Physical ID must be presented upon first turnstile entry.'
  },
  'DUO60': {
    code: 'DUO60',
    title: 'Duo / Couples Sign-Up Promo (₱1,200 Off + Waived Dues)',
    description: 'Group & pair promo: ₱1,200 discount per person and waived annual joining fee for 2+ athletes enrolling together.',
    applicablePlans: ['1_month', '3_months', '6_months', '12_months'],
    discountType: 'fixed_discount',
    discountValue: 1200, // ₱1,200 direct discount
    waiveAnnualFee: true,
    waiveAccessFee: false,
    validUntil: '2026-10-31',
    badge: 'DUO / PAIR ₱1,200 OFF',
    requiresVerification: 'duo',
    verificationLabel: 'Workout Partner Details Verification',
    terms: 'Applicable exclusively when enrolling with a workout partner. Must provide Partner Full Name & Partner Email / Contact.'
  },
  'CORP40': {
    code: 'CORP40',
    title: 'Corporate Partner 40% Off Annual Membership',
    description: 'Up to 40% discount on 12-month memberships for accredited corporate partner employees + waived annual fee.',
    applicablePlans: ['12_months'],
    discountType: 'percentage',
    discountValue: 40, // 40% off ₱15,000 = ₱6,000 savings
    waiveAnnualFee: true,
    waiveAccessFee: false,
    validUntil: '2026-12-31',
    badge: '40% CORPORATE DISCOUNT',
    requiresVerification: 'corporate',
    verificationLabel: 'Corporate Company & Work Email Verification',
    terms: 'Valid for employees of accredited corporate partners. Requires Company Name and official Corporate Work Email.'
  },
  'PNP20': {
    code: 'PNP20',
    title: 'Philippine National Police (PNP) 20% Discount',
    description: 'Special 20% discount on all standard memberships for active Philippine National Police personnel.',
    applicablePlans: ['1_month', '3_months', '6_months', '12_months'],
    discountType: 'percentage',
    discountValue: 20,
    waiveAnnualFee: true,
    waiveAccessFee: false,
    validUntil: '2026-12-31',
    badge: 'PNP 20% DISCOUNT',
    requiresVerification: 'pnp',
    verificationLabel: 'PNP Badge / Service ID Verification',
    terms: 'Requires valid Philippine National Police (PNP) Badge or Service ID number. ID will be verified at the reception desk.'
  }
};

/**
 * Standard Coach & Personal Training Packages
 */
export const PT_PACKAGES = [
  {
    id: 'pt-1',
    name: 'Single 1-on-1 Session / Assessment',
    sessions: 1,
    session_rate: 500,
    total_price: 500,
    badge: 'Trial / Single',
    desc: 'Introductory movement screening, baseline kinetic assessment, and 1-on-1 workout (~₱500 to ₱1,100 per session depending on trainer tier).'
  },
  {
    id: 'pt-12',
    name: '12-Session Signature PT Package',
    sessions: 12,
    session_rate: 500,
    total_price: 6000,
    badge: 'Popular Bundle',
    desc: 'Comprehensive 12-session coaching bundle (₱500/session) with periodized split, weekly form assessments, and direct in-app quick-chat.'
  },
  {
    id: 'pt-16',
    name: '16-Session Transformation Package',
    sessions: 16,
    session_rate: 468.75,
    total_price: 7500,
    badge: 'Best Value Bundle',
    desc: 'High-frequency transformation bundle lowering session cost down to ~₱470/session (₱7,500 total) with nutrition programming and body recomposition tracking.'
  }
];

export function getPlanDetails(planId) {
  const plan = MEMBERSHIP_PLANS.find(p => p.id === planId);
  if (!plan) {
    return {
      id: '',
      name: 'No Plan Selected',
      badge: 'Unselected',
      planFee: 0,
      accessFee: 0,
      annualFee: 0,
      totalDue: 0,
      duration: 'None',
      durationDays: 0,
      tier: 'basic',
      isAnnualWaived: true
    };
  }
  return {
    ...plan,
    isAnnualWaived: plan.id === '12_months' || plan.annualFee === 0
  };
}

/**
 * Get quick-apply promos tailored specifically to a member's branch, including dynamic announcements
 */
export function getAvailablePromosForBranch(userBranch = '', dynamicPromos = []) {
  const norm = (userBranch || '').toLowerCase();
  const staticPromos = Object.values(PROMO_CODES).filter(promo => {
    if (!promo.branchOnly) return true;
    return norm.includes(promo.branchOnly.toLowerCase());
  });

  const validDynamic = (dynamicPromos || [])
    .filter(p => p && (p.promo_code || p.code) && p.is_active !== false)
    .map(p => {
      const code = (p.promo_code || p.code).toUpperCase();
      return {
        code,
        title: p.title || p.name || `Promo ${code}`,
        description: p.content || p.description || '',
        badge: `${p.discount_percentage ? p.discount_percentage + '%' : (p.discount_amount ? '₱' + p.discount_amount : 'OFF')}`,
        discountType: p.discount_percentage ? 'percentage' : 'fixed_discount',
        discountValue: Number(p.discount_percentage || p.discount_amount || 0)
      };
    });

  const combined = [...staticPromos];
  for (const dp of validDynamic) {
    if (!combined.some(cp => cp.code.toUpperCase() === dp.code)) {
      combined.push(dp);
    }
  }
  return combined;
}

/**
 * Evaluate and apply promo code with strict branch, student, duo, corporate & PNP verification
 */
export function calculatePlanPricing(planId, promoCode = null, userBranch = '', verificationData = {}, dynamicPromos = []) {
  const plan = getPlanDetails(planId);
  if (!plan || !plan.id) {
    return {
      plan,
      basePlanFee: 0,
      effectivePlanFee: 0,
      accessFee: 0,
      annualFee: 0,
      discountAmount: 0,
      totalDue: 0,
      promoApplied: null,
      promoError: null,
      verificationRequired: null,
      isAnnualWaived: true
    };
  }

  // Branch-specific baseline adjustments (e.g. West Fairview standard ₱1,700/mo)
  let basePlanFee = plan.planFee;
  const normBranch = (userBranch || '').toLowerCase();
  if (normBranch.includes('fairview') && plan.id === '1_month') {
    basePlanFee = 1700;
  }

  let effectivePlanFee = basePlanFee;
  let accessFee = plan.accessFee;
  let annualFee = plan.annualFee;
  let discountAmount = 0;
  let promoApplied = null;
  let promoError = null;
  let verificationRequired = null;

  if (promoCode && typeof promoCode === 'string') {
    const cleanCode = promoCode.trim().toUpperCase();
    let promo = PROMO_CODES[cleanCode];

    if (!promo && Array.isArray(dynamicPromos)) {
      const dyn = dynamicPromos.find(p => p.promo_code && p.promo_code.toUpperCase() === cleanCode && p.is_active !== false);
      if (dyn) {
        promo = {
          code: dyn.promo_code.toUpperCase(),
          title: dyn.title || `Special Branch Promo (${dyn.discount_percentage}% OFF)`,
          discountType: 'percentage',
          discountValue: Number(dyn.discount_percentage) || 10,
          applicablePlans: ['1_month', '3_months', '6_months', '12_months', '1_year'],
          branchOnly: dyn.branch_name || null
        };
      }
    }

    if (!promo) {
      promoError = `Promo code "${cleanCode}" is invalid or expired.`;
    } else {
      // 1. Check plan compatibility
      if (promo.applicablePlans && !promo.applicablePlans.includes(plan.id)) {
        promoError = `Code "${cleanCode}" is only applicable to ${promo.applicablePlans.map(id => getPlanDetails(id).name).join(', ')}.`;
      } 
      // 2. Strict Branch Restriction Check
      else if (promo.branchOnly && userBranch && !normBranch.includes(promo.branchOnly.toLowerCase())) {
        promoError = `Code "${cleanCode}" is exclusively valid for KSYN Fitness ${promo.branchOnly} members. Your home branch is ${userBranch}.`;
      } 
      // 3. Verification Enforcement
      else if (promo.requiresVerification === 'student' && (!verificationData.schoolName?.trim() || !verificationData.studentId?.trim())) {
        verificationRequired = 'student';
        promoError = 'Student verification required: Please enter your School / University Name and Student ID Number.';
      } 
      else if (promo.requiresVerification === 'duo' && (!verificationData.partnerName?.trim() || !verificationData.partnerEmail?.trim())) {
        verificationRequired = 'duo';
        promoError = 'Duo promo requires 2 members: Please enter your workout partner\'s Full Name and Email.';
      } 
      else if (promo.requiresVerification === 'corporate' && (!verificationData.companyName?.trim() || !verificationData.corporateEmail?.trim())) {
        verificationRequired = 'corporate';
        promoError = 'Corporate discount requires Accredited Company Name and Corporate Email.';
      } 
      else if (promo.requiresVerification === 'pnp' && !verificationData.pnpId?.trim()) {
        verificationRequired = 'pnp';
        promoError = 'PNP discount requires your Philippine National Police Badge or ID Number.';
      } 
      else {
        // Validation Passed! Apply Discount
        promoApplied = promo;

        if (promo.discountType === 'percentage') {
          discountAmount = Math.round((basePlanFee * promo.discountValue) / 100);
          effectivePlanFee = Math.max(0, basePlanFee - discountAmount);
        } else if (promo.discountType === 'fixed_price') {
          discountAmount = Math.max(0, basePlanFee - promo.discountValue);
          effectivePlanFee = promo.discountValue;
        } else if (promo.discountType === 'fixed_discount') {
          discountAmount = promo.discountValue;
          effectivePlanFee = Math.max(0, basePlanFee - promo.discountValue);
        } else if (promo.discountType === 'annual_fee_discount') {
          const feeDiscount = Math.round((annualFee * promo.discountValue) / 100);
          annualFee = Math.max(0, annualFee - feeDiscount);
          discountAmount = feeDiscount;
        }

        if (promo.annualFeeDiscountPercent) {
          annualFee = Math.round((annualFee * (100 - promo.annualFeeDiscountPercent)) / 100);
        }

        if (promo.waiveAnnualFee) {
          annualFee = 0;
        }
        if (promo.waiveAccessFee) {
          accessFee = 0;
        }
      }
    }
  }

  const totalDue = effectivePlanFee + accessFee + annualFee;

  return {
    plan: {
      ...plan,
      planFee: basePlanFee
    },
    basePlanFee,
    effectivePlanFee,
    accessFee,
    annualFee,
    discountAmount,
    totalDue,
    promoApplied,
    promoError,
    verificationRequired,
    isAnnualWaived: annualFee === 0
  };
}
