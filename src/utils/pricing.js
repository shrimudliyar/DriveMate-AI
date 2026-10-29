/**
 * Fictional fare calculation utility for DriveMate AI customer driver bookings.
 */

export const HOURLY_RATES = {
  standard: 179, // Base hourly rate in INR (₹179/hr)
  premium: 229,  // Luxury/SUV hourly rate in INR (₹229/hr)
  outstation: 259, // Outstation rate in INR (₹259/hr)
};

export const PLATFORM_FEE = 49;
export const VEHICLE_INSURANCE_SAFETY_FEE = 39;

export function calculateFare({ durationHours = 2, vehicleTier = 'standard', isNight = false }) {
  const baseRatePerHour = HOURLY_RATES[vehicleTier] || HOURLY_RATES.standard;
  const driverWages = baseRatePerHour * durationHours;
  
  // Apply a 10% discount for bookings over 6 hours (loyalty package)
  const discount = durationHours >= 8 ? Math.round(driverWages * 0.12) : durationHours >= 6 ? Math.round(driverWages * 0.08) : 0;
  
  const nightSurge = isNight ? 150 : 0;
  const subtotal = driverWages - discount + nightSurge;
  const taxes = Math.round(subtotal * 0.05); // 5% GST
  const total = subtotal + PLATFORM_FEE + VEHICLE_INSURANCE_SAFETY_FEE + taxes;

  return {
    baseRatePerHour,
    durationHours,
    driverWages,
    discount,
    nightSurge,
    platformFee: PLATFORM_FEE,
    insuranceFee: VEHICLE_INSURANCE_SAFETY_FEE,
    taxes,
    total: Math.max(0, total),
  };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
