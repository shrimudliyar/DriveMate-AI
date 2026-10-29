export const INITIAL_USER = {
  name: 'Alex Morgan',
  phone: '+91 98765 43210',
  email: 'alex.morgan@drivemate.ai',
  rating: 4.95,
  totalTrips: 18,
  savedVehicles: [
    { id: 'v1', make: 'Honda', model: 'City ZX (Automatic)', regNumber: 'KA 03 MM 4821', type: 'Sedan' },
    { id: 'v2', make: 'Tata', model: 'Nexon EV Empowered', regNumber: 'KA 05 NB 9012', type: 'Electric SUV' },
  ],
};

export const INITIAL_DRIVER = {
  id: 'DRV-1042',
  name: 'Vikramaditya S.',
  phone: '+91 99000 88221',
  email: 'vikram.s@pilot.drivemate.ai',
  rating: 4.96,
  totalTrips: 1424,
  badge: 'Certified Gold Pilot',
  verificationStatus: 'Police & Background Verified',
  licenseNumber: 'KA-05-2016-008921',
  experienceYears: 8,
  specializations: [
    'Luxury Sedans & SUVs',
    'Automatic & EV Transmissions',
    'Highway & Outstation Qualified',
    'Defensive Driving Certified'
  ],
  languages: ['English', 'Kannada', 'Hindi'],
  joinedDate: 'March 2023',
};

export const INITIAL_BOOKINGS = [
  {
    id: 'DM-98214',
    customerName: 'Alex Morgan',
    customerPhone: '+91 98765 43210',
    pickup: 'Indiranagar 100ft Road, Bengaluru',
    destination: 'Kempegowda International Airport (Terminal 2)',
    date: '2026-10-26',
    time: '06:30 AM',
    duration: 3,
    vehicleTier: 'standard',
    vehicleName: 'Honda City ZX (KA 03 MM 4821)',
    estimatedFare: 625,
    driverPayout: 510,
    status: 'pending', // 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected' | 'cancelled'
    driver: null,
    tripNotes: 'Airport drop. Driver will park customer car in premium parking if needed.',
    createdAt: '2026-10-25T14:30:00Z',
  },
  {
    id: 'DM-94108',
    customerName: 'Priya Sharma',
    customerPhone: '+91 98450 12345',
    pickup: 'Koramangala 4th Block, Bengaluru',
    destination: 'UB City & Lavelle Road (Multiple client meetings)',
    date: '2026-10-26',
    time: '11:00 AM',
    duration: 4,
    vehicleTier: 'standard',
    vehicleName: 'Hyundai Creta SX (KA 01 MJ 3399)',
    estimatedFare: 840,
    driverPayout: 690,
    status: 'accepted',
    driver: {
      id: 'DRV-1042',
      name: 'Vikramaditya S.',
      rating: 4.96,
      trips: 1424,
      phone: '+91 99000 88221',
      badge: 'Certified Gold Pilot',
    },
    tripNotes: 'Executive city transit. Wait at UB City parking between client sessions.',
    createdAt: '2026-10-25T12:15:00Z',
  },
  {
    id: 'DM-89102',
    customerName: 'Alex Morgan',
    customerPhone: '+91 98765 43210',
    pickup: 'Lavelle Road, Bengaluru',
    destination: 'Whitefield IT Park (Multiple client stops)',
    date: '2026-10-24',
    time: '09:00 AM',
    duration: 8,
    vehicleTier: 'standard',
    vehicleName: 'Honda City ZX (KA 03 MM 4821)',
    estimatedFare: 1480,
    driverPayout: 1220,
    status: 'completed',
    driver: {
      id: 'DRV-1042',
      name: 'Vikramaditya S.',
      rating: 4.96,
      trips: 1424,
      phone: '+91 99000 88221',
      badge: 'Certified Gold Pilot',
    },
    tripNotes: 'Full-day corporate meetings round-trip.',
    createdAt: '2026-10-24T08:00:00Z',
  },
];

export const VOICE_EXAMPLE_PROMPTS = [
  {
    text: 'Drive me to Bangalore Airport tomorrow at 6:30 AM for 3 hours',
    pickup: 'Indiranagar 100ft Road, Bengaluru',
    destination: 'Kempegowda International Airport (Terminal 2)',
    duration: 3,
    time: '06:30',
  },
  {
    text: 'Need a driver for 4 hours to Koramangala & MG Road meetings',
    pickup: 'HSR Layout Sector 2, Bengaluru',
    destination: 'MG Road Metro Station / Koramangala 5th Block',
    duration: 4,
    time: '11:00',
  },
  {
    text: 'Late night dinner pickup tonight at 11:15 PM from Indiranagar',
    pickup: 'Toit Brewpub, 100ft Road, Indiranagar',
    destination: 'Sobha Forestview, Kanakapura Road',
    duration: 2,
    time: '23:15',
  },
];

export const SAFETY_HIGHLIGHTS = [
  {
    id: 'bg-verify',
    title: '100% Police & Background Verified',
    description: 'Every DriveMate driver undergoes rigorous 7-point criminal, identity, and residential background screening.',
    icon: 'ShieldCheck',
  },
  {
    id: 'insurance',
    title: 'Complementary Vehicle Protection',
    description: 'Up to ₹10 Lakhs additional vehicle coverage while our certified professional pilot is behind the wheel.',
    icon: 'CarFront',
  },
  {
    id: 'gps',
    title: 'Live Journey & SOS Supervision',
    description: 'Central safety control room monitors your trip telemetry with immediate emergency escalation assistance.',
    icon: 'RadioTower',
  },
  {
    id: 'inspection',
    title: 'Digital Pre & Post Vehicle Inspection',
    description: 'Timestamped odometer, fuel, and body condition checklist recorded directly in app before keys exchange.',
    icon: 'ClipboardCheck',
  },
];
