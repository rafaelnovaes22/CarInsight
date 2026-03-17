/**
 * Healthcare Search Adapter
 *
 * Implements ISearchAdapter with mock data for proof of concept.
 * Future: replace with Prisma models (Professional, Service, Appointment).
 */

import type { ISearchAdapter, GenericRecommendation } from '../../core/types';
import type { AppointmentSlot } from './types';
import type { Specialty } from './config';

// ── Mock Professionals ──

interface MockProfessional {
  id: string;
  name: string;
  specialty: Specialty;
  location: string;
  slots: Omit<AppointmentSlot, 'id' | 'doctorName' | 'specialty' | 'location'>[];
}

const MOCK_PROFESSIONALS: MockProfessional[] = [
  {
    id: 'doc-001',
    name: 'Dra. Ana Silva',
    specialty: 'clinico_geral',
    location: 'Clinica Central — Sala 101',
    slots: [
      { date: '2026-03-20', time: '09:00', duration: 30 },
      { date: '2026-03-20', time: '10:00', duration: 30 },
      { date: '2026-03-21', time: '14:00', duration: 30 },
    ],
  },
  {
    id: 'doc-002',
    name: 'Dr. Carlos Mendes',
    specialty: 'cardiologia',
    location: 'Clinica Central — Sala 205',
    slots: [
      { date: '2026-03-20', time: '11:00', duration: 45 },
      { date: '2026-03-22', time: '09:00', duration: 45 },
    ],
  },
  {
    id: 'doc-003',
    name: 'Dra. Beatriz Costa',
    specialty: 'dermatologia',
    location: 'Clinica Central — Sala 302',
    slots: [
      { date: '2026-03-21', time: '08:00', duration: 30 },
      { date: '2026-03-21', time: '09:00', duration: 30 },
    ],
  },
  {
    id: 'doc-004',
    name: 'Dr. Eduardo Lima',
    specialty: 'ortopedia',
    location: 'Clinica Central — Sala 410',
    slots: [
      { date: '2026-03-20', time: '15:00', duration: 40 },
      { date: '2026-03-23', time: '10:00', duration: 40 },
    ],
  },
  {
    id: 'doc-005',
    name: 'Dra. Fernanda Oliveira',
    specialty: 'neurologia',
    location: 'Clinica Central — Sala 508',
    slots: [
      { date: '2026-03-22', time: '14:00', duration: 45 },
      { date: '2026-03-24', time: '09:00', duration: 45 },
    ],
  },
  {
    id: 'doc-006',
    name: 'Dr. Ricardo Santos',
    specialty: 'psiquiatria',
    location: 'Clinica Central — Sala 605',
    slots: [
      { date: '2026-03-21', time: '16:00', duration: 50 },
      { date: '2026-03-23', time: '11:00', duration: 50 },
    ],
  },
  {
    id: 'doc-007',
    name: 'Dra. Juliana Rocha',
    specialty: 'ginecologia',
    location: 'Clinica Central — Sala 203',
    slots: [
      { date: '2026-03-20', time: '13:00', duration: 30 },
      { date: '2026-03-22', time: '10:00', duration: 30 },
    ],
  },
  {
    id: 'doc-008',
    name: 'Dr. Marcelo Vieira',
    specialty: 'pediatria',
    location: 'Clinica Central — Sala 104',
    slots: [
      { date: '2026-03-21', time: '10:00', duration: 30 },
      { date: '2026-03-23', time: '14:00', duration: 30 },
    ],
  },
  {
    id: 'doc-009',
    name: 'Dr. Paulo Ferreira',
    specialty: 'oftalmologia',
    location: 'Clinica Central — Sala 706',
    slots: [
      { date: '2026-03-24', time: '08:00', duration: 30 },
      { date: '2026-03-24', time: '11:00', duration: 30 },
    ],
  },
  {
    id: 'doc-010',
    name: 'Dr. Gustavo Almeida',
    specialty: 'urologia',
    location: 'Clinica Central — Sala 407',
    slots: [
      { date: '2026-03-22', time: '15:00', duration: 40 },
      { date: '2026-03-25', time: '09:00', duration: 40 },
    ],
  },
];

// ── Helper: Build slots from professional ──

function buildSlots(prof: MockProfessional): AppointmentSlot[] {
  return prof.slots.map((s, i) => ({
    id: `${prof.id}-slot-${i}`,
    doctorName: prof.name,
    specialty: prof.specialty,
    location: prof.location,
    ...s,
  }));
}

// ── Search Adapter ──

export const healthcareSearchAdapter: ISearchAdapter = {
  async search(query: string, filters: Record<string, unknown>): Promise<GenericRecommendation[]> {
    const specialty = (filters.specialty as string) || query;

    const matching = MOCK_PROFESSIONALS.filter(p => {
      if (specialty && p.specialty === specialty) return true;
      if (query && p.name.toLowerCase().includes(query.toLowerCase())) return true;
      if (query && p.specialty.includes(query.toLowerCase())) return true;
      return false;
    });

    // If no match, return all with clinico_geral as fallback
    const results =
      matching.length > 0
        ? matching
        : MOCK_PROFESSIONALS.filter(p => p.specialty === 'clinico_geral');

    return results.map(prof => {
      const slots = buildSlots(prof);
      return {
        itemId: prof.id,
        matchScore: specialty === prof.specialty ? 1.0 : 0.5,
        reasoning: `${prof.name} — ${prof.specialty}`,
        highlights: slots.map(s => `${s.date} as ${s.time}`),
        concerns: [],
        item: {
          name: prof.name,
          specialty: prof.specialty,
          location: prof.location,
          slots,
        },
      };
    });
  },

  async getById(id: string): Promise<Record<string, unknown> | null> {
    const prof = MOCK_PROFESSIONALS.find(p => p.id === id);
    if (!prof) return null;
    return {
      id: prof.id,
      name: prof.name,
      specialty: prof.specialty,
      location: prof.location,
      slots: buildSlots(prof),
    };
  },
};
