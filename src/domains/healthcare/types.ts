/**
 * Healthcare Domain Types
 *
 * Types specific to the healthcare/clinic scheduling domain.
 */

// ── Patient Profile ──

export interface HealthcareProfile {
  name?: string;
  symptoms?: string[];
  preferredSpecialty?: string;
  urgencyLevel?: 'low' | 'medium' | 'high' | 'emergency';
  preferredDate?: string;
  insuranceProvider?: string;
}

// ── Appointment Slot ──

export interface AppointmentSlot {
  id: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  location: string;
  duration: number; // minutes
}

// ── Domain Data (stored in state.domainData) ──

export interface HealthcareDomainData {
  selectedSlot?: AppointmentSlot;
  triageResult?: {
    suggestedSpecialty: string;
    confidence: number;
    reasoning: string;
  };
  appointmentConfirmed?: boolean;
  availableSlots?: AppointmentSlot[];
}
