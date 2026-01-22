import { Vehicle } from '@prisma/client';

export interface VehicleClassification {
  aptoUber: boolean;
  aptoUberBlack: boolean;
  aptoFamilia: boolean;
  aptoCarga: boolean;
  aptoUsoDiario: boolean;
  aptoEntrega: boolean;
  economiaCombustivel: 'alta' | 'media' | 'baixa';
}

// Normalização de strings
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// --- UBER RULES CONSTANTS ---
const UBER_X_MODELS: Record<string, string[]> = {
  honda: ['civic', 'city', 'fit'],
  toyota: ['corolla', 'etios', 'yaris'],
  chevrolet: ['onix', 'prisma', 'cruze', 'cobalt'],
  volkswagen: ['gol', 'voyage', 'polo', 'virtus', 'jetta', 'fox'],
  fiat: ['argo', 'cronos', 'siena', 'grand siena', 'palio', 'uno', 'mobi'],
  ford: ['ka', 'fiesta'],
  hyundai: ['hb20', 'hb20s', 'accent', 'elantra'],
  nissan: ['march', 'versa', 'sentra'],
  renault: ['logan', 'sandero', 'kwid'],
  peugeot: ['208', '2008'],
  citroen: ['c3', 'c4', 'citroen'],
};

const UBER_BLACK_MODELS: Record<string, string[]> = {
  honda: ['civic'],
  toyota: ['corolla'],
  chevrolet: ['cruze'],
  volkswagen: ['jetta', 'passat'],
  nissan: ['sentra'],
};

const UBER_NEVER_ALLOWED_TYPES = ['suv', 'pickup', 'picape', 'minivan', 'van', 'furgão', 'furgao'];

export class VehicleClassifierService {
  static classify(vehicle: Vehicle): VehicleClassification {
    const carroceriaNorm = normalizeString(vehicle.carroceria);

    // 1. Economia de Combustível (Regra original)
    let economiaCombustivel: 'alta' | 'media' | 'baixa' = 'media';
    if (carroceriaNorm.includes('hatch') || vehicle.km < 50000) {
      economiaCombustivel = 'alta';
    } else if (
      carroceriaNorm.includes('suv') ||
      carroceriaNorm.includes('picape') ||
      carroceriaNorm.includes('pickup') ||
      vehicle.km > 150000
    ) {
      economiaCombustivel = 'baixa';
    }

    // 2. Classificação UBER (Preservando lógica existente)
    const isNeverAllowedUber = UBER_NEVER_ALLOWED_TYPES.some(t => carroceriaNorm.includes(t));

    const isUberX =
      !isNeverAllowedUber &&
      vehicle.ano >= 2012 &&
      vehicle.arCondicionado === true &&
      vehicle.portas >= 4 &&
      this.isModelInWhitelist(vehicle.marca, vehicle.modelo, UBER_X_MODELS);

    const isUberBlack =
      !isNeverAllowedUber &&
      vehicle.ano >= 2018 &&
      vehicle.arCondicionado === true &&
      vehicle.portas === 4 &&
      carroceriaNorm.includes('sedan') &&
      this.isModelInWhitelist(vehicle.marca, vehicle.modelo, UBER_BLACK_MODELS);

    // 3. Classificação FAMÍLIA (Nova lógica estrita)
    // Regra: 4 portas + (SUV, Sedan, Minivan, Perua)
    const isFamilyBodyType =
      carroceriaNorm.includes('suv') ||
      carroceriaNorm.includes('sedan') ||
      carroceriaNorm.includes('seda') ||
      carroceriaNorm.includes('minivan') ||
      carroceriaNorm.includes('van') ||
      carroceriaNorm.includes('perua') ||
      carroceriaNorm.includes('station wagon');

    const aptoFamilia = vehicle.portas >= 4 && isFamilyBodyType;

    // 4. Classificação CARGA / TRABALHO PESADO
    // Regra: Picape, Van, Furgão
    const isUtilityBodyType =
      carroceriaNorm.includes('picape') ||
      carroceriaNorm.includes('pickup') ||
      carroceriaNorm.includes('van') ||
      carroceriaNorm.includes('furgao') ||
      carroceriaNorm.includes('furgão') ||
      carroceriaNorm.includes('caminhonete');

    const aptoCarga = isUtilityBodyType;

    // 5. Classificação USO DIÁRIO / COMMUTE
    // Regra: Econômico (Alta ou Média) + Ar Condicionado
    // Exclui utilitários pesados se beberem muito (geralmente caem em 'baixa' economia)
    const aptoUsoDiario =
      vehicle.arCondicionado === true &&
      (economiaCombustivel === 'alta' || economiaCombustivel === 'media') &&
      !aptoCarga; // Geralmente quem quer "dia a dia" não quer uma S10 diesel, mas uma Strada cabine simples pode entrar?
    // A regra de economia já filtra picapes grandes. Strada 1.4 pode ser 'media'.
    // Vou deixar !aptoCarga opcional? O usuário pediu "separar".
    // Se eu tirar !aptoCarga, uma Strada 1.4 Working com Ar (boa pra dia a dia de trabalho leve) entra.
    // Vou manter sem a exclusão explícita de carga, a economia já dita. O usuário disse "uma coisa é ir ao trabalho... outra é usar COMO parte do trabalho".
    // Se aptoCarga é True, é ferramenta. Se aptoUsoDiario é True, é deslocamento.
    // Vou deixar flags independentes.

    // 6. Classificação ENTREGA (Apps: Mercado Livre, Lalamove, Uber Flash)
    // Regra: Ano >= 2010 (aceitação geral), qualquer carroceria praticamente
    const aptoEntrega =
      vehicle.ano >= 2010 &&
      vehicle.portas >= 2 && // Aceitam 2 portas para entrega as vezes, mas vamos priorizar carros funcionais
      (isFamilyBodyType || isUtilityBodyType || carroceriaNorm.includes('hatch'));

    return {
      aptoUber: isUberX,
      aptoUberBlack: isUberBlack,
      aptoFamilia,
      aptoCarga,
      aptoUsoDiario,
      aptoEntrega,
      economiaCombustivel,
    };
  }

  private static isModelInWhitelist(
    marca: string,
    modelo: string,
    whitelist: Record<string, string[]>
  ): boolean {
    const marcaNorm = normalizeString(marca);
    const modeloNorm = normalizeString(modelo);

    if (!whitelist[marcaNorm]) return false;

    return whitelist[marcaNorm].some(
      (allowedModel: string) =>
        modeloNorm.includes(allowedModel) || allowedModel.includes(modeloNorm)
    );
  }
}
