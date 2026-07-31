/**
 * Catálogo geográfico operativo (v1.4 · ampliado en v1.8.2.1).
 *
 * Jerarquía: País → Provincia / Estado / Región → Ciudad / Localidad → Zona
 * turística. Hoy vive en código (sin dependencia de red ni migraciones) pero
 * la forma de los datos es la misma que tendrá la futura tabla del catálogo,
 * así que migrarlo a base más adelante no cambia la interfaz de consumo.
 *
 * Argentina está cargada completa (24 jurisdicciones). Chile, Uruguay, Brasil,
 * México, Estados Unidos y España quedan declarados con su estructura vacía:
 * sumar sus ciudades no requiere cambiar el modelo de datos ni la UI.
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
      name: "Ciudad Autónoma de Buenos Aires",
      cities: [{ name: "Buenos Aires", zones: ["Ciudad de Buenos Aires"] }],
    },
    {
      name: "Buenos Aires",
      cities: [
        { name: "La Plata", zones: ["Área metropolitana"] },
        { name: "Mar del Plata", zones: ["Costa Atlántica"] },
        { name: "Pinamar", zones: ["Costa Atlántica"] },
        { name: "Villa Gesell", zones: ["Costa Atlántica"] },
        { name: "Cariló", zones: ["Costa Atlántica"] },
        { name: "Necochea", zones: ["Costa Atlántica"] },
        { name: "Tandil", zones: ["Sierras bonaerenses"] },
        { name: "Tigre", zones: ["Delta"] },
        { name: "San Antonio de Areco", zones: ["Pampa gaucha"] },
        { name: "Bahía Blanca", zones: ["Sudoeste bonaerense"] },
        { name: "Aeropuerto Ezeiza", zones: ["Aeropuertos internacionales"] },
        { name: "Aeroparque Jorge Newbery", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "Catamarca",
      cities: [
        { name: "San Fernando del Valle de Catamarca", zones: ["Norte argentino"] },
        { name: "Fiambalá", zones: ["Puna catamarqueña"] },
        { name: "Antofagasta de la Sierra", zones: ["Puna catamarqueña"] },
      ],
    },
    {
      name: "Chaco",
      cities: [
        { name: "Resistencia", zones: ["Litoral"] },
        { name: "Parque Nacional Chaco", zones: ["Impenetrable"] },
      ],
    },
    {
      name: "Chubut",
      cities: [
        { name: "Puerto Madryn", zones: ["Península Valdés"] },
        { name: "Puerto Pirámides", zones: ["Península Valdés"] },
        { name: "Esquel", zones: ["Corredor de los Alerces"] },
        { name: "Trevelin", zones: ["Corredor de los Alerces"] },
        { name: "Trelew", zones: ["Valle del Chubut"] },
        { name: "Comodoro Rivadavia", zones: ["Patagonia austral"] },
        { name: "Aeropuerto Trelew", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "Córdoba",
      cities: [
        { name: "Córdoba Capital", zones: ["Sierras de Córdoba"] },
        { name: "Villa Carlos Paz", zones: ["Sierras de Córdoba"] },
        { name: "La Cumbrecita", zones: ["Sierras de Córdoba"] },
        { name: "Mina Clavero", zones: ["Traslasierra"] },
        { name: "Villa General Belgrano", zones: ["Valle de Calamuchita"] },
        { name: "Aeropuerto Córdoba", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "Corrientes",
      cities: [
        { name: "Corrientes Capital", zones: ["Litoral"] },
        { name: "Colonia Carlos Pellegrini", zones: ["Esteros del Iberá"] },
        { name: "Mercedes", zones: ["Esteros del Iberá"] },
      ],
    },
    {
      name: "Entre Ríos",
      cities: [
        { name: "Paraná", zones: ["Litoral"] },
        { name: "Colón", zones: ["Termas del Litoral"] },
        { name: "Concordia", zones: ["Termas del Litoral"] },
        { name: "Gualeguaychú", zones: ["Litoral"] },
      ],
    },
    {
      name: "Formosa",
      cities: [
        { name: "Formosa Capital", zones: ["Litoral"] },
        { name: "Laguna Blanca", zones: ["Bañado La Estrella"] },
      ],
    },
    {
      name: "Jujuy",
      cities: [
        { name: "San Salvador de Jujuy", zones: ["Norte argentino"] },
        { name: "Purmamarca", zones: ["Quebrada de Humahuaca"] },
        { name: "Tilcara", zones: ["Quebrada de Humahuaca"] },
        { name: "Humahuaca", zones: ["Quebrada de Humahuaca"] },
        { name: "La Quiaca", zones: ["Puna jujeña"] },
        { name: "Aeropuerto Jujuy", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "La Pampa",
      cities: [
        { name: "Santa Rosa", zones: ["Pampa"] },
        { name: "General Pico", zones: ["Pampa"] },
      ],
    },
    {
      name: "La Rioja",
      cities: [
        { name: "La Rioja Capital", zones: ["Cuyo"] },
        { name: "Villa Unión", zones: ["Talampaya"] },
        { name: "Chilecito", zones: ["Cuyo"] },
      ],
    },
    {
      name: "Mendoza",
      cities: [
        { name: "Mendoza Capital", zones: ["Cuyo", "Ruta del vino"] },
        { name: "Maipú", zones: ["Ruta del vino"] },
        { name: "Luján de Cuyo", zones: ["Ruta del vino"] },
        { name: "San Rafael", zones: ["Cuyo"] },
        { name: "Malargüe", zones: ["Alta montaña"] },
        { name: "Las Leñas", zones: ["Alta montaña"] },
        { name: "Uspallata", zones: ["Alta montaña"] },
        { name: "Aeropuerto Mendoza", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "Misiones",
      cities: [
        { name: "Puerto Iguazú", zones: ["Cataratas del Iguazú"] },
        { name: "Posadas", zones: ["Litoral"] },
        { name: "San Ignacio", zones: ["Misiones jesuíticas"] },
        { name: "Aeropuerto Iguazú", zones: ["Aeropuertos internacionales"] },
      ],
    },
    {
      name: "Neuquén",
      cities: [
        { name: "Neuquén Capital", zones: ["Alto Valle"] },
        { name: "San Martín de los Andes", zones: ["Lagos del Sur", "Cerro Chapelco"] },
        { name: "Villa La Angostura", zones: ["Lagos del Sur"] },
        { name: "Junín de los Andes", zones: ["Lagos del Sur"] },
        { name: "Villa Pehuenia", zones: ["Pehuenia"] },
        { name: "Caviahue", zones: ["Caviahue - Copahue"] },
        { name: "Aluminé", zones: ["Pehuenia"] },
        { name: "Aeropuerto Chapelco", zones: ["Aeropuertos regionales"] },
        { name: "Aeropuerto Neuquén", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "Río Negro",
      cities: [
        { name: "San Carlos de Bariloche", zones: ["Lagos del Sur", "Cerro Catedral"] },
        { name: "El Bolsón", zones: ["Comarca Andina"] },
        { name: "Villa Traful", zones: ["Lagos del Sur"] },
        { name: "Las Grutas", zones: ["Costa Atlántica patagónica"] },
        { name: "Viedma", zones: ["Costa Atlántica patagónica"] },
        { name: "Aeropuerto Bariloche", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "Salta",
      cities: [
        { name: "Salta Capital", zones: ["Norte argentino"] },
        { name: "Cafayate", zones: ["Valles Calchaquíes"] },
        { name: "Cachi", zones: ["Valles Calchaquíes"] },
        { name: "San Antonio de los Cobres", zones: ["Puna salteña"] },
        { name: "Aeropuerto Salta", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "San Juan",
      cities: [
        { name: "San Juan Capital", zones: ["Cuyo"] },
        { name: "Valle Fértil", zones: ["Ischigualasto"] },
        { name: "Barreal", zones: ["Alta montaña"] },
      ],
    },
    {
      name: "San Luis",
      cities: [
        { name: "San Luis Capital", zones: ["Cuyo"] },
        { name: "Merlo", zones: ["Sierras puntanas"] },
        { name: "Potrero de los Funes", zones: ["Sierras puntanas"] },
      ],
    },
    {
      name: "Santa Cruz",
      cities: [
        { name: "El Calafate", zones: ["Glaciares"] },
        { name: "El Chaltén", zones: ["Glaciares"] },
        { name: "Puerto Deseado", zones: ["Patagonia austral"] },
        { name: "Río Gallegos", zones: ["Patagonia austral"] },
        { name: "Aeropuerto El Calafate", zones: ["Aeropuertos regionales"] },
      ],
    },
    {
      name: "Santa Fe",
      cities: [
        { name: "Rosario", zones: ["Litoral"] },
        { name: "Santa Fe Capital", zones: ["Litoral"] },
        { name: "Rafaela", zones: ["Litoral"] },
      ],
    },
    {
      name: "Santiago del Estero",
      cities: [
        { name: "Santiago del Estero", zones: ["Norte argentino"] },
        { name: "Termas de Río Hondo", zones: ["Termas del Norte"] },
      ],
    },
    {
      name: "Tierra del Fuego",
      cities: [
        { name: "Ushuaia", zones: ["Fin del Mundo"] },
        { name: "Tolhuin", zones: ["Fin del Mundo"] },
        { name: "Río Grande", zones: ["Fin del Mundo"] },
        { name: "Aeropuerto Ushuaia", zones: ["Aeropuertos internacionales"] },
      ],
    },
    {
      name: "Tucumán",
      cities: [
        { name: "San Miguel de Tucumán", zones: ["Norte argentino"] },
        { name: "Tafí del Valle", zones: ["Valles Calchaquíes"] },
        { name: "Amaicha del Valle", zones: ["Valles Calchaquíes"] },
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

/**
 * Zonas turísticas disponibles según las ciudades elegidas (v1.8.2.1).
 * Si no hay ciudades seleccionadas se usan las de la provincia o el país.
 */
export function zonesOfCities(
  cities: string[],
  fallback: { country?: string | null; region?: string | null } = {},
): string[] {
  const selected = cities.filter(Boolean);
  if (selected.length > 0) {
    return Array.from(new Set(selected.flatMap((c) => zonesOfCity(c)))).sort();
  }
  return zonesOf(fallback.country, fallback.region);
}
