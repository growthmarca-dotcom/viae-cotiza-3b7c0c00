/**
 * Catálogo geográfico operativo (v1.4).
 *
 * Jerarquía: País → Provincia / Estado / Región → Ciudad / Localidad → Zona
 * turística. Hoy vive en código (sin dependencia de red ni migraciones) pero
 * la forma de los datos es la misma que tendrá la futura tabla del catálogo,
 * así que migrarlo a base más adelante no cambia la interfaz de consumo.
 *
 * Primera implementación: Argentina. Los demás países quedan declarados con su
 * estructura vacía para que la arquitectura ya los contemple.
 */

export type GeoCity = {
  name: string;
  /** Zonas turísticas asociadas a la ciudad. */
  zones?: string[];
};

export type GeoRegion = {
  name: string;
  cities: GeoCity[];
};

export type GeoCountry = {
  code: string;
  name: string;
  /** Etiqueta local del segundo nivel: provincia, estado, región... */
  regionLabel: string;
  regions: GeoRegion[];
};

const ARGENTINA: GeoCountry = {
  code: "AR",
  name: "Argentina",
  regionLabel: "Provincia",
  regions: [
    {
      name: "Neuquén",
      cities: [
        { name: "Neuquén Capital", zones: ["Alto Valle"] },
        { name: "San Martín de los Andes", zones: ["Lagos del Sur", "Cerro Chapelco"] },
        { name: "Villa La Angostura", zones: ["Lagos del Sur"] },
        { name: "Junín de los Andes", zones: ["Lagos del Sur"] },
        { name: "Villa Pehuenia", zones: ["Pehuenia"] },
        { name: "Caviahue", zones: ["Caviahue - Copahue"] },
        { name: "Aeropuerto Chapelco", zones: ["Aeropuertos regionales"] },
        { name: "Aeropuerto Neuquén", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "Río Negro",
      cities: [
        { name: "San Carlos de Bariloche", zones: ["Lagos del Sur", "Cerro Catedral"] },
        { name: "El Bolsón", zones: ["Comarca Andina"] },
        { name: "Las Grutas", zones: ["Costa Atlántica patagónica"] },
        { name: "Aeropuerto Bariloche", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "Chubut",
      cities: [
        { name: "Puerto Madryn", zones: ["Península Valdés"] },
        { name: "Esquel", zones: ["Corredor de los Alerces"] },
        { name: "Trelew", zones: ["Valle del Chubut"] },
      ],
    },
    {
      name: "Santa Cruz",
      cities: [
        { name: "El Calafate", zones: ["Glaciares"] },
        { name: "El Chaltén", zones: ["Glaciares"] },
        { name: "Río Gallegos", zones: ["Patagonia austral"] },
      ],
    },
    {
      name: "Tierra del Fuego",
      cities: [{ name: "Ushuaia", zones: ["Fin del Mundo"] }],
    },
    {
      name: "Buenos Aires",
      cities: [
        { name: "Mar del Plata", zones: ["Costa Atlántica"] },
        { name: "Pinamar", zones: ["Costa Atlántica"] },
        { name: "Tigre", zones: ["Delta"] },
        { name: "Aeropuerto Ezeiza", zones: ["Aeropuertos internacionales"] },
        { name: "Aeroparque Jorge Newbery", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "Ciudad Autónoma de Buenos Aires",
      cities: [{ name: "Buenos Aires", zones: ["Ciudad de Buenos Aires"] }],
    },
    {
      name: "Mendoza",
      cities: [
        { name: "Mendoza Capital", zones: ["Cuyo", "Ruta del vino"] },
        { name: "Las Leñas", zones: ["Alta montaña"] },
        { name: "San Rafael", zones: ["Cuyo"] },
      ],
    },
    {
      name: "Córdoba",
      cities: [
        { name: "Córdoba Capital", zones: ["Sierras de Córdoba"] },
        { name: "Villa Carlos Paz", zones: ["Sierras de Córdoba"] },
        { name: "Mina Clavero", zones: ["Traslasierra"] },
      ],
    },
    {
      name: "Salta",
      cities: [
        { name: "Salta Capital", zones: ["Norte argentino"] },
        { name: "Cafayate", zones: ["Valles Calchaquíes"] },
      ],
    },
    {
      name: "Jujuy",
      cities: [
        { name: "San Salvador de Jujuy", zones: ["Norte argentino"] },
        { name: "Purmamarca", zones: ["Quebrada de Humahuaca"] },
        { name: "Tilcara", zones: ["Quebrada de Humahuaca"] },
      ],
    },
    {
      name: "Misiones",
      cities: [
        { name: "Puerto Iguazú", zones: ["Cataratas del Iguazú"] },
        { name: "Posadas", zones: ["Litoral"] },
      ],
    },
  ],
};

/** Países preparados para futuras cargas (arquitectura lista, datos pendientes). */
const PENDING: GeoCountry[] = [
  { code: "CL", name: "Chile", regionLabel: "Región", regions: [] },
  { code: "UY", name: "Uruguay", regionLabel: "Departamento", regions: [] },
  { code: "BR", name: "Brasil", regionLabel: "Estado", regions: [] },
  { code: "MX", name: "México", regionLabel: "Estado", regions: [] },
  { code: "US", name: "Estados Unidos", regionLabel: "Estado", regions: [] },
  { code: "ES", name: "España", regionLabel: "Comunidad", regions: [] },
];

export const GEO_COUNTRIES: GeoCountry[] = [ARGENTINA, ...PENDING];

export const DEFAULT_COUNTRY = "Argentina";

export function countryByName(name: string | null | undefined): GeoCountry | null {
  if (!name) return null;
  return GEO_COUNTRIES.find((c) => c.name === name) ?? null;
}

export function regionsOf(country: string | null | undefined): GeoRegion[] {
  return countryByName(country)?.regions ?? [];
}

export function regionLabelOf(country: string | null | undefined): string {
  return countryByName(country)?.regionLabel ?? "Provincia / Región";
}

export function citiesOf(country: string | null | undefined, region?: string | null): GeoCity[] {
  const regions = regionsOf(country);
  if (region) return regions.find((r) => r.name === region)?.cities ?? [];
  return regions.flatMap((r) => r.cities);
}

export function cityNamesOf(country: string | null | undefined, region?: string | null): string[] {
  return citiesOf(country, region).map((c) => c.name);
}

export function zonesOf(country: string | null | undefined, region?: string | null): string[] {
  return Array.from(new Set(citiesOf(country, region).flatMap((c) => c.zones ?? []))).sort();
}

/** Todas las provincias/regiones cargadas, de todos los países. */
export function allRegions(): string[] {
  return Array.from(new Set(GEO_COUNTRIES.flatMap((c) => c.regions.map((r) => r.name)))).sort();
}

export function allCities(): string[] {
  return Array.from(
    new Set(GEO_COUNTRIES.flatMap((c) => c.regions.flatMap((r) => r.cities.map((x) => x.name)))),
  ).sort();
}

export function allZones(): string[] {
  return Array.from(
    new Set(
      GEO_COUNTRIES.flatMap((c) =>
        c.regions.flatMap((r) => r.cities.flatMap((x) => x.zones ?? [])),
      ),
    ),
  ).sort();
}

/** Región a la que pertenece una ciudad del catálogo (si está cargada). */
export function regionOfCity(city: string | null | undefined): string | null {
  if (!city) return null;
  for (const country of GEO_COUNTRIES) {
    for (const region of country.regions) {
      if (region.cities.some((c) => c.name === city)) return region.name;
    }
  }
  return null;
}

/** Zonas turísticas de una ciudad del catálogo. */
export function zonesOfCity(city: string | null | undefined): string[] {
  if (!city) return [];
  for (const country of GEO_COUNTRIES) {
    for (const region of country.regions) {
      const match = region.cities.find((c) => c.name === city);
      if (match) return match.zones ?? [];
    }
  }
  return [];
}
