import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Calendar, 
  Clock, 
  Hourglass, 
  Car, 
  ShieldCheck, 
  ArrowRight, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import FareEstimator from './FareEstimator';
import { calculateFare } from '../../utils/pricing';
import { useBookings } from '../../context/BookingContext';

export default function BookingForm({ initialValues, onBookingSuccess, savedVehicles = [] }) {
  const { createBooking } = useBookings();
  const [formData, setFormData] = useState({
    pickup: '',
    destination: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 3,
    vehicleTier: 'standard',
    vehicleId: savedVehicles[0]?.id || '',
    tripNotes: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);

  useEffect(() => {
    if (initialValues) {
      setFormData(prev => ({
        ...prev,
        ...initialValues,
      }));
    }
  }, [initialValues]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'duration' ? Number(value) : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSimulateGPS = () => {
    setLocationDetecting(true);
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        pickup: 'Current Location (Koramangala 4th Block, 80ft Road)',
      }));
      setLocationDetecting(false);
      if (errors.pickup) {
        setErrors(prev => ({ ...prev, pickup: null }));
      }
    }, 600);
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.pickup.trim()) newErrors.pickup = 'Please provide a pickup location';
    if (!formData.destination.trim()) newErrors.destination = 'Please provide a destination or route';
    if (!formData.date) newErrors.date = 'Booking date is required';
    if (!formData.time) newErrors.time = 'Start time is required';
    if (!formData.duration || formData.duration < 1) newErrors.duration = 'Duration must be at least 1 hour';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    const isNightTime = (() => {
      const hour = parseInt(formData.time.split(':')[0], 10);
      return hour >= 22 || hour < 6;
    })();

    const fareObj = calculateFare({
      durationHours: formData.duration,
      vehicleTier: formData.vehicleTier,
      isNight: isNightTime,
    });

    const selectedCar = savedVehicles.find(v => v.id === formData.vehicleId);

    try {
      // Create new booking with status 'pending' (calls backend API with local fallback)
      const newBooking = await createBooking({
        pickup: formData.pickup,
        destination: formData.destination,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        vehicleTier: formData.vehicleTier,
        vehicleName: selectedCar ? `${selectedCar.make} ${selectedCar.model} (${selectedCar.regNumber})` : 'Personal Vehicle',
        estimatedFare: fareObj.total,
        tripNotes: formData.tripNotes || '',
      });

      setIsSubmitting(false);
      if (onBookingSuccess) {
        onBookingSuccess(newBooking);
      }
    } catch (err) {
      console.error('Failed to create booking:', err);
      setIsSubmitting(false);
    }
  };

  const isNightHour = (() => {
    if (!formData.time) return false;
    const hour = parseInt(formData.time.split(':')[0], 10);
    return hour >= 22 || hour < 6;
  })();

  const durationOptions = [
    { label: '2 Hours (Local Errand)', value: 2 },
    { label: '3 Hours (Airport / City transit)', value: 3 },
    { label: '4 Hours (Half Day Meetings)', value: 4 },
    { label: '6 Hours (Multi-stop Shopping)', value: 6 },
    { label: '8 Hours (Full Working Day)', value: 8 },
    { label: '12 Hours (Outstation / Full Day)', value: 12 },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pickup Location */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="pickup" className="block text-xs font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300">
              Pickup Location <span className="text-brand-navy dark:text-brand-sky">*</span>
            </label>
            <button
              type="button"
              onClick={handleSimulateGPS}
              disabled={locationDetecting}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-navy hover:text-brand-navy-hover dark:text-brand-sky dark:hover:underline transition-colors focus:outline-none"
            >
              {locationDetecting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Locating...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3 h-3" />
                  <span>Use current location</span>
                </>
              )}
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-navy dark:text-brand-sky">
              <MapPin className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="pickup"
              name="pickup"
              value={formData.pickup}
              onChange={handleChange}
              placeholder="e.g., Home, Office, or Apartment address"
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm dm-input ${
                errors.pickup ? 'border-rose-500 ring-1 ring-rose-500' : ''
              }`}
            />
          </div>
          {errors.pickup && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.pickup}
            </p>
          )}
        </div>

        {/* Destination Location */}
        <div>
          <label htmlFor="destination" className="block text-xs font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 mb-2">
            Destination / Route <span className="text-brand-navy dark:text-brand-sky">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600 dark:text-emerald-400">
              <Navigation className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="destination"
              name="destination"
              value={formData.destination}
              onChange={handleChange}
              placeholder="e.g., Airport, Whitefield, or Multiple stops"
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm dm-input ${
                errors.destination ? 'border-rose-500 ring-1 ring-rose-500' : ''
              }`}
            />
          </div>
          {errors.destination && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.destination}
            </p>
          )}
        </div>
      </div>

      {/* Date, Time, Duration Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Booking Date */}
        <div>
          <label htmlFor="date" className="block text-xs font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 mb-2">
            Booking Date <span className="text-brand-navy dark:text-brand-sky">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-navy dark:text-brand-sky">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm dm-input ${
                errors.date ? 'border-rose-500 ring-1 ring-rose-500' : ''
              }`}
            />
          </div>
          {errors.date && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.date}
            </p>
          )}
        </div>

        {/* Start Time */}
        <div>
          <label htmlFor="time" className="block text-xs font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 mb-2">
            Start Time <span className="text-brand-navy dark:text-brand-sky">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-navy dark:text-brand-sky">
              <Clock className="w-4 h-4" />
            </div>
            <input
              type="time"
              id="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm dm-input ${
                errors.time ? 'border-rose-500 ring-1 ring-rose-500' : ''
              }`}
            />
          </div>
          {errors.time && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.time}
            </p>
          )}
        </div>

        {/* Duration Selector */}
        <div>
          <label htmlFor="duration" className="block text-xs font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 mb-2">
            Duration (Hours) <span className="text-brand-navy dark:text-brand-sky">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-navy dark:text-brand-sky">
              <Hourglass className="w-4 h-4" />
            </div>
            <select
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm dm-input cursor-pointer"
            >
              {durationOptions.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-white dark:bg-brand-navy text-brand-dark dark:text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Your Vehicle Selection */}
      <div className="rounded-xl p-4 bg-brand-grey-subtle dark:bg-brand-navy-dark/60 border border-slate-200 dark:border-brand-navy-border">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 flex items-center gap-2">
            <Car className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
            <span>Select Your Personal Vehicle</span>
          </label>
          <span className="text-[11px] text-brand-muted dark:text-slate-400">Driver will operate your designated car</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {savedVehicles.map(vehicle => (
            <button
              key={vehicle.id}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, vehicleId: vehicle.id }))}
              className={`p-3.5 rounded-xl text-left border transition-all ${
                formData.vehicleId === vehicle.id
                  ? 'bg-brand-sky-light dark:bg-brand-navy border-brand-navy dark:border-brand-sky shadow-xs'
                  : 'bg-white dark:bg-brand-navy-dark border-slate-200 dark:border-brand-navy-border text-brand-muted hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-brand-dark dark:text-white">
                  {vehicle.make} {vehicle.model}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-sky text-brand-navy">
                  {vehicle.type}
                </span>
              </div>
              <p className="text-xs text-brand-muted dark:text-slate-400 mt-1 font-mono">{vehicle.regNumber}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Estimated Fare Section */}
      <FareEstimator
        durationHours={formData.duration}
        vehicleTier={formData.vehicleTier}
        isNight={isNightHour}
      />

      {/* Trust & Guarantee note */}
      <div className="flex items-center gap-2 text-xs text-brand-muted dark:text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>Includes ₹10L insurance guarantee & verified background check. Broadcasts to nearby pilots instantly.</span>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all duration-200 shadow-md flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-brand-sky/40 cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Broadcasting to Available Verified Pilots...</span>
          </>
        ) : (
          <>
            <span>Confirm & Request Driver</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </>
        )}
      </button>
    </form>
  );
}
