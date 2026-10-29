import re
from typing import Dict, Any

HOURLY_RATES = {
    "standard": 179,   # Base hourly rate in INR (₹179/hr)
    "premium": 229,    # Luxury / SUV hourly rate (₹229/hr)
    "outstation": 259, # Outstation highway rate (₹259/hr)
}

PLATFORM_FEE = 49
VEHICLE_INSURANCE_SAFETY_FEE = 39

def is_night_time(time_str: str) -> bool:
    """Determine if start time is late night (between 22:00 and 06:00)."""
    if not time_str:
        return False
    
    # Handle formats like '06:30 AM', '10:00 PM', or '22:15'
    clean = time_str.strip().upper()
    hour = 12
    
    # Check 12-hour AM/PM
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)?", clean)
    if match:
        h = int(match.group(1))
        meridiem = match.group(3)
        if meridiem == "PM" and h < 12:
            hour = h + 12
        elif meridiem == "AM" and h == 12:
            hour = 0
        else:
            hour = h
    else:
        # Fallback 24-hr parse
        try:
            hour = int(clean.split(":")[0])
        except Exception:
            hour = 12
            
    return hour >= 22 or hour < 6

def calculate_fare(duration_hours: int, vehicle_tier: str = "standard", start_time: str = "") -> Dict[str, Any]:
    """
    Authoritative server-side pricing calculation.
    Never trusts client-supplied fare totals.
    """
    duration = max(1, min(24, int(duration_hours)))
    tier = vehicle_tier.lower() if vehicle_tier.lower() in HOURLY_RATES else "standard"
    base_rate = HOURLY_RATES[tier]
    
    driver_wages = base_rate * duration
    
    # Duration discounts
    discount = 0
    if duration >= 8:
        discount = round(driver_wages * 0.12)
    elif duration >= 6:
        discount = round(driver_wages * 0.08)
        
    night_surge = 150 if is_night_time(start_time) else 0
    subtotal = driver_wages - discount + night_surge
    taxes = round(subtotal * 0.05) # 5% GST
    
    total_fare = subtotal + PLATFORM_FEE + VEHICLE_INSURANCE_SAFETY_FEE + taxes
    
    # Driver Payout: Base pilot compensation + night allowance
    driver_payout = max(0, driver_wages - discount + night_surge)
    
    return {
        "base_rate_per_hour": base_rate,
        "duration_hours": duration,
        "driver_wages": driver_wages,
        "discount": discount,
        "night_surge": night_surge,
        "platform_fee": PLATFORM_FEE,
        "insurance_fee": VEHICLE_INSURANCE_SAFETY_FEE,
        "taxes": taxes,
        "total_fare": round(total_fare),
        "driver_payout": round(driver_payout),
    }
