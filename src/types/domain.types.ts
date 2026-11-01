/**
 * Domain Types for FaciliAuto
 *
 * These types represent the Application Layer view of data,
 * effectively decoupling the app logic from the Database Schema (Prisma).
 * Use Mappers to convert Prisma types to these Domain types.
 */

import { Vehicle as PrismaVehicle } from '@prisma/client';

/**
 * Represents a Vehicle safely usable within the Application Logic.
 * Unlike PrismaVehicle, critical fields here are guaranteed (non-null),
 * or have explicit handling defined.
 */
export interface AppVehicle {
  id: string;
  marca: string;
  modelo: string;
  versao: string; // Garantido como string (vazio se null)
  ano: number;
  km: number;
  preco: number; // Garantido como number (0 se null)
  cor: string; // Garantido como string
  carroceria: string;
  combustivel: string;
  cambio: string;
  disponivel: boolean;
  fotoUrl: string | null;
  url: string | null;

  // Opcionais normalizados
  arCondicionado: boolean;
  direcaoHidraulica: boolean;
  vidroEletrico: boolean;
  travaEletrica: boolean;
  alarme: boolean;
  som: boolean;
}

/**
 * Mapper to convert raw Prisma vehicle to safe AppVehicle
 */
export function mapPrismaToAppVehicle(raw: PrismaVehicle): AppVehicle {
  return {
    ...raw,
    // Null safety defaults
    versao: raw.versao || '',
    preco: raw.preco !== null ? raw.preco : 0,
    cor: raw.cor || 'Não informada',
    // Ensure all optional fields map correctly if present in schema,
    // otherwise default to false/null based on known schema
    arCondicionado: raw.arCondicionado ?? false,
    direcaoHidraulica: raw.direcaoHidraulica ?? false,
    vidroEletrico: raw.vidroEletrico ?? false,
    travaEletrica: raw.travaEletrica ?? false,
    alarme: raw.alarme ?? false,
    som: raw.som ?? false,
  };
}

/**
 * Type guard to check if a vehicle has a valid price
 */
export function hasValidPrice(vehicle: AppVehicle): boolean {
  return vehicle.preco > 0;
}
