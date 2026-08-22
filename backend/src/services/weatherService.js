import axios from 'axios';
import { config } from '../config/index.js';

let cachedWeather = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function getWeatherData(latitude = config.site.latitude, longitude = config.site.longitude) {
  const now = Date.now();
  if (cachedWeather && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedWeather;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=auto`;
    const response = await axios.get(url, { timeout: 6000 });
    const data = response.data;

    // Analyze rain forecast for tomorrow (index 1 in daily array)
    const rainProbTomorrow = data.daily?.precipitation_probability_max?.[1] || 0;
    const rainSumTomorrow = data.daily?.precipitation_sum?.[1] || 0;

    let recommendation = {
      action: 'NORMAL',
      title: 'Irrigation standard conseillée',
      description: 'Aucune précipitation majeure prévue dans les 24h. Maintenir les cycles d\'arrosage prévus.',
      icon: 'sun',
      shouldPause: false
    };

    if (rainProbTomorrow >= 60 || rainSumTomorrow >= 5.0) {
      recommendation = {
        action: 'PAUSE_SUGGESTED',
        title: `Pluie prévue demain (${rainProbTomorrow}% de probabilité, ${rainSumTomorrow} mm)`,
        description: 'Des précipitations significatives sont attendues. Il est suggéré de mettre en pause l\'irrigation automatique pour économiser l\'eau.',
        icon: 'cloud-rain',
        shouldPause: true
      };
    } else if (rainProbTomorrow >= 40 || rainSumTomorrow >= 2.0) {
      recommendation = {
        action: 'REDUCE_SUGGESTED',
        title: `Risque d'averse demain (${rainProbTomorrow}%)`,
        description: 'Faibles précipitations possibles. Vous pouvez réduire la dose d\'arrosage programmée de 30%.',
        icon: 'cloud-drizzle',
        shouldPause: false
      };
    }

    const formattedData = {
      siteName: config.site.name,
      coordinates: { latitude, longitude },
      current: {
        temperature: data.current?.temperature_2m,
        humidity: data.current?.relative_humidity_2m,
        precipitation: data.current?.precipitation,
        rain: data.current?.rain,
        windSpeed: data.current?.wind_speed_10m,
        weatherCode: data.current?.weather_code,
        time: data.current?.time
      },
      daily: data.daily?.time?.map((date, idx) => ({
        date,
        maxTemp: data.daily.temperature_2m_max[idx],
        minTemp: data.daily.temperature_2m_min[idx],
        rainProbability: data.daily.precipitation_probability_max[idx],
        precipitationSum: data.daily.precipitation_sum[idx],
        weatherCode: data.daily.weather_code[idx]
      })) || [],
      recommendation,
      lastUpdated: new Date().toISOString()
    };

    cachedWeather = formattedData;
    lastFetchTime = now;
    return formattedData;

  } catch (error) {
    console.warn('[Open-Meteo] Erreur API:', error.message);
    
    // Fallback data if API unreachable
    return cachedWeather || {
      siteName: config.site.name,
      coordinates: { latitude, longitude },
      current: { temperature: 23.5, humidity: 60, precipitation: 0, rain: 0, windSpeed: 12, weatherCode: 1, time: new Date().toISOString() },
      daily: Array.from({ length: 7 }).map((_, i) => ({
        date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
        maxTemp: (24 + Math.sin(i) * 3).toFixed(1),
        minTemp: (14 + Math.sin(i) * 2).toFixed(1),
        rainProbability: i === 1 ? 65 : 15,
        precipitationSum: i === 1 ? 6.2 : 0,
        weatherCode: i === 1 ? 61 : 0
      })),
      recommendation: {
        action: 'PAUSE_SUGGESTED',
        title: 'Pluie prévue demain (65% de probabilité, 6.2 mm)',
        description: 'Précipitations attendues. Suggestion de pause d\'irrigation automatique pour préserver les réserves.',
        icon: 'cloud-rain',
        shouldPause: true
      },
      lastUpdated: new Date().toISOString()
    };
  }
}
