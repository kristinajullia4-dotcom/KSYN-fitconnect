/**
 * KSYN FitConnect Enterprise - 7-Branch Network Directory & Operating Data
 * Strictly synchronized with 7 verified commercial fitness clubs
 */

export const BRANCH_DIRECTORY = [
  {
    id: 'b-mkt-01',
    code: 'MKT-01',
    name: 'KSYN Fitness Makati',
    location: 'Alphaland Makati Place, Ayala Ave. Ext. corner Malugay St.',
    address: 'Alphaland Makati Place, Ayala Ave. Ext. corner Malugay St.',
    city: 'Makati City',
    district: 'Makati / South Metro',
    operating_hours: 'Monday to Sunday, 6:00 AM – 12:00 AM',
    phone: '+63 2 8888 2222',
    status: 'Active Flagship',
    is_active: true,
    is_flagship: true,
    features: ['Olympic Platforms', 'Cryo Chamber', 'Executive Showers', 'HIIT Zone']
  },
  {
    id: 'b-kat-02',
    code: 'KAT-02',
    name: 'KSYN Fitness Katipunan',
    location: '4th Floor, Regis Center, 327 Katipunan Ave., Loyola Heights, Quezon City',
    address: '4th Floor, Regis Center, 327 Katipunan Ave., Loyola Heights, Quezon City',
    city: 'Quezon City',
    district: 'Quezon City',
    operating_hours: 'Monday to Sunday, 6:00 AM – 12:00 AM',
    phone: '+63 2 8888 3333',
    status: 'Active',
    is_active: true,
    is_flagship: false,
    features: ['Hammer Strength Pits', 'Collegiate Athlete Zone', 'Cardio Arena', 'Fuel Bar']
  },
  {
    id: 'b-alb-03',
    code: 'ALB-03',
    name: 'KSYN Fitness Alabang',
    location: '2nd Floor, B116, Alabang West Parade, Daang Hari Rd, Las Piñas',
    address: '2nd Floor, B116, Alabang West Parade, Daang Hari Rd, Las Piñas',
    city: 'Las Piñas',
    district: 'Alabang / South Metro',
    operating_hours: 'Monday to Sunday, 6:00 AM – 12:00 AM',
    phone: '+63 2 8888 4444',
    status: 'Active',
    is_active: true,
    is_flagship: false,
    features: ['Turf Sprint Track', 'Eleiko Calibrated Plates', 'Infrared Sauna', 'Physio Bay']
  },
  {
    id: 'b-kap-04',
    code: 'KAP-04',
    name: 'KSYN Fitness Kapitolyo (transitioning to FitSupplyGym)',
    location: '3rd Floor, JNCV Building, 165 Pasig Blvd, Pasig',
    address: '3rd Floor, JNCV Building, 165 Pasig Blvd, Pasig',
    city: 'Pasig City',
    district: 'Pasig / Central Metro',
    operating_hours: 'Daily, 6:00 AM – 12:00 AM',
    phone: '+63 2 8888 5555',
    status: 'Active / Rebranding',
    is_active: true,
    is_flagship: false,
    features: ['Powerlifting Platforms', 'Functional Rig', 'Specialized Barbell Den', 'Pro Shop']
  },
  {
    id: 'b-frv-05',
    code: 'FRV-05',
    name: 'KSYN Fitness Fairview',
    location: 'Pontiac St. corner Camaro St., West Fairview, Quezon City',
    address: 'Pontiac St. corner Camaro St., West Fairview, Quezon City',
    city: 'Quezon City',
    district: 'Quezon City',
    operating_hours: 'Daily, 6:00 AM – 12:00 AM',
    phone: '+63 2 8888 6666',
    status: 'Active',
    is_active: true,
    is_flagship: false,
    features: ['Multi-Boutique Studios', 'ISO-Lateral Matrix', 'Recovery Lounge', 'Free Weight Pit']
  },
  {
    id: 'b-del-06',
    code: 'DLM-06',
    name: 'KSYN Fitness Del Monte',
    location: '4th Floor, VCT Building, 447 Del Monte Ave. corner Biak na Bato, Manresa, Quezon City',
    address: '4th Floor, VCT Building, 447 Del Monte Ave. corner Biak na Bato, Manresa, Quezon City',
    city: 'Quezon City',
    district: 'Quezon City',
    operating_hours: 'Daily, 6:00 AM – 12:00 AM',
    phone: '+63 2 8888 7777',
    status: 'Active',
    is_active: true,
    is_flagship: false,
    features: ['Heavy Dumbbell Range (Up to 150lbs)', 'Technogym Cardio', 'Sauna Suites', 'Locker Hub']
  },
  {
    id: 'b-tm-07',
    code: 'TMO-07',
    name: 'KSYN Fitness Tomas Morato',
    location: 'Tomas Morato Ave., Quezon City',
    address: 'Tomas Morato Ave., Quezon City',
    city: 'Quezon City',
    district: 'Quezon City',
    operating_hours: 'N/A',
    phone: '+63 2 8888 8888',
    status: 'Opening Soon (Pipeline)',
    is_active: false,
    is_flagship: false,
    features: ['Flagship Fit-Out Pending', 'State-of-the-art Equipment in Transit', 'VIP Concierge Suite']
  }
];

export const ACTIVE_BRANCHES = BRANCH_DIRECTORY.filter((b) => b.is_active);

export const DISTRICT_TABS = [
  'All Districts',
  'Makati / South Metro',
  'Quezon City',
  'Alabang / South Metro',
  'Pasig / Central Metro'
];

export function getBranchById(id) {
  if (!id) return null;
  // Map legacy IDs to new Makati flagship or respective branches
  if (id === 'b1000000-0000-0000-0000-000000000001' || id === 'b2000000-0000-0000-0000-000000000002') {
    return BRANCH_DIRECTORY[0];
  }
  return (
    BRANCH_DIRECTORY.find((b) => b.id === id || b.code === id || b.name.toLowerCase().includes(String(id).toLowerCase())) ||
    BRANCH_DIRECTORY[0]
  );
}

export default BRANCH_DIRECTORY;
