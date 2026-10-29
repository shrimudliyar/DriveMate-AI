/**
 * DriveMate AI — API Client Layer
 * Connects the frontend to the FastAPI backend with Bearer token authentication and graceful fallback.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

let currentAuthToken = null;
let authErrorCallback = null;

export function setApiAuthToken(token) {
  currentAuthToken = token;
}

export function onApiAuthError(callback) {
  authErrorCallback = callback;
}

export function normalizeBooking(b) {
  if (!b) return b;
  return {
    ...b,
    id: b.id,
    customerName: b.customer_name ?? b.customerName ?? 'Alex Morgan',
    customerPhone: b.customer_phone ?? b.customerPhone ?? '+91 98765 43210',
    vehicleTier: b.vehicle_tier ?? b.vehicleTier ?? 'standard',
    vehicleName: b.vehicle_name ?? b.vehicleName ?? 'Customer Vehicle',
    estimatedFare: b.estimated_fare !== undefined ? b.estimated_fare : b.estimatedFare,
    driverPayout: b.driver_payout !== undefined ? b.driver_payout : b.driverPayout,
    tripNotes: b.trip_notes !== undefined ? b.trip_notes : (b.tripNotes || ''),
    rejectionReason: b.rejection_reason !== undefined ? b.rejection_reason : b.rejectionReason,
    createdAt: b.created_at ?? b.createdAt,
    acceptedAt: b.accepted_at ?? b.acceptedAt,
    startedAt: b.started_at ?? b.startedAt,
    completedAt: b.completed_at ?? b.completedAt,
    cancelledAt: b.cancelled_at ?? b.cancelledAt,
  };
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(currentAuthToken ? { Authorization: `Bearer ${currentAuthToken}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'API Request Failed';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || errorDetail;
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    const err = new Error(errorDetail);
    err.status = response.status;
    
    // Notify auth error listener for 401 Unauthorized or 403 Forbidden if user was authenticated
    if ((err.status === 401 || err.status === 403) && typeof authErrorCallback === 'function' && currentAuthToken) {
      authErrorCallback(err);
    }
    throw err;
  }

  return response.json();
}

export const api = {
  // Health probe
  checkHealth: async () => {
    return request('/health');
  },

  // Bookings CRUD & Transitions
  getBookings: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.customerId) query.append('customer_id', params.customerId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const data = await request(`/bookings${qs}`);
    return Array.isArray(data) ? data.map(normalizeBooking) : data;
  },

  getPendingBookings: async () => {
    const data = await request('/bookings/pending');
    return Array.isArray(data) ? data.map(normalizeBooking) : data;
  },

  getBookingById: async (id) => {
    const data = await request(`/bookings/${id}`);
    return normalizeBooking(data);
  },

  createBooking: async (bookingData) => {
    const payload = {
      customer_id: bookingData.customerId || 'cust_alex_morgan_01',
      customer_name: bookingData.customerName || 'Alex Morgan',
      customer_phone: bookingData.customerPhone || '+91 98765 43210',
      pickup: bookingData.pickup,
      destination: bookingData.destination,
      date: bookingData.date,
      time: bookingData.time,
      duration: bookingData.duration,
      vehicle_tier: bookingData.vehicleTier || 'standard',
      vehicle_name: bookingData.vehicleName || 'Personal Vehicle',
      trip_notes: bookingData.tripNotes || '',
    };
    const data = await request('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeBooking(data);
  },

  acceptBooking: async (id, driverId = 'DRV-1042') => {
    const data = await request(`/bookings/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ driver_id: driverId }),
    });
    return normalizeBooking(data);
  },

  rejectBooking: async (id, reason = 'Slot schedule conflict', driverId = 'DRV-1042') => {
    const data = await request(`/bookings/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, driver_id: driverId }),
    });
    return normalizeBooking(data);
  },

  startTrip: async (id) => {
    const data = await request(`/bookings/${id}/start`, {
      method: 'POST',
    });
    return normalizeBooking(data);
  },

  completeTrip: async (id) => {
    const data = await request(`/bookings/${id}/complete`, {
      method: 'POST',
    });
    return normalizeBooking(data);
  },

  cancelBooking: async (id, reason = 'Cancelled by user') => {
    const data = await request(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return normalizeBooking(data);
  },

  // Driver Profile & Online State
  getDriverProfile: async (driverId = 'DRV-1042') => {
    return request(`/drivers/${driverId}/profile`);
  },

  getDriverMetrics: async (driverId = 'DRV-1042') => {
    return request(`/drivers/${driverId}/metrics`);
  },

  setDriverStatus: async (driverId = 'DRV-1042', isOnline = true) => {
    return request(`/drivers/${driverId}/status`, {
      method: 'POST',
      body: JSON.stringify({ is_online: isOnline }),
    });
  },

  // Voice Assistant (Phase 3: Gnani AI STT & TTS Integration)
  getVoiceStatus: async () => {
    return request('/voice/status');
  },

  transcribeAudio: async (audioBlob, languageCode = 'en-IN') => {
    // Convert audio Blob to base64 for reliable JSON transport
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result;
          const data = await request(`/voice/stt?language_code=${encodeURIComponent(languageCode)}`, {
            method: 'POST',
            body: JSON.stringify({
              audio_base64: base64Data,
              content_type: audioBlob.type || 'audio/webm',
              language_code: languageCode,
            }),
          });
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (e) => reject(new Error('Failed to read recorded audio data.'));
      reader.readAsDataURL(audioBlob);
    });
  },

  sendVoiceChat: async ({ message, confirmAction = false, pendingAction = null }) => {
    return request('/voice/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        confirm_action: confirmAction,
        pending_action: pendingAction,
      }),
    });
  },

  synthesizeSpeech: async ({ text, voice = 'Nalini', languageCode = 'en-IN', speed = 1.0 }) => {
    const url = `${API_BASE_URL}/voice/tts`;
    const headers = {
      'Content-Type': 'application/json',
      ...(currentAuthToken ? { Authorization: `Bearer ${currentAuthToken}` } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text,
        voice,
        language_code: languageCode,
        speed,
      }),
    });

    if (!response.ok) {
      let errDetail = 'Failed to synthesize speech';
      try {
        const errJson = await response.json();
        errDetail = errJson.detail || errDetail;
      } catch {
        errDetail = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errDetail);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },
};
