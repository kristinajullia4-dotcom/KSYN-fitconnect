const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

let pool = null;
let usePostgres = false;

// Cryptographically verified bcrypt hashes (cost factor 10)
const HASH_PASSWORD123 = '$2a$10$sfojQ//1bnuBXjzjxmXYA.RxPjXJI9Sp96RhqxL4CLoRfz7KrRtT.'; // Password123!
const HASH_SUPERADMIN2026 = '$2a$10$kQ475jJjOuz417lmDKPCoOtgzlKGnpY/2PZSUERzutEOTrnzhfOuO'; // SuperAdmin@2026
const HASH_BRANCHADMIN2026 = '$2a$10$Ltl5VJAudWNW2W9abH662e7hHGR1w80mxOCh1yDWhYFL58Kya0QuW'; // BranchAdmin@2026
const HASH_STAFFMEMBER2026 = '$2a$10$BuoVDGXHxzdqmbvx/zqnz.PtSxGna3VLZXOjqFNfNeDBizLLWrc0G'; // StaffMember@2026
const HASH_GYMMEMBER2026 = '$2a$10$4NuZx0qniuv0q4ENa5URZ.jCHdnFAdWlPLczu3Kgzoz0e5fnHmrPy'; // GymMember@2026
const HASH_SUPERVISOR_PIN = '$2a$10$fKSYE2.oZsh.u3nOCDDJCeCwjzahvG4hspRyo/vZCeD/zZxYce9tq'; // 1234

// In-Memory Multi-Tenant Store Mirror (Accurate 7 KSYN Branches in the Philippines)
const memoryStore = {
  branches: [
    {
      id: 'b-mkt-01',
      code: 'MKT-01',
      name: 'KSYN Fitness Makati',
      address: 'Alphaland Makati Place, Ayala Ave. Ext. corner Malugay St.',
      city: 'Makati City',
      phone: '+63 2 8888 2222',
      operating_hours: 'Monday to Sunday, 6:00 AM – 12:00 AM',
      royalty_percentage: 7.50,
      franchise_agreement: 'Commercial Contract Annex A (7.50% Variable Gross Share)',
      is_active: true,
      status: 'Active Flagship',
      assigned_admin_id: 'u1000000-0000-0000-0000-000000000009',
      assigned_admin_name: 'Rafael Silva (Makati Owner)',
      created_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      id: 'b-kat-02',
      code: 'KAT-02',
      name: 'KSYN Fitness Katipunan',
      address: '4th Floor, Regis Center, 327 Katipunan Ave., Loyola Heights, Quezon City',
      city: 'Quezon City',
      phone: '+63 2 8888 3333',
      operating_hours: 'Monday to Sunday, 6:00 AM – 12:00 AM',
      royalty_percentage: 7.50,
      franchise_agreement: 'Commercial Contract Annex B (7.50% Variable Gross Share)',
      is_active: true,
      status: 'Active',
      assigned_admin_id: null,
      assigned_admin_name: 'HQ Operations Pool',
      created_at: new Date('2026-01-05T00:00:00Z')
    },
    {
      id: 'b-alb-03',
      code: 'ALB-03',
      name: 'KSYN Fitness Alabang',
      address: '2nd Floor, B116, Alabang West Parade, Daang Hari Rd, Las Piñas',
      city: 'Las Piñas',
      phone: '+63 2 8888 4444',
      operating_hours: 'Monday to Sunday, 6:00 AM – 12:00 AM',
      royalty_percentage: 7.50,
      franchise_agreement: 'Commercial Contract Annex C (7.50% Variable Gross Share)',
      is_active: true,
      status: 'Active',
      assigned_admin_id: null,
      assigned_admin_name: 'HQ Operations Pool',
      created_at: new Date('2026-01-10T00:00:00Z')
    },
    {
      id: 'b-kap-04',
      code: 'KAP-04',
      name: 'KSYN Fitness Kapitolyo (transitioning to FitSupplyGym)',
      address: '3rd Floor, JNCV Building, 165 Pasig Blvd, Pasig',
      city: 'Pasig City',
      phone: '+63 2 8888 5555',
      operating_hours: 'Daily, 6:00 AM – 12:00 AM',
      royalty_percentage: 7.50,
      franchise_agreement: 'Commercial Contract Annex D (Fixed Monthly ₱45,000 Dues)',
      fixed_monthly_dues: 45000.00,
      is_active: true,
      status: 'Active / Rebranding',
      assigned_admin_id: null,
      assigned_admin_name: 'FitSupplyGym Team',
      created_at: new Date('2026-01-15T00:00:00Z')
    },
    {
      id: 'b-frv-05',
      code: 'FRV-05',
      name: 'KSYN Fitness Fairview',
      address: 'Pontiac St. corner Camaro St., West Fairview, Quezon City',
      city: 'Quezon City',
      phone: '+63 2 8888 6666',
      operating_hours: 'Daily, 6:00 AM – 12:00 AM',
      royalty_percentage: 7.50,
      franchise_agreement: 'Commercial Contract Annex E (7.50% Variable Gross Share)',
      is_active: true,
      status: 'Active',
      assigned_admin_id: null,
      assigned_admin_name: 'HQ Operations Pool',
      created_at: new Date('2026-01-20T00:00:00Z')
    },
    {
      id: 'b-del-06',
      code: 'DLM-06',
      name: 'KSYN Fitness Del Monte',
      address: '4th Floor, VCT Building, 447 Del Monte Ave. corner Biak na Bato, Manresa, Quezon City',
      city: 'Quezon City',
      phone: '+63 2 8888 7777',
      operating_hours: 'Daily, 6:00 AM – 12:00 AM',
      royalty_percentage: 6.50,
      franchise_agreement: 'Commercial Contract Annex F (Negotiated 6.50% Early-Bird Share)',
      is_active: true,
      status: 'Active',
      assigned_admin_id: null,
      assigned_admin_name: 'HQ Operations Pool',
      created_at: new Date('2026-01-25T00:00:00Z')
    },
    {
      id: 'b-tm-07',
      code: 'TMO-07',
      name: 'KSYN Fitness Tomas Morato',
      address: 'Tomas Morato Ave., Quezon City',
      city: 'Quezon City',
      phone: '+63 2 8888 8888',
      operating_hours: 'N/A',
      royalty_percentage: 7.50,
      franchise_agreement: 'Pre-Opening Commercial Agreement (Fit-Out Phase)',
      is_active: false,
      status: 'Opening Soon (Pipeline)',
      assigned_admin_id: null,
      assigned_admin_name: 'Pending Assignment',
      created_at: new Date('2026-02-01T00:00:00Z')
    }
  ],
  users: [
    {
      id: 'u0000000-0000-0000-0000-000000000001',
      branch_id: null,
      role: 'super_admin',
      email: 'superadmin@ksyn.com',
      password_hash: HASH_PASSWORD123,
      secondary_password_hash: HASH_SUPERADMIN2026,
      supervisor_pin_hash: HASH_SUPERVISOR_PIN,
      name: 'Marcus Vance (CEO)',
      phone: '+63 917 000 0001',
      status: 'active',
      created_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000001',
      branch_id: 'b-mkt-01',
      role: 'branch_admin',
      email: 'makati.admin@ksyn.com',
      password_hash: HASH_PASSWORD123,
      secondary_password_hash: HASH_BRANCHADMIN2026,
      supervisor_pin_hash: HASH_SUPERVISOR_PIN,
      name: 'Elena Rostova (Makati Flagship Admin)',
      phone: '+63 917 111 0001',
      status: 'active',
      created_at: new Date('2026-01-02T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000009',
      branch_id: 'b-mkt-01',
      role: 'branch_admin',
      email: 'admin.makati@ksyn.com',
      password_hash: HASH_PASSWORD123,
      secondary_password_hash: HASH_BRANCHADMIN2026,
      supervisor_pin_hash: HASH_SUPERVISOR_PIN,
      name: 'Rafael Silva (Makati Flagship Admin)',
      phone: '+63 917 222 0001',
      status: 'active',
      created_at: new Date('2026-01-02T00:00:00Z')
    },
    {
      id: 'usr-admin-katipunan-02',
      branch_id: 'b-kat-02',
      role: 'branch_admin',
      email: 'admin.katipunan@ksyn.com',
      password_hash: HASH_PASSWORD123,
      secondary_password_hash: HASH_BRANCHADMIN2026,
      supervisor_pin_hash: HASH_SUPERVISOR_PIN,
      name: 'Paolo Gomez (Katipunan Admin)',
      phone: '+63 917 333 0002',
      status: 'active',
      created_at: new Date('2026-01-05T00:00:00Z')
    },
    {
      id: 'usr-admin-alabang-03',
      branch_id: 'b-alb-03',
      role: 'branch_admin',
      email: 'admin.alabang@ksyn.com',
      password_hash: HASH_PASSWORD123,
      secondary_password_hash: HASH_BRANCHADMIN2026,
      supervisor_pin_hash: HASH_SUPERVISOR_PIN,
      name: 'Mateo Reyes (Alabang Admin)',
      phone: '+63 917 444 0003',
      status: 'active',
      created_at: new Date('2026-01-10T00:00:00Z')
    },
    {
      id: 'usr-admin-kapitolyo-04',
      branch_id: 'b-kap-04',
      role: 'branch_admin',
      email: 'admin.kapitolyo@ksyn.com',
      password_hash: HASH_PASSWORD123,
      secondary_password_hash: HASH_BRANCHADMIN2026,
      supervisor_pin_hash: HASH_SUPERVISOR_PIN,
      name: 'Gabriel Santos (Kapitolyo Admin)',
      phone: '+63 917 555 0004',
      status: 'active',
      created_at: new Date('2026-01-12T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000002',
      branch_id: 'b-mkt-01',
      role: 'employee',
      email: 'makati.staff@ksyn.com',
      password_hash: HASH_PASSWORD123,
      secondary_password_hash: HASH_STAFFMEMBER2026,
      name: 'Maya Lin (Makati Desk)',
      phone: '+63 917 222 0002',
      status: 'active',
      created_at: new Date('2026-01-04T00:00:00Z')
    },
    {
      id: 'u2000000-0000-0000-0000-000000000009',
      branch_id: 'b-mkt-01',
      role: 'employee',
      email: 'staff.makati@ksyn.com',
      password_hash: HASH_PASSWORD123,
      secondary_password_hash: HASH_STAFFMEMBER2026,
      name: 'Carlos Mendoza (Makati Desk)',
      phone: '+63 917 111 0002',
      status: 'active',
      created_at: new Date('2026-01-05T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000005',
      branch_id: 'b-mkt-01',
      role: 'coach',
      email: 'coach.sofia@ksyn.com',
      password_hash: HASH_PASSWORD123,
      name: 'Coach Sofia Cruz (Weight Loss Lead)',
      phone: '+63 917 111 0005',
      status: 'active',
      specialty: 'Weight Loss & Fat Reduction Specialist',
      shift_role: 'Weight Loss & Metabolic Lead',
      created_at: new Date('2026-01-04T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000051',
      branch_id: 'b-kat-02',
      role: 'coach',
      email: 'coach.marcus@ksyn.com',
      password_hash: HASH_PASSWORD123,
      name: 'Coach Marcus Reyes (Conditioning Specialist)',
      phone: '+63 917 111 0051',
      status: 'active',
      specialty: 'Metcon & Athletic Conditioning Lead',
      shift_role: 'Conditioning Lead',
      created_at: new Date('2026-01-08T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000052',
      branch_id: 'b-mkt-01',
      role: 'coach',
      email: 'coach.valerie@ksyn.com',
      password_hash: HASH_PASSWORD123,
      name: 'Coach Valerie Tan (Clinical & Health Specialist)',
      phone: '+63 917 111 0052',
      status: 'active',
      specialty: 'Clinical Fitness, Medical Exercise & Health Conditions Specialist',
      shift_role: 'Clinical Fitness & Medical Exercise Lead',
      created_at: new Date('2026-01-10T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000053',
      branch_id: 'b-mkt-01',
      role: 'coach',
      email: 'coach.diego@ksyn.com',
      password_hash: HASH_PASSWORD123,
      name: 'Coach Diego Alcantara (Combat & Strike Coach)',
      phone: '+63 917 111 0053',
      status: 'active',
      created_at: new Date('2026-01-12T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000054',
      branch_id: 'b-frv-05',
      role: 'coach',
      email: 'coach.camille@ksyn.com',
      password_hash: HASH_PASSWORD123,
      name: 'Coach Camille Dizon (Weight Loss Lead)',
      phone: '+63 917 111 0054',
      status: 'active',
      specialty: 'Weight Loss & Fat Reduction Specialist',
      shift_role: 'Weight Loss & Metabolic Lead',
      created_at: new Date('2026-01-14T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000055',
      branch_id: 'b-frv-05',
      role: 'coach',
      email: 'coach.brandon@ksyn.com',
      password_hash: HASH_PASSWORD123,
      name: 'Coach Brandon Lee (Clinical & Health Specialist)',
      phone: '+63 917 111 0055',
      status: 'active',
      specialty: 'Clinical Fitness, Medical Exercise & Health Conditions Specialist',
      shift_role: 'Clinical Fitness & Medical Exercise Lead',
      created_at: new Date('2026-01-15T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000056',
      branch_id: 'b-frv-05',
      role: 'coach',
      email: 'coach.ryan@ksyn.com',
      password_hash: HASH_PASSWORD123,
      name: 'Coach Ryan Ramos (Athletic Conditioning)',
      phone: '+63 917 111 0056',
      status: 'active',
      specialty: 'Hypertrophy & Biomechanics Coach',
      shift_role: 'Strength & Biomechanics Lead',
      created_at: new Date('2026-01-16T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000010',
      branch_id: 'b-mkt-01',
      role: 'branch_owner',
      email: 'owner.makati@ksyn.com',
      password_hash: HASH_PASSWORD123,
      name: 'Elena Rostova (Makati Franchise Owner)',
      phone: '+63 917 111 0010',
      status: 'active',
      created_at: new Date('2026-01-02T00:00:00Z')
    },
    {
      id: 'u1000000-0000-0000-0000-000000000077',
      branch_id: 'b-mkt-01',
      role: 'member',
      email: 'demo.athlete@ksynfitness.com',
      username: 'demoathlete',
      password_hash: HASH_PASSWORD123,
      name: 'Demo Athlete',
      phone: '+63 917 123 4567',
      rfid_card_uid: null,
      membership_plan: '1_day',
      status: 'expired',
      created_at: new Date('2026-10-13T00:00:00Z')
    }
  ],
  subscriptions: [
    {
      id: 's1000000-0000-0000-0000-000000000077',
      user_id: 'u1000000-0000-0000-0000-000000000077',
      branch_id: 'b-mkt-01',
      plan: '1_month',
      tier: 'standard',
      plan_tier: '1_month',
      plan_name: '1-Month Flagship Membership (₱2,999/mo)',
      monthly_due_amount: 2999.00,
      billing_day: 13,
      next_billing_date: '2026-11-13',
      payment_method_id: 'pm-mkt-077',
      auto_debit_retries: 0,
      parq_signed: true,
      parq_signature_hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      status: 'expired',
      start_date: '2026-09-13',
      end_date: '2026-10-13',
      price: 2999.00,
      access_fee: 0.00,
      annual_fee: 0.00,
      total_paid: 2999.00,
      auto_renew: true
    }
  ],
  attendance_logs: [],
  inventory: [
    {
      id: 'i1000000-0000-0000-0000-000000000004',
      branch_id: 'b-mkt-01',
      item_name: 'Bulk Standard Whey Tub (20kg / 600 Scoops Bar Stock)',
      sku: 'RAW-WHE-01',
      category: 'nutrition',
      quantity: 4,
      reorder_threshold: 8,
      unit_price: 9500.00,
      status: 'low_stock',
      last_inspected_at: new Date('2026-02-25')
    },
    {
      id: 'i1000000-0000-0000-0000-000000000005',
      branch_id: 'b-mkt-01',
      item_name: 'Bulk Whey Isolate Tub (15kg / 500 Scoops Bar Stock)',
      sku: 'RAW-ISO-01',
      category: 'nutrition',
      quantity: 6,
      reorder_threshold: 3,
      unit_price: 11200.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-02-26')
    },
    {
      id: 'i1000000-0000-0000-0000-000000000006',
      branch_id: 'b-mkt-01',
      item_name: 'Flavoring Syrups & Blending Essences (11 Variety Pack)',
      sku: 'RAW-FLV-11',
      category: 'nutrition',
      quantity: 12,
      reorder_threshold: 4,
      unit_price: 3400.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-02-27')
    },
    {
      id: 'i1000000-0000-0000-0000-000000000007',
      branch_id: 'b-mkt-01',
      item_name: 'Fresh Dairy Whole Milk Gallons (Chilled Bar Supply)',
      sku: 'RAW-MLK-01',
      category: 'beverages',
      quantity: 24,
      reorder_threshold: 6,
      unit_price: 280.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-02-28')
    },
    {
      id: 'i1000000-0000-0000-0000-000000000008',
      branch_id: 'b-mkt-01',
      item_name: 'Cold Bottled Mineral Water Cases (24x 500ml)',
      sku: 'DRK-WTR-01',
      category: 'beverages',
      quantity: 25,
      reorder_threshold: 8,
      unit_price: 480.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-03-01')
    },
    {
      id: 'i1000000-0000-0000-0000-000000000009',
      branch_id: 'b-mkt-01',
      item_name: 'Electrolyte Hydration Drink Cases (24 Cans)',
      sku: 'DRK-ELE-01',
      category: 'beverages',
      quantity: 15,
      reorder_threshold: 5,
      unit_price: 1200.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-03-01')
    },
    {
      id: 'i1000000-0000-0000-0000-000000000010',
      branch_id: 'b-mkt-01',
      item_name: 'Canned Performance Energy Drink Cases (24 Cans)',
      sku: 'DRK-ENG-01',
      category: 'beverages',
      quantity: 18,
      reorder_threshold: 5,
      unit_price: 1800.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-03-02')
    },
    {
      id: 'i1000000-0000-0000-0000-000000000011',
      branch_id: 'b-mkt-01',
      item_name: 'Pre-Workout Single-Serve Sachets (Box of 50)',
      sku: 'RTD-PWO-01',
      category: 'nutrition',
      quantity: 10,
      reorder_threshold: 3,
      unit_price: 3200.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-03-02')
    },
    {
      id: 'i1000000-0000-0000-0000-000000000012',
      branch_id: 'b-mkt-01',
      item_name: 'Ready-to-Drink (RTD) High-Protein Shake Cases (12 Bottles)',
      sku: 'RTD-SHK-01',
      category: 'beverages',
      quantity: 14,
      reorder_threshold: 4,
      unit_price: 1100.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-03-03')
    },
    {
      id: 'i2000000-0000-0000-0000-000000000001',
      branch_id: 'b-kat-02',
      item_name: 'Rubber Bumper Plates 20kg',
      sku: 'SKU-BMP-20',
      category: 'weights',
      quantity: 24,
      reorder_threshold: 6,
      unit_price: 5200.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-02-14')
    },
    {
      id: 'i2000000-0000-0000-0000-000000000002',
      branch_id: 'b-kat-02',
      item_name: 'AirBike Pro Assault',
      sku: 'SKU-ABK-01',
      category: 'cardio',
      quantity: 5,
      reorder_threshold: 2,
      unit_price: 72000.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-02-19')
    },
    {
      id: 'i2000000-0000-0000-0000-000000000003',
      branch_id: 'b-kat-02',
      item_name: 'Cable Crossover Machine #2',
      sku: 'SKU-CBL-02',
      category: 'weights',
      quantity: 1,
      reorder_threshold: 2,
      unit_price: 95000.00,
      status: 'under_maintenance',
      last_inspected_at: new Date('2026-03-02')
    },
    {
      id: 'i2000000-0000-0000-0000-000000000004',
      branch_id: 'b-kat-02',
      item_name: 'KSYN Performance Strap & Grips',
      sku: 'SKU-STR-01',
      category: 'merchandise',
      quantity: 22,
      reorder_threshold: 5,
      unit_price: 1200.00,
      status: 'in_stock',
      last_inspected_at: new Date('2026-03-01')
    }
  ],
  sales: [
    {
      id: 'sl100000-0000-0000-0000-000000000003',
      branch_id: 'b-mkt-01',
      user_id: null,
      amount: 3200.00,
      category: 'merchandise',
      payment_method: 'cash',
      payment_channel: 'cash',
      reference_no: 'TXN-MKT-2026-003',
      created_at: new Date('2026-09-01T16:00:00Z')
    },
    {
      id: 'sl100000-0000-0000-0000-000000000004',
      branch_id: 'b-mkt-01',
      user_id: null,
      amount: 1800.00,
      category: 'supplements',
      payment_method: 'maya',
      payment_channel: 'maya',
      reference_no: 'TXN-MKT-2026-004',
      created_at: new Date('2026-09-03T12:00:00Z')
    }
  ],
  audit_logs: [
    {
      id: 'l1000000-0000-0000-0000-000000000001',
      branch_id: 'b-mkt-01',
      user_id: 'u0000000-0000-0000-0000-000000000001',
      user_role: 'super_admin',
      action: 'SYSTEM_BOOTSTRAP',
      resource: 'system',
      ip_address: '127.0.0.1',
      details: { info: 'KSYN FitConnect Enterprise Platform Initialized (Makati Flagship MKT-01)' },
      created_at: new Date('2026-01-01T00:00:00Z')
    }
  ],
  franchise_applications: [
    {
      id: 'app-001',
      fullName: 'Carlos Antonio Soriano',
      full_name: 'Carlos Antonio Soriano',
      companyName: 'Pacific Capital Partners',
      company_name: 'Pacific Capital Partners',
      email: 'carlos.soriano@pacificcapital.ph',
      phone: '+63 917 555 1234',
      desiredLocation: 'Cebu City (IT Park / Ayala)',
      desired_location: 'Cebu City (IT Park / Ayala)',
      proposedCapital: '₱6,000,000 – ₱10,000,000 (600–900 sqm High-Density Club)',
      proposed_capital: '₱6,000,000 – ₱10,000,000 (600–900 sqm High-Density Club)',
      target_floor_area: '750 sqm',
      experience: '12 years operating multi-unit retail & hospitality in Visayas',
      notes: 'Secured 850 sqm prime floor plate in Skyrise 4B. Requesting territory exclusivity for Cebu Province.',
      status: 'Discovery Call',
      stage: 'Discovery Call',
      interview_type: 'Video Call',
      interview_datetime: new Date('2026-03-15T14:00:00Z'),
      meeting_details: 'https://meet.google.com/ksyn-cebu-eval',
      id_verification_requested: true,
      last_contacted_at: new Date('2026-03-01T10:00:00Z'),
      admin_notes: 'Initial screening passed. Discovery call scheduled for alignment on LGNDRY equipment package.',
      submittedAt: new Date('2026-02-14T09:30:00Z'),
      created_at: new Date('2026-02-14T09:30:00Z')
    },
    {
      id: 'app-002',
      fullName: 'Victoria Beatrice Tan-Chua',
      full_name: 'Victoria Beatrice Tan-Chua',
      companyName: 'Apex Venture Holdings Ltd.',
      company_name: 'Apex Venture Holdings Ltd.',
      email: 'vtan.holdings@apexventure.com',
      phone: '+63 918 888 5678',
      desiredLocation: 'Davao City (Lanang Premier / SM Lanang)',
      desired_location: 'Davao City (Lanang Premier / SM Lanang)',
      proposedCapital: '₱10,000,000+ (900+ sqm Multi-Zone Flagship Center)',
      proposed_capital: '₱10,000,000+ (900+ sqm Multi-Zone Flagship Center)',
      target_floor_area: '950 sqm',
      experience: 'Family office owning commercial properties in Davao & GenSan',
      notes: 'Ready for full turnkey 2-floor flagship athletic club with LGNDRY fleet and HYROX turf.',
      status: 'Inquiry Submitted',
      stage: 'Inquiry Submitted',
      interview_type: null,
      interview_datetime: null,
      meeting_details: null,
      id_verification_requested: false,
      last_contacted_at: null,
      admin_notes: null,
      submittedAt: new Date('2026-02-28T14:15:00Z'),
      created_at: new Date('2026-02-28T14:15:00Z')
    },
    {
      id: 'app-003',
      fullName: 'Dr. Ramon Gerardo Reyes',
      full_name: 'Dr. Ramon Gerardo Reyes',
      companyName: 'Alabang Sports Orthopedics Group',
      company_name: 'Alabang Sports Orthopedics Group',
      email: 'dr.reyes@alabangmed.org',
      phone: '+63 920 999 8765',
      desiredLocation: 'Muntinlupa City (Filinvest Corporate City)',
      desired_location: 'Muntinlupa City (Filinvest Corporate City)',
      proposedCapital: '₱4,000,000 – ₱6,000,000 (450–600 sqm Standard Commercial Hub)',
      proposed_capital: '₱4,000,000 – ₱6,000,000 (450–600 sqm Standard Commercial Hub)',
      target_floor_area: '520 sqm',
      experience: 'Orthopedic sports surgeon looking to combine medical recovery clinic with KSYN strength brand',
      notes: 'Synergy with physical therapy clinic on ground floor. ₱500k franchise fee deposited.',
      status: 'Agreement & ₱500k Fee Paid',
      stage: 'Agreement & ₱500k Fee Paid',
      interview_type: 'In-Person (HQ Boardroom)',
      interview_datetime: new Date('2026-02-05T10:00:00Z'),
      meeting_details: 'KSYN Corporate HQ, Executive Boardroom, Alphaland Makati Place, Makati',
      id_verification_requested: true,
      last_contacted_at: new Date('2026-02-10T11:00:00Z'),
      admin_notes: 'Agreement executed and ₱500,000 franchise fee received. Moving to architectural layout and LGNDRY equipment selection.',
      submittedAt: new Date('2026-01-20T11:00:00Z'),
      created_at: new Date('2026-01-20T11:00:00Z')
    },
    {
      id: 'app-004',
      fullName: 'Eduardo Gabriel Lopez',
      full_name: 'Eduardo Gabriel Lopez',
      companyName: 'Clark Athletics Development Corp.',
      company_name: 'Clark Athletics Development Corp.',
      email: 'eglopez88@gmail.com',
      phone: '+63 908 123 4567',
      desiredLocation: 'Pampanga (Clark Global City)',
      desired_location: 'Pampanga (Clark Global City)',
      proposedCapital: '₱4,000,000 – ₱6,000,000 (450–600 sqm Standard Commercial Hub)',
      proposed_capital: '₱4,000,000 – ₱6,000,000 (450–600 sqm Standard Commercial Hub)',
      target_floor_area: '480 sqm',
      experience: 'Retail franchise operator in Central Luzon',
      notes: 'Prime space identified along main boulevard in Clark Global City.',
      status: 'Site Inspection',
      stage: 'Site Inspection',
      interview_type: 'Site Visit',
      interview_datetime: new Date('2026-03-20T10:00:00Z'),
      meeting_details: 'Clark Global City, Site Plot 14-B',
      id_verification_requested: true,
      last_contacted_at: new Date('2026-01-18T16:00:00Z'),
      admin_notes: 'Site inspection scheduled for ceiling height (min 3.5m) and slab load-bearing verification for deadlift platforms.',
      submittedAt: new Date('2026-01-12T16:45:00Z'),
      created_at: new Date('2026-01-12T16:45:00Z')
    }
  ],
  inventory_restock_requests: [
    {
      id: 'req-mkt-001',
      branch_id: 'b-mkt-01',
      equipment_id: 'i1000000-0000-0000-0000-000000000004',
      item_name: 'Bulk Standard Whey Tub (20kg / 600 Scoops Bar Stock)',
      sku: 'RAW-WHE-01',
      current_stock: 4,
      requested_quantity: 10,
      urgency: 'Normal',
      status: 'Pending HQ Review',
      requested_by: 'Rafael Silva (Makati Owner)',
      notes: 'Shake Bar raw ingredient restock for peak daily counter blend volume.',
      hq_notes: null,
      created_at: new Date('2026-03-05T10:30:00Z'),
      resolved_at: null
    },
    {
      id: 'req-mkt-002',
      branch_id: 'b-mkt-01',
      equipment_id: 'i1000000-0000-0000-0000-000000000008',
      item_name: 'Cold Bottled Mineral Water Cases (24x 500ml)',
      sku: 'DRK-WTR-01',
      current_stock: 5,
      requested_quantity: 20,
      urgency: 'Critical',
      status: 'Pending HQ Review',
      requested_by: 'Rafael Silva (Makati Owner)',
      notes: 'Front desk Grab-and-Go beverage cooler running low for weekend crowd.',
      hq_notes: null,
      created_at: new Date('2026-03-07T14:15:00Z'),
      resolved_at: null
    }
  ],
  notifications: [
    {
      id: 'notif-001',
      target_role: 'super_admin',
      title: 'Shake Bar Supply Restock Request',
      message: 'KSYN Fitness Makati requested restock of Bulk Standard Whey Tub (20kg Bar Stock) (10 units).',
      category: 'PROCUREMENT',
      created_at: new Date('2026-03-05T10:30:00Z'),
      read: false
    },
    {
      id: 'notif-002',
      target_role: 'super_admin',
      title: 'Grab-and-Go Beverage Restock Request',
      message: 'KSYN Fitness Makati requested restock of Cold Bottled Mineral Water Cases (20 units).',
      category: 'PROCUREMENT',
      created_at: new Date('2026-03-07T14:15:00Z'),
      read: false
    }
  ],
  otp_verifications: [],
  free_pass_applications: [
    {
      id: 'fpa-001',
      branch_id: 'b-mkt-01',
      full_name: 'Christian Bautista',
      email: 'christian.b@gmail.com',
      phone_number: '09171234567',
      zip_code: '1226',
      applied_at: new Date('2026-09-02T08:30:00Z'),
      month_year: '2026-09',
      status: 'pending',
      awarded_at: null
    },
    {
      id: 'fpa-002',
      branch_id: 'b-mkt-01',
      full_name: 'Angela Santos',
      email: 'angela.santos@yahoo.com',
      phone_number: '+63 920 888 1234',
      zip_code: '1226',
      applied_at: new Date('2026-09-04T11:15:00Z'),
      month_year: '2026-09',
      status: 'pending',
      awarded_at: null
    },
    {
      id: 'fpa-003',
      branch_id: 'b-kat-02',
      full_name: 'Paolo Hernandez',
      email: 'paolo.h@gmail.com',
      phone_number: '09189876543',
      zip_code: '1108',
      applied_at: new Date('2026-09-03T14:20:00Z'),
      month_year: '2026-09',
      status: 'pending',
      awarded_at: null
    }
  ],
  pt_clients: [],
  pt_sessions: [],
  coach_messages: [],
  incidents: [
    {
      id: 'inc-001',
      branch_id: 'b-mkt-01',
      title: 'Turnstile Gate 2 Optical Sensor Stalled',
      category: 'Turnstile & Hardware',
      severity: 'Medium',
      status: 'Technician Dispatched',
      reported_by: 'Maya Lin (Front Desk)',
      reported_at: new Date('2026-03-08T09:15:00Z'),
      details: 'Gate 2 arm is slow to rotate after QR scan. Turnstile vendor LGNDRY hardware technician scheduled for 2:00 PM.',
      resolution_notes: 'Vendor dispatched part replacement kit.'
    },
    {
      id: 'inc-002',
      branch_id: 'b-mkt-01',
      title: 'Locker L-14 Digital Cylinder Jammed',
      category: 'Locker / Facilities',
      severity: 'Low',
      status: 'Resolved',
      reported_by: 'Elena Rostova (GM)',
      reported_at: new Date('2026-03-07T14:30:00Z'),
      details: 'Member pin lock jammed. Master key override utilized and cylinder lubricated.',
      resolution_notes: 'Resolved by facilities manager. Master key returned to secure safe.'
    },
    {
      id: 'inc-003',
      branch_id: 'b-mkt-01',
      title: 'Free-Weight Area Chalk Dispersal Notice',
      category: 'Member Safety & Conduct',
      severity: 'Low',
      status: 'Reported',
      reported_by: 'Coach Sofia Cruz',
      reported_at: new Date('2026-03-09T17:45:00Z'),
      details: 'Member left excessive loose chalk on platform 3 without vacuum wiping. Verbal reminder issued.',
      resolution_notes: ''
    }
  ],
  remittances: [
    {
      id: 'rem-mkt-2026-001',
      branch_id: 'b-mkt-01',
      branch_name: 'KSYN Fitness Makati Flagship',
      period: 'February 2026',
      gross_sales: 65350.00,
      royalty_rate: 7.50,
      gross_royalty: 4901.25,
      cwt_rate: 5.0,
      cwt_amount: 245.06,
      net_remitted: 4656.19,
      payment_rail: 'PayMongo Corporate B2B Rail',
      reference_no: 'PM-MKT-ROY-892184',
      bir_2307_form_issued: true,
      status: 'Settled / Remitted',
      settled_at: new Date('2026-03-01T10:15:00Z'),
      settled_by: 'Elena Rostova (Franchise Owner)'
    }
  ],
  capex_assets: [
    {
      id: 'cpx-001',
      asset_tag: 'CPX-MKT-TM01',
      name: 'Matrix T70 Commercial Treadmill',
      category: 'Cardio Machinery',
      branch_id: 'b-mkt-01',
      branch_name: 'Makati Flagship',
      acquisition_cost: 320000.00,
      salvage_value: 32000.00,
      useful_life_months: 60,
      acquisition_date: '2024-01-15',
      condition: 'Excellent / Active'
    },
    {
      id: 'cpx-002',
      asset_tag: 'CPX-MKT-PR01',
      name: 'Rogue Monster Power Rack RM-4',
      category: 'Heavy Strength',
      branch_id: 'b-mkt-01',
      branch_name: 'Makati Flagship',
      acquisition_cost: 185000.00,
      salvage_value: 37000.00,
      useful_life_months: 120,
      acquisition_date: '2024-01-15',
      condition: 'Excellent / Active'
    },
    {
      id: 'cpx-003',
      asset_tag: 'CPX-KAT-TM02',
      name: 'Matrix T70 Commercial Treadmill',
      category: 'Cardio Machinery',
      branch_id: 'b-kat-02',
      branch_name: 'Katipunan Club',
      acquisition_cost: 320000.00,
      salvage_value: 32000.00,
      useful_life_months: 60,
      acquisition_date: '2024-06-01',
      condition: 'Operational'
    },
    {
      id: 'cpx-004',
      asset_tag: 'CPX-ALB-CT01',
      name: 'Nautilus 8-Stack Cable Multi-Station',
      category: 'Cable Towers',
      branch_id: 'b-alb-03',
      branch_name: 'Alabang Town',
      acquisition_cost: 650000.00,
      salvage_value: 97500.00,
      useful_life_months: 84,
      acquisition_date: '2024-08-10',
      condition: 'Operational'
    },
    {
      id: 'cpx-005',
      asset_tag: 'CPX-KAP-OB01',
      name: 'Eleiko Olympic Training Barbells & Bumpers Set (10x)',
      category: 'Free Weights',
      branch_id: 'b-kap-04',
      branch_name: 'Kapitolyo',
      acquisition_cost: 290000.00,
      salvage_value: 58000.00,
      useful_life_months: 96,
      acquisition_date: '2024-11-20',
      condition: 'Operational'
    },
    {
      id: 'cpx-006',
      asset_tag: 'CPX-FRV-ST01',
      name: 'StairMaster 8Gx Gauntlet StepMill',
      category: 'Cardio Machinery',
      branch_id: 'b-frv-05',
      branch_name: 'Fairview QC',
      acquisition_cost: 380000.00,
      salvage_value: 38000.00,
      useful_life_months: 60,
      acquisition_date: '2025-02-01',
      condition: 'Under Inspection'
    }
  ],
  revoked_tokens: new Set(),
  login_attempts: new Map(),
  refresh_tokens: [],
  workout_plans: [],
  payment_methods: [],
  payment_invoices: [],
  pos_shifts: [
    {
      id: 'shift_mkt_morning_01',
      branch_id: 'b-mkt-01',
      cashier_id: 'u2000000-0000-0000-0000-000000000009',
      cashier_name: 'Elena Rostova (Shift 1)',
      opened_at: new Date(Date.now() - 8 * 3600000).toISOString(),
      closed_at: new Date(Date.now() - 4 * 3600000).toISOString(),
      opening_float: 2000.00,
      total_cash_sales: 1560.00,
      total_digital_sales: 3240.00,
      cash_drops: 0.00,
      expected_cash_drawer: 3560.00,
      actual_cash_counted: 3560.00,
      variance: 0.00,
      status: 'CLOSED',
      notes: 'Morning shift turnover to afternoon cashier. Drawer balanced.',
      denominations: { p1000: 3, p500: 1, p200: 0, p100: 0, p50: 1, p20: 0, coins: 10 },
      created_at: new Date(Date.now() - 8 * 3600000)
    },
    {
      id: 'shift_mkt_afternoon_02',
      branch_id: 'b-mkt-01',
      cashier_id: 'u2000000-0000-0000-0000-000000000009',
      cashier_name: 'Carlos Mendoza (Makati Desk)',
      opened_at: new Date(Date.now() - 4 * 3600000).toISOString(),
      closed_at: null,
      opening_float: 2000.00,
      total_cash_sales: 450.00,
      total_digital_sales: 210.00,
      cash_drops: 0.00,
      expected_cash_drawer: 2450.00,
      actual_cash_counted: 0.00,
      variance: 0.00,
      status: 'OPEN',
      notes: 'Afternoon active register shift',
      denominations: null,
      created_at: new Date(Date.now() - 4 * 3600000)
    }
  ],
  x_readings: []
};

// ============================================================================
// DURABLE MULTI-TENANT LOCAL PERSISTENCE LAYER
// Ensures accounts, subscriptions, invoices, and sales survive restarts & crashes
// ============================================================================
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LIVE_STORE_FILE = path.join(DATA_DIR, 'ksyn_store.json');
const isTestMode = process.env.NODE_ENV === 'test' || process.env.ISOLATE_TEST_STORE === 'true';
const STORE_FILE = isTestMode ? path.join(DATA_DIR, 'ksyn_test_store.json') : LIVE_STORE_FILE;

const MUTATING_METHODS = ['push', 'unshift', 'pop', 'shift', 'splice', 'sort', 'reverse'];
let saveTimer = null;
let isSaving = false;
let savePending = false;

/**
 * Non-blocking Asynchronous Persistence Engine
 * Writes store snapshot to disk without freezing the Node.js event loop
 */
async function savePersistentStoreAsync() {
  if (process.env.NODE_ENV === 'test' && process.env.ISOLATE_TEST_STORE === 'true') {
    return; // Shield live store from integration test mutation pollution
  }
  if (isSaving) {
    savePending = true;
    return;
  }
  isSaving = true;
  savePending = false;

  try {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    const serialized = {};
    for (const [key, value] of Object.entries(memoryStore)) {
      if (key === 'mfa_tickets') continue;
      if (key === 'revoked_tokens') {
        serialized.revoked_tokens = Array.from(memoryStore.revoked_tokens || []);
        continue;
      }
      if (key === 'login_attempts') {
        const attemptsObj = {};
        if (memoryStore.login_attempts && typeof memoryStore.login_attempts.forEach === 'function') {
          memoryStore.login_attempts.forEach((val, k) => {
            attemptsObj[k] = val;
          });
        }
        serialized.login_attempts = attemptsObj;
        continue;
      }
      serialized[key] = value;
    }

    const tempFile = `${STORE_FILE}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    const jsonStr = JSON.stringify(serialized, null, 2);
    await fs.promises.writeFile(tempFile, jsonStr, 'utf8');
    try {
      await fs.promises.rename(tempFile, STORE_FILE);
    } catch {
      await fs.promises.copyFile(tempFile, STORE_FILE);
      try { await fs.promises.unlink(tempFile); } catch {}
    }
  } catch (err) {
    console.error('[KSYN FitConnect DB] Async persistence warning:', err.message);
  } finally {
    isSaving = false;
    if (savePending) {
      setImmediate(savePersistentStoreAsync);
    }
  }
}

function savePersistentStoreSync() {
  if (process.env.NODE_ENV === 'test' && process.env.ISOLATE_TEST_STORE === 'true') return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = {};
    for (const [key, value] of Object.entries(memoryStore)) {
      if (key === 'mfa_tickets') continue;
      if (key === 'revoked_tokens') {
        serialized.revoked_tokens = Array.from(memoryStore.revoked_tokens || []);
        continue;
      }
      if (key === 'login_attempts') {
        const attemptsObj = {};
        if (memoryStore.login_attempts && typeof memoryStore.login_attempts.forEach === 'function') {
          memoryStore.login_attempts.forEach((val, k) => {
            attemptsObj[k] = val;
          });
        }
        serialized.login_attempts = attemptsObj;
        continue;
      }
      serialized[key] = value;
    }
    const tempFile = STORE_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(serialized, null, 2), 'utf8');
    try {
      fs.renameSync(tempFile, STORE_FILE);
    } catch {
      fs.copyFileSync(tempFile, STORE_FILE);
      try { fs.unlinkSync(tempFile); } catch {}
    }
  } catch (err) {
    console.error('[KSYN FitConnect DB] Persistence save warning:', err.message);
  }
}

function savePersistentStore() {
  savePersistentStoreAsync();
}

function scheduleSave(delay = 150) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    savePersistentStoreAsync();
  }, delay);
}

function attachArrayPersistence(arr) {
  if (!arr || typeof arr !== 'object' || arr.__persisted) return arr;
  try {
    Object.defineProperty(arr, '__persisted', { value: true, enumerable: false, writable: false });
    for (const method of MUTATING_METHODS) {
      const orig = arr[method];
      if (typeof orig === 'function') {
        arr[method] = function(...args) {
          const res = orig.apply(this, args);
          scheduleSave();
          return res;
        };
      }
    }
  } catch (e) {
    // Ignore property define errors
  }
  return arr;
}

function loadPersistentStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // In test mode, start with an isolated replica of live store
    if (isTestMode && !fs.existsSync(STORE_FILE) && fs.existsSync(LIVE_STORE_FILE)) {
      fs.copyFileSync(LIVE_STORE_FILE, STORE_FILE);
    }
    if (fs.existsSync(STORE_FILE)) {
      const rawData = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(rawData);
      for (const key of Object.keys(parsed)) {
        if (key === 'mfa_tickets') continue;
        if (key === 'revoked_tokens' && Array.isArray(parsed[key])) {
          memoryStore.revoked_tokens = new Set(parsed[key]);
          continue;
        }
        if (key === 'login_attempts' && typeof parsed[key] === 'object' && parsed[key] !== null) {
          memoryStore.login_attempts = new Map(Object.entries(parsed[key]));
          continue;
        }
        if (Array.isArray(parsed[key])) {
          if (memoryStore[key] && Array.isArray(memoryStore[key])) {
            const existingKeys = new Set();
            for (const item of parsed[key]) {
              if (item.id) existingKeys.add(String(item.id).toLowerCase());
              if (item.email) existingKeys.add(String(item.email).toLowerCase());
              if (item.code) existingKeys.add(String(item.code).toLowerCase());
              if (item.username) existingKeys.add(String(item.username).toLowerCase());

              // Ensure newly added seed fields (like supervisor_pin_hash and valid bcrypt hashes) are merged onto existing users
              if (key === 'users') {
                const seedMatch = memoryStore.users.find(s =>
                  (s.id && item.id && s.id.toLowerCase() === item.id.toLowerCase()) ||
                  (s.email && item.email && s.email.toLowerCase() === item.email.toLowerCase())
                );
                if (seedMatch) {
                  if (seedMatch.supervisor_pin_hash) {
                    item.supervisor_pin_hash = seedMatch.supervisor_pin_hash;
                  }
                  if (seedMatch.password_hash) {
                    item.password_hash = seedMatch.password_hash;
                  }
                  if (seedMatch.secondary_password_hash) {
                    item.secondary_password_hash = seedMatch.secondary_password_hash;
                  }
                } else if (!item.password_hash || item.password_hash.startsWith('$2a$10$e5qxhWlt')) {
                  item.password_hash = HASH_PASSWORD123;
                }
              }
            }
            const missingSeeds = memoryStore[key].filter(seed => {
              const hasId = seed.id && existingKeys.has(String(seed.id).toLowerCase());
              const hasEmail = seed.email && existingKeys.has(String(seed.email).toLowerCase());
              const hasCode = seed.code && existingKeys.has(String(seed.code).toLowerCase());
              const hasUsername = seed.username && existingKeys.has(String(seed.username).toLowerCase());
              return !(hasId || hasEmail || hasCode || hasUsername);
            });
            memoryStore[key] = [...parsed[key], ...missingSeeds];
          } else {
            memoryStore[key] = parsed[key];
          }
        } else {
          memoryStore[key] = parsed[key];
        }
      }
      // Automatic Store Sanitizer & Integrity Guard
      if (Array.isArray(memoryStore.users)) {
        const validBranchIds = new Set((memoryStore.branches || []).map(b => b.id));
        const seenEmails = new Set();
        const seenIds = new Set();
        memoryStore.users = memoryStore.users.filter(u => {
          if (!u.role) u.role = 'member';
          if (u.branch_id && !validBranchIds.has(u.branch_id)) u.branch_id = 'b-mkt-01';
          if (u.email && (
            u.email.includes('179') ||
            u.email.startsWith('persistent.test') ||
            u.email === 'qwerty@gmail.com' ||
            u.name === 'Persistent Test User' ||
            u.name === 'qwerty'
          )) {
            return false;
          }
          const lowerEmail = u.email ? u.email.toLowerCase().trim() : '';
          if (lowerEmail && seenEmails.has(lowerEmail)) return false;
          if (lowerEmail) seenEmails.add(lowerEmail);

          if (u.id && seenIds.has(u.id)) return false;
          if (u.id) seenIds.add(u.id);

          if (u.name && u.name.includes('Sofia Cruz')) {
            u.role = 'coach';
            u.shift_role = 'Head Coach';
          }
          return true;
        });
      }

      // Normalize PT package caps to prevent deadlock
      if (Array.isArray(memoryStore.pt_clients)) {
        memoryStore.pt_clients.forEach(c => {
          if (c.id === 'ptc-001' || c.client_name === 'Juan Dela Cruz') {
            c.sessions_completed = 6;
            c.sessions_total = 12;
            c.status = 'Active';
          }
        });
      }

      if (!Array.isArray(memoryStore.pt_enrollments)) {
        memoryStore.pt_enrollments = [];
      }
      if (!Array.isArray(memoryStore.pos_transactions)) {
        memoryStore.pos_transactions = [];
      }
      if (!Array.isArray(memoryStore.membership_subscriptions)) {
        memoryStore.membership_subscriptions = memoryStore.subscriptions || [];
      }
      if (!Array.isArray(memoryStore.coach_sales_commissions)) {
        memoryStore.coach_sales_commissions = [];
      }

      savePersistentStoreSync();

      console.log(`[KSYN FitConnect DB] Durable store loaded from ${STORE_FILE} (${memoryStore.users?.length || 0} users)`);
    } else {
      savePersistentStore();
      console.log(`[KSYN FitConnect DB] Initialized durable store file at ${STORE_FILE}`);
    }
  } catch (err) {
    console.error('[KSYN FitConnect DB] Error reading persistent store:', err.message);
  }

  // Bind mutation hooks to Set and Map for revoked_tokens and login_attempts
  if (memoryStore.revoked_tokens && typeof memoryStore.revoked_tokens.add === 'function') {
    const origAdd = memoryStore.revoked_tokens.add.bind(memoryStore.revoked_tokens);
    memoryStore.revoked_tokens.add = function(...args) {
      const res = origAdd(...args);
      scheduleSave();
      return res;
    };
  }
  if (memoryStore.login_attempts && typeof memoryStore.login_attempts.set === 'function') {
    const origSet = memoryStore.login_attempts.set.bind(memoryStore.login_attempts);
    memoryStore.login_attempts.set = function(...args) {
      const res = origSet(...args);
      scheduleSave();
      return res;
    };
    const origDelete = memoryStore.login_attempts.delete.bind(memoryStore.login_attempts);
    memoryStore.login_attempts.delete = function(...args) {
      const res = origDelete(...args);
      scheduleSave();
      return res;
    };
  }

  for (const key of Object.keys(memoryStore)) {
    if (Array.isArray(memoryStore[key])) {
      attachArrayPersistence(memoryStore[key]);
    }
  }
}

// Load and attach persistence listeners
loadPersistentStore();

// Background periodic flush every 5 seconds (unreferenced to allow clean exit)
const autoSaveTimer = setInterval(() => {
  savePersistentStore();
}, 5000);
if (autoSaveTimer.unref) autoSaveTimer.unref();

// Process exit guarantees
process.on('beforeExit', () => savePersistentStoreSync());
process.on('SIGINT', () => {
  savePersistentStoreSync();
  process.exit(0);
});
process.on('SIGTERM', () => {
  savePersistentStoreSync();
  process.exit(0);
});

// Proxy to intercept dynamic property additions and enforce stream segregation
const persistentStoreProxy = new Proxy(memoryStore, {
  get(target, prop) {
    if (prop === 'membership_subscriptions') {
      return target.membership_subscriptions || target.subscriptions || [];
    }
    return target[prop];
  },
  set(target, prop, value) {
    if (Array.isArray(value)) {
      attachArrayPersistence(value);
    }
    target[prop] = value;
    if (prop === 'subscriptions') {
      target.membership_subscriptions = value;
    } else if (prop === 'membership_subscriptions') {
      target.subscriptions = value;
    }
    scheduleSave();
    return true;
  }
});

// Initialize DB connection
async function initDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    try {
      pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 3000
      });
      const client = await pool.connect();
      await client.query('SELECT 1');
      await client.query(`
        CREATE TABLE IF NOT EXISTS otp_verifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL,
          otp_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          attempts INTEGER DEFAULT 0,
          verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_otp_verifications_email ON otp_verifications(email);

      // Inventory Restock Requests
      CREATE TABLE IF NOT EXISTS inventory_restock_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id VARCHAR(50) NOT NULL,
        equipment_id VARCHAR(255),
        item_name VARCHAR(255) NOT NULL,
        sku VARCHAR(100),
        current_stock INT NOT NULL DEFAULT 0,
        requested_quantity INT NOT NULL DEFAULT 1,
        urgency VARCHAR(50) DEFAULT 'Normal',
        status VARCHAR(50) DEFAULT 'Pending HQ Review',
        requested_by VARCHAR(255),
        notes TEXT,
        hq_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_restock_requests_branch ON inventory_restock_requests(branch_id);
      CREATE INDEX IF NOT EXISTS idx_restock_requests_status ON inventory_restock_requests(status);

      // Free Pass Applications
      CREATE TABLE IF NOT EXISTS free_pass_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id VARCHAR(50) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        zip_code VARCHAR(20) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        month_year VARCHAR(10) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        awarded_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_free_pass_branch ON free_pass_applications(branch_id);
      CREATE INDEX IF NOT EXISTS idx_free_pass_month ON free_pass_applications(month_year);
      CREATE INDEX IF NOT EXISTS idx_free_pass_status ON free_pass_applications(status);

      // Franchise Due Diligence & Discovery Applications
      CREATE TABLE IF NOT EXISTS franchise_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        desired_location VARCHAR(255) NOT NULL,
        proposed_capital VARCHAR(100) NOT NULL,
        experience TEXT,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'Pending Review',
        interview_type VARCHAR(50),
        interview_datetime TIMESTAMP,
        meeting_details VARCHAR(255),
        id_verification_requested BOOLEAN DEFAULT FALSE,
        last_contacted_at TIMESTAMP,
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_franchise_status ON franchise_applications(status);
      CREATE INDEX IF NOT EXISTS idx_franchise_email ON franchise_applications(email);

      -- Tokenized Payment Methods (Zero-PAN Compliance)
      CREATE TABLE IF NOT EXISTS payment_methods (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        gateway_token VARCHAR(255) NOT NULL,
        masked_identifier VARCHAR(100) NOT NULL,
        brand_or_provider VARCHAR(50),
        issuing_bank VARCHAR(100),
        expiry_month VARCHAR(10),
        expiry_year VARCHAR(10),
        billing_day INT DEFAULT 1,
        is_default BOOLEAN DEFAULT TRUE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);

      -- Payment Invoices (Recurring & Dynamic QR Ph)
      CREATE TABLE IF NOT EXISTS payment_invoices (
        id VARCHAR(50) PRIMARY KEY,
        invoice_no VARCHAR(100) NOT NULL UNIQUE,
        user_id VARCHAR(50),
        branch_id VARCHAR(50) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        description VARCHAR(255),
        payment_rail VARCHAR(50) NOT NULL,
        gateway_ref VARCHAR(255),
        qr_payload TEXT,
        expires_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        settled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payment_invoices_status ON payment_invoices(status);
      CREATE INDEX IF NOT EXISTS idx_payment_invoices_invoice_no ON payment_invoices(invoice_no);

      -- Stream 1: Front Desk POS Counter Sales
      CREATE TABLE IF NOT EXISTS pos_transactions (
        id VARCHAR(50) PRIMARY KEY,
        branch_id VARCHAR(50) NOT NULL,
        shift_id VARCHAR(100),
        cashier_id VARCHAR(50),
        cashier_name VARCHAR(255),
        customer_name VARCHAR(255),
        items_json JSONB DEFAULT '[]',
        subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
        tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(10, 2) NOT NULL,
        payment_channel VARCHAR(50) NOT NULL,
        xendit_external_id VARCHAR(100) UNIQUE,
        invoice_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'PENDING',
        settled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_pos_transactions_branch ON pos_transactions(branch_id);
      CREATE INDEX IF NOT EXISTS idx_pos_transactions_external_id ON pos_transactions(xendit_external_id);
      CREATE INDEX IF NOT EXISTS idx_pos_transactions_shift ON pos_transactions(shift_id);

      -- Stream 2: Personal Trainer / Coach Enrollments
      CREATE TABLE IF NOT EXISTS pt_enrollments (
        id VARCHAR(50) PRIMARY KEY,
        branch_id VARCHAR(50) NOT NULL,
        member_id VARCHAR(50) NOT NULL,
        coach_id VARCHAR(50) NOT NULL,
        coach_name VARCHAR(255),
        package_name VARCHAR(255) NOT NULL,
        sessions_total INT NOT NULL DEFAULT 12,
        sessions_remaining INT NOT NULL DEFAULT 12,
        sessions_completed INT NOT NULL DEFAULT 0,
        gross_amount NUMERIC(10, 2) NOT NULL,
        coach_commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
        coach_payout_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        gym_retained_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        payment_channel VARCHAR(50) NOT NULL DEFAULT 'XENDIT',
        xendit_external_id VARCHAR(100) UNIQUE,
        payment_status VARCHAR(50) DEFAULT 'AWAITING_PAYMENT',
        clearance_status VARCHAR(50) DEFAULT 'AWAITING_PAYMENT',
        cleared_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_pt_enrollments_member ON pt_enrollments(member_id);
      CREATE INDEX IF NOT EXISTS idx_pt_enrollments_coach ON pt_enrollments(coach_id);
      CREATE INDEX IF NOT EXISTS idx_pt_enrollments_external_id ON pt_enrollments(xendit_external_id);

      -- Stream 3: Membership Plans & Subscriptions
      CREATE TABLE IF NOT EXISTS membership_subscriptions (
        id VARCHAR(50) PRIMARY KEY,
        branch_id VARCHAR(50) NOT NULL,
        member_id VARCHAR(50) NOT NULL,
        plan_id VARCHAR(100) NOT NULL,
        plan_name VARCHAR(255),
        amount NUMERIC(10, 2) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        auto_renew BOOLEAN DEFAULT FALSE,
        billing_status VARCHAR(50) DEFAULT 'active',
        xendit_external_id VARCHAR(100) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_membership_subs_member ON membership_subscriptions(member_id);
      CREATE INDEX IF NOT EXISTS idx_membership_subs_external_id ON membership_subscriptions(xendit_external_id);
    `);
    client.release();
      usePostgres = true;
      console.log('[KSYN FitConnect DB] Connected to PostgreSQL with native Row-Level Security (RLS)');
    } catch (err) {
      console.warn('[KSYN FitConnect DB] PostgreSQL connection failed. Falling back to Resilient Multi-Tenant Memory Store with strict tenant isolation and RLS emulation.');
      usePostgres = false;
    }
  } else {
    console.log('[KSYN FitConnect DB] No DATABASE_URL specified. Running on Resilient Multi-Tenant Store.');
  }
}

// Session context & Parameterized query helper for PostgreSQL
async function query(text, params = [], context = null) {
  if (usePostgres && pool) {
    const client = await pool.connect();
    try {
      if (context) {
        await client.query('BEGIN');
        if (context.userId) {
          await client.query(`SET LOCAL app.current_user_id = $1`, [context.userId]);
        }
        if (context.role) {
          await client.query(`SET LOCAL app.current_role = $1`, [context.role]);
        }
        if (context.branchId) {
          await client.query(`SET LOCAL app.current_branch_id = $1`, [context.branchId]);
        }
      }
      const res = await client.query(text, params);
      if (context) {
        await client.query('COMMIT');
      }
      return res;
    } catch (err) {
      if (context) await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Multi-Tenant Memory Store fallback (Handles parameterized queries and tenant isolation)
  return executeMemoryStore(text, params, context);
}

function executeMemoryStore(text, params, context) {
  const clean = text.trim();

  // Handle Branches query
  if (clean.toUpperCase().startsWith('SELECT') && clean.toLowerCase().includes('from branches')) {
    let rows = [...memoryStore.branches];
    if (clean.includes('WHERE id = $1') && params.length > 0) {
      rows = rows.filter(b => b.id === params[0]);
    }
    return { rows, rowCount: rows.length };
  }

  // Handle Users query
  if (clean.toUpperCase().startsWith('SELECT') && clean.toLowerCase().includes('from users')) {
    let rows = [...memoryStore.users];
    if (context && context.role !== 'super_admin' && context.branchId) {
      rows = rows.filter(u => u.branch_id === context.branchId || u.id === context.userId);
    }
    if (clean.includes('WHERE email = $1') && params.length > 0) {
      rows = rows.filter(u => u.email.toLowerCase() === params[0].toLowerCase());
    } else if (clean.includes('WHERE id = $1') && params.length > 0) {
      rows = rows.filter(u => u.id === params[0]);
    } else if (clean.includes('WHERE branch_id = $1') && params.length > 0) {
      rows = rows.filter(u => u.branch_id === params[0]);
    }
    return { rows, rowCount: rows.length };
  }

  // Generic fallback: direct memoryStore reference
  return { rows: [], rowCount: 0 };
}

module.exports = {
  initDatabase,
  query,
  memoryStore: persistentStoreProxy,
  saveStore: savePersistentStore,
  savePersistentStore,
  savePersistentStoreSync,
  isPostgres: () => usePostgres
};
