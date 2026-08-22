import React, { useState, useEffect } from 'react';
import {
  CloudRain,
  Sun,
  CloudDrizzle,
  Wind,
  Droplets,
  Thermometer,
  MapPin,
  AlertCircle,
  Calendar,
  Sparkles
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import StatCard from '../components/common/StatCard';

export default function WeatherPage() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWeather() {
      try {
        const res = await api.get('/weather');
        setWeather(res.data);
      } catch (err) {
        console.error('Error fetching weather:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWeather();
  }, []);

  const current = weather?.current || { temperature: 23.5, humidity: 60, rain: 0, windSpeed: 12 };
  const recommendation = weather?.recommendation || {
    action: 'NORMAL',
    title: 'Irrigation standard recommandée',
    description: 'Conditions météo stables.',
    shouldPause: false
  };

  const chartData = (weather?.daily || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
    rainProb: d.rainProbability,
    rainSum: d.precipitationSum,
    maxTemp: d.maxTemp,
    minTemp: d.minTemp
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-hydra-info/15 text-hydra-info border border-hydra-info/30">
            <CloudRain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-hydra-textMain">
              Météorologie & Prévisions (Open-Meteo API)
            </h2>
            <p className="text-xs text-hydra-textMuted flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-hydra-neon" />
              <span>{weather?.siteName || 'Station HYDRIVIA'} ({weather?.coordinates?.latitude}, {weather?.coordinates?.longitude})</span>
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-hydra-textMuted bg-hydra-dark/80 px-3 py-1.5 rounded-xl border border-hydra-border">
          Actualisé via Open-Meteo v1
        </div>
      </div>

      {/* Smart Agronomic Recommendation Banner */}
      <div
        className={`p-5 rounded-2xl border transition-all flex items-start gap-4 ${
          recommendation.shouldPause
            ? 'bg-hydra-warning/15 border-hydra-warning/50 text-hydra-warning shadow-[0_0_25px_rgba(255,170,0,0.15)]'
            : 'bg-hydra-neon/10 border-hydra-neon/40 text-hydra-neon shadow-[0_0_20px_rgba(0,255,136,0.1)]'
        }`}
      >
        <div className="p-2.5 rounded-xl bg-hydra-dark/80 border border-current flex-shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-hydra-dark border border-current">
              CONSEIL AGRONOMIQUE
            </span>
            <h3 className="font-bold text-base text-hydra-textMain">
              {recommendation.title}
            </h3>
          </div>
          <p className="text-xs text-hydra-textMain/80 leading-relaxed">
            {recommendation.description}
          </p>
          <p className="text-[11px] text-hydra-textMuted mt-2 font-mono">
            * Note : Information d'aide à la décision — aucune suspension automatique n'est appliquée sans confirmation de l'administrateur.
          </p>
        </div>
      </div>

      {/* Current Weather KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Température Extérieure"
          value={current.temperature}
          unit="°C"
          subtitle="Modèle météorologique live"
          icon={Thermometer}
        />
        <StatCard
          title="Humidité Relative"
          value={current.humidity}
          unit="%"
          subtitle="Teneur en humidité de l'air"
          icon={Droplets}
        />
        <StatCard
          title="Vitesse du Vent"
          value={current.windSpeed}
          unit="km/h"
          subtitle="Impact sur l'évapotranspiration"
          icon={Wind}
        />
        <StatCard
          title="Précipitations Actuelles"
          value={current.precipitation || current.rain || 0}
          unit="mm"
          subtitle="Pluviomètre live"
          icon={CloudDrizzle}
          highlight={(current.precipitation || 0) > 0}
        />
      </div>

      {/* 7-Day Precipitation Probability Chart */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-hydra-neon" />
              Probabilité de Pluie & Cumul sur 7 Jours
            </h3>
            <p className="text-xs text-hydra-textMuted mt-0.5">
              Anticipation des besoins d'arrosage
            </p>
          </div>
          <span className="text-xs font-mono text-hydra-info bg-hydra-info/10 px-3 py-1 rounded-lg border border-hydra-info/30">
            Probabilité (%)
          </span>
        </div>

        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2e28" />
                <XAxis dataKey="date" stroke="#526b60" fontSize={11} />
                <YAxis stroke="#526b60" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121a17',
                    borderColor: '#00b4d8',
                    borderRadius: '12px',
                    color: '#e0ece6',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}
                  formatter={(val, name) => [`${val}%`, 'Probabilité de pluie']}
                />
                <Bar dataKey="rainProb" fill="#00b4d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-hydra-textMuted font-mono">
              Chargement des prévisions...
            </div>
          )}
        </div>
      </div>

      {/* 7-Day Forecast Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {(weather?.daily || []).map((day, idx) => (
          <div key={idx} className="glass-panel rounded-xl p-3.5 text-center flex flex-col justify-between hover:border-hydra-borderHighlight transition">
            <span className="text-xs font-semibold text-hydra-textMuted capitalize">
              {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
            </span>
            <span className="text-[11px] font-mono text-hydra-textDim">
              {new Date(day.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}
            </span>

            <div className="my-3 flex justify-center text-hydra-neon">
              {day.rainProbability > 40 ? (
                <CloudRain className="w-7 h-7 text-hydra-info animate-bounce" />
              ) : (
                <Sun className="w-7 h-7 text-hydra-neon" />
              )}
            </div>

            <div className="text-xs font-mono">
              <span className="font-bold text-hydra-textMain">{day.maxTemp}°</span>{' '}
              <span className="text-hydra-textDim">{day.minTemp}°</span>
            </div>

            <div className="mt-2 text-[10px] font-mono text-hydra-info">
              {day.rainProbability}% pluie
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
