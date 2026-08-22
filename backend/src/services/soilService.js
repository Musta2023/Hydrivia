import axios from 'axios';
import { config } from '../config/index.js';

let cachedSoil = null;
let lastSoilFetchTime = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures (données pédologiques stables)

export async function getSoilData(latitude = config.site.latitude, longitude = config.site.longitude) {
  const now = Date.now();
  if (cachedSoil && (now - lastSoilFetchTime) < CACHE_TTL_MS) {
    return cachedSoil;
  }

  try {
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lat=${latitude}&lon=${longitude}&property=clay&property=sand&property=silt&property=phh2o&property=soc&property=wv0033&depth=0-5cm&depth=5-15cm&value=mean`;
    const response = await axios.get(url, { timeout: 8000 });
    const layers = response.data?.properties?.layers || [];

    // Helper to extract mean across depths
    const getPropMean = (propName, scaleFactor = 1) => {
      const layer = layers.find(l => l.name === propName);
      if (!layer || !layer.depths || layer.depths.length === 0) return null;
      const values = layer.depths.map(d => d.values?.mean).filter(v => v !== undefined && v !== null);
      if (values.length === 0) return null;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return parseFloat((avg / scaleFactor).toFixed(1));
    };

    // SoilGrids units:
    // clay, sand, silt are in g/kg (divide by 10 for %)
    // phh2o is in pH*10 (divide by 10)
    // soc (soil organic carbon) is in dg/kg (divide by 10 for g/kg)
    // wv0033 (water retention at field capacity 33kPa) is in cm3/100cm3 / 10
    const clay = getPropMean('clay', 10) || 28.0;
    const sand = getPropMean('sand', 10) || 38.0;
    const silt = getPropMean('silt', 10) || 34.0;
    const ph = getPropMean('phh2o', 10) || 7.2;
    const soc = getPropMean('soc', 10) || 18.5; // g/kg
    const waterRetention = getPropMean('wv0033', 10) || 31.0; // % vol

    // Determine texture class
    let textureType = 'Limono-Argileux';
    let textureDescription = 'Sol équilibré offrant une excellente rétention d\'eau et une bonne porosité racinaire.';
    if (clay > 40) {
      textureType = 'Argileux';
      textureDescription = 'Forte rétention d\'eau mais drainage lent. Privilégier des irrigations fractionnées.';
    } else if (sand > 50) {
      textureType = 'Sableux';
      textureDescription = 'Drainage très rapide et faible rétention. Nécessite des arrosages fréquents et courts.';
    } else if (silt > 50) {
      textureType = 'Limoneux';
      textureDescription = 'Très bonne fertilité, risque modéré de battance en cas de sur-arrosage.';
    }

    const formattedSoil = {
      coordinates: { latitude, longitude },
      siteName: config.site.name,
      texture: {
        clayPct: clay,
        sandPct: sand,
        siltPct: silt,
        type: textureType,
        description: textureDescription
      },
      chemistry: {
        ph: ph,
        phCategory: ph > 7.5 ? 'Basique' : ph < 6.5 ? 'Acide' : 'Neutre à optimal',
        organicCarbonGPerKg: soc,
        organicMatterPct: parseFloat((soc * 0.1724).toFixed(1))
      },
      waterProperties: {
        fieldCapacityPct: waterRetention,
        drainageCategory: sand > 45 ? 'Rapide' : clay > 35 ? 'Lent' : 'Modéré / Idéal',
        irrigationAdvice: 'Fréquence recommandée : 1 à 2 cycles par jour selon la météo et l\'humidité du sol mesurée.'
      },
      lastUpdated: new Date().toISOString()
    };

    cachedSoil = formattedSoil;
    lastSoilFetchTime = now;
    return formattedSoil;

  } catch (error) {
    console.warn('[SoilGrids] Erreur API ou indisponible:', error.message);
    
    // Fallback data
    return cachedSoil || {
      coordinates: { latitude, longitude },
      siteName: config.site.name,
      texture: {
        clayPct: 28.5,
        sandPct: 37.2,
        siltPct: 34.3,
        type: 'Limono-Argileux',
        description: 'Sol équilibré offrant une excellente rétention d\'eau et une bonne aération racinaire.'
      },
      chemistry: {
        ph: 7.2,
        phCategory: 'Neutre à optimal',
        organicCarbonGPerKg: 19.2,
        organicMatterPct: 3.3
      },
      waterProperties: {
        fieldCapacityPct: 32.5,
        drainageCategory: 'Modéré / Idéal',
        irrigationAdvice: 'Texture idéale pour Tomate, Menthe et Oignon. Les seuils recommandés sont entre 45% et 65% d\'humidité.'
      },
      lastUpdated: new Date().toISOString()
    };
  }
}
