import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Thermometer,
  ThermometerSun,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudLightning,
  Droplets,
  Wind,
  MapPin,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

export interface LocationOption {
  id: string;
  name: string;
  label: string;
  latitude: number;
  longitude: number;
  region: string;
}

export const PRESET_LOCATIONS: LocationOption[] = [
  {
    id: 'san-vicente-bislig',
    name: 'San Vicente, Bislig City, Surigao del Sur, Philippines',
    label: 'San Vicente, Bislig City',
    latitude: 8.2167,
    longitude: 126.3167,
    region: 'Surigao del Sur',
  },
  {
    id: 'mangagoy-bislig',
    name: 'Mangagoy, Bislig City, Surigao del Sur',
    label: 'Mangagoy, Bislig City',
    latitude: 8.1883,
    longitude: 126.3533,
    region: 'Surigao del Sur',
  },
  {
    id: 'poblacion-bislig',
    name: 'Poblacion, Bislig City, Surigao del Sur',
    label: 'Poblacion, Bislig City',
    latitude: 8.2167,
    longitude: 126.3167,
    region: 'Surigao del Sur',
  },
  {
    id: 'hinatuan',
    name: 'Hinatuan, Surigao del Sur',
    label: 'Hinatuan, Surigao del Sur',
    latitude: 8.3667,
    longitude: 126.3333,
    region: 'Surigao del Sur',
  },
  {
    id: 'tandag-city',
    name: 'Tandag City, Surigao del Sur',
    label: 'Tandag City',
    latitude: 9.0789,
    longitude: 126.1989,
    region: 'Surigao del Sur',
  },
];

export interface HeatIndexClassification {
  level: 'Normal' | 'Caution' | 'Extreme Caution' | 'Danger' | 'Extreme Danger';
  rangeLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardGlow: string;
  textColor: string;
  barColor: string;
  warningSummary: string;
  effects: string;
  schoolProtocols: string;
}

/**
 * Philippine PAGASA Heat Index Classifications & DepEd Guidance
 */
export function getPagasaClassification(heatIndex: number): HeatIndexClassification {
  if (heatIndex >= 52) {
    return {
      level: 'Extreme Danger',
      rangeLabel: '52°C+',
      badgeBg: 'bg-rose-500/20',
      badgeText: 'text-rose-400',
      badgeBorder: 'border-rose-500/50',
      cardGlow: 'shadow-[0_0_20px_rgba(244,63,94,0.25)] border-rose-500/60',
      textColor: 'text-rose-400',
      barColor: 'bg-rose-500',
      warningSummary: 'Heat stroke is imminent! Immediate cessation of outdoor physical activities recommended.',
      effects: 'Heat stroke is imminent with continued exposure. Severe hyperthermia risk.',
      schoolProtocols: 'Mandatory cancellation of all outdoor classes, sports, and drills. In-person classes may transition to modular/distance learning per DepEd DO No. 037 s. 2022.',
    };
  }

  if (heatIndex >= 42) {
    return {
      level: 'Danger',
      rangeLabel: '42°C–51°C',
      badgeBg: 'bg-orange-500/20',
      badgeText: 'text-orange-400',
      badgeBorder: 'border-orange-500/50',
      cardGlow: 'shadow-[0_0_15px_rgba(249,115,22,0.2)] border-orange-500/60',
      textColor: 'text-orange-400',
      barColor: 'bg-orange-500',
      warningSummary: 'Heat cramps & exhaustion likely; heat stroke probable with continued physical activity.',
      effects: 'Heat cramps and heat exhaustion are likely. Heat stroke is probable with prolonged activity.',
      schoolProtocols: 'Suspend outdoor physical education (PE) activities, flag ceremonies, and campus grounds maintenance. Ensure classrooms have adequate ventilation and accessible drinking water.',
    };
  }

  if (heatIndex >= 33) {
    return {
      level: 'Extreme Caution',
      rangeLabel: '33°C–41°C',
      badgeBg: 'bg-amber-500/20',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-500/50',
      cardGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)] border-amber-500/50',
      textColor: 'text-amber-400',
      barColor: 'bg-amber-400',
      warningSummary: 'Heat cramps & exhaustion possible. Continuing activity could lead to heat stroke.',
      effects: 'Heat cramps and heat exhaustion are possible. Continuing prolonged physical activity could lead to heat stroke.',
      schoolProtocols: 'Limit direct sun exposure between 10:00 AM and 3:00 PM. Schedule frequent hydration breaks for learners and faculty. Move rigorous activities to covered courts or shaded areas.',
    };
  }

  if (heatIndex >= 27) {
    return {
      level: 'Caution',
      rangeLabel: '27°C–32°C',
      badgeBg: 'bg-emerald-500/20',
      badgeText: 'text-emerald-400',
      badgeBorder: 'border-emerald-500/50',
      cardGlow: 'shadow-[0_0_10px_rgba(16,185,129,0.12)] border-emerald-500/40',
      textColor: 'text-emerald-400',
      barColor: 'bg-emerald-400',
      warningSummary: 'Fatigue possible with prolonged outdoor exposure and activity. Stay hydrated.',
      effects: 'Fatigue is possible with prolonged exposure and activity. Continuing activity could lead to heat cramps.',
      schoolProtocols: 'Standard campus operations. Encourage regular water intake and sun protection for students during outdoor recess.',
    };
  }

  return {
    level: 'Normal',
    rangeLabel: '<27°C',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-300',
    badgeBorder: 'border-sky-500/40',
    cardGlow: 'border-sky-500/30',
    textColor: 'text-sky-400',
    barColor: 'bg-sky-400',
    warningSummary: 'Comfortable weather conditions. Normal school activities may proceed.',
    effects: 'Minimal risk of heat-related illness under typical ambient conditions.',
    schoolProtocols: 'Normal school day routine. Regular curricular and extracurricular activities proceed as scheduled.',
  };
}

/**
 * Calculate Heat Index based on NOAA / PAGASA Rothfusz regression equation
 */
export function calculateHeatIndex(tempC: number, rh: number): number {
  if (tempC < 27) {
    return Math.round(tempC * 10) / 10;
  }

  const T = tempC * 1.8 + 32;
  const R = rh;

  let hiF =
    -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R;

  if (R < 13 && T >= 80 && T <= 112) {
    const adj = ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    hiF -= adj;
  } else if (R > 85 && T >= 80 && T <= 87) {
    const adj = ((R - 85) / 10) * ((87 - T) / 5);
    hiF += adj;
  }

  const hiC = (hiF - 32) / 1.8;
  return Math.round(hiC * 10) / 10;
}

export function interpretWeatherCode(code: number): { text: string; icon: 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'lightning' } {
  if (code === 0) return { text: 'Clear Sky / Sunny', icon: 'sun' };
  if (code === 1) return { text: 'Mainly Clear', icon: 'cloud-sun' };
  if (code === 2) return { text: 'Partly Cloudy', icon: 'cloud-sun' };
  if (code === 3) return { text: 'Overcast', icon: 'cloud' };
  if (code === 45 || code === 48) return { text: 'Fog / Haze', icon: 'cloud' };
  if (code >= 51 && code <= 57) return { text: 'Light Drizzle', icon: 'rain' };
  if (code >= 61 && code <= 67) return { text: 'Rain Showers', icon: 'rain' };
  if (code >= 71 && code <= 77) return { text: 'Cold Weather', icon: 'cloud' };
  if (code >= 80 && code <= 82) return { text: 'Heavy Rain', icon: 'rain' };
  if (code >= 95 && code <= 99) return { text: 'Thunderstorm', icon: 'lightning' };
  return { text: 'Fair Weather', icon: 'cloud-sun' };
}

export interface LiveWeatherData {
  heatIndex: number;
  airTemperature: number;
  humidity: number;
  weatherCode: number;
  weatherText: string;
  windSpeed: number;
  lastUpdated: string;
  lastUpdatedRaw: Date;
  locationName: string;
}

const STORAGE_CACHE_KEY = 'svnhs_heat_index_cache_v1';
const LOCATION_STORAGE_KEY = 'svnhs_heat_index_selected_location';
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

export const HeatIndexMonitor: React.FC = () => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCATION_STORAGE_KEY) || PRESET_LOCATIONS[0].id;
    } catch {
      return PRESET_LOCATIONS[0].id;
    }
  });

  const currentLocation = useMemo(() => {
    return PRESET_LOCATIONS.find((l) => l.id === selectedLocationId) || PRESET_LOCATIONS[0];
  }, [selectedLocationId]);

  const [weatherData, setWeatherData] = useState<LiveWeatherData | null>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.heatIndex === 'number') {
          return {
            ...parsed,
            lastUpdatedRaw: new Date(parsed.lastUpdatedRaw || Date.now()),
          };
        }
      }
    } catch {}
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState<number>(0);

  const fetchWeatherData = useCallback(
    async (loc: LocationOption, isManual: boolean = false) => {
      const now = Date.now();
      if (isManual && now - lastFetchTimestamp < 8000 && !errorMessage) {
        return;
      }

      if (isManual) {
        setIsRefreshing(true);
      } else if (!weatherData) {
        setIsLoading(true);
      }

      setLastFetchTimestamp(now);

      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Asia%2FManila`;

        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Weather service HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data || !data.current) {
          throw new Error('Invalid meteorological response');
        }

        const tempC = Number(data.current.temperature_2m);
        const rh = Number(data.current.relative_humidity_2m);
        const wmo = Number(data.current.weather_code ?? 0);
        const wind = Number(data.current.wind_speed_10m ?? 0);

        const computedHeatIndex = calculateHeatIndex(tempC, rh);
        const weatherInfo = interpretWeatherCode(wmo);

        const fetchDate = new Date();
        const formattedDate = fetchDate.toLocaleString('en-PH', {
          timeZone: 'Asia/Manila',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        const newRecord: LiveWeatherData = {
          heatIndex: computedHeatIndex,
          airTemperature: Math.round(tempC * 10) / 10,
          humidity: Math.round(rh),
          weatherCode: wmo,
          weatherText: weatherInfo.text,
          windSpeed: Math.round(wind * 10) / 10,
          lastUpdated: formattedDate,
          lastUpdatedRaw: fetchDate,
          locationName: loc.name,
        };

        setWeatherData(newRecord);
        setErrorMessage(null);

        try {
          localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(newRecord));
        } catch {}
      } catch (err: any) {
        console.warn('Real-time Heat Index fetch notice:', err);
        setErrorMessage('Weather data temporarily unavailable');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [lastFetchTimestamp, errorMessage, weatherData]
  );

  useEffect(() => {
    fetchWeatherData(currentLocation, false);
  }, [currentLocation]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchWeatherData(currentLocation, false);
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [currentLocation, fetchWeatherData]);

  const classification = useMemo(() => {
    if (!weatherData) {
      return getPagasaClassification(0);
    }
    return getPagasaClassification(weatherData.heatIndex);
  }, [weatherData]);

  const weatherIconComponent = useMemo(() => {
    if (!weatherData) return <Sun className="w-4 h-4 text-amber-400" />;
    const info = interpretWeatherCode(weatherData.weatherCode);
    switch (info.icon) {
      case 'sun':
        return <Sun className="w-4 h-4 text-amber-400 animate-pulse" />;
      case 'cloud-sun':
        return <CloudSun className="w-4 h-4 text-amber-300" />;
      case 'cloud':
        return <Cloud className="w-4 h-4 text-slate-300" />;
      case 'rain':
        return <CloudRain className="w-4 h-4 text-sky-400" />;
      case 'lightning':
        return <CloudLightning className="w-4 h-4 text-amber-400" />;
      default:
        return <Sun className="w-4 h-4 text-amber-400" />;
    }
  }, [weatherData]);

  return (
    <div className="w-full mb-3 select-none transition-all duration-300">
      {/* Sleek, Low-Profile Heat Index Dashboard Bar */}
      <div
        className={`relative overflow-hidden rounded-xl border bg-[#111927]/95 backdrop-blur-md shadow-lg transition-all duration-300 ${
          weatherData ? classification.cardGlow : 'border-[#24334b]'
        }`}
      >
        {/* Subtle Top Classification Color Accent Line */}
        <div className={`h-1 w-full ${weatherData ? classification.barColor : 'bg-slate-700'}`} />

        <div className="px-3.5 py-2.5 sm:px-4 sm:py-2.5">
          {errorMessage && !weatherData ? (
            <div className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="font-semibold">Weather data temporarily unavailable for {currentLocation.label}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchWeatherData(currentLocation, true)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : weatherData ? (
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
              
              {/* SECTION 1: Location & Heat Index Reading (Left) */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
                {/* Location Chip */}
                <div className="flex items-center space-x-1.5">
                  <div className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-white tracking-tight truncate max-w-[170px] sm:max-w-xs">
                        {currentLocation.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsLocationModalOpen(true)}
                        className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 underline underline-offset-1 cursor-pointer"
                        title="Change station"
                      >
                        Change
                      </button>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">
                      PAGASA Heat Index
                    </span>
                  </div>
                </div>

                <div className="h-6 w-px bg-[#263750] hidden sm:block" />

                {/* Prominent Compact Heat Index Temperature */}
                <div className="flex items-center space-x-2.5">
                  <div className="flex items-center space-x-1.5">
                    <ThermometerSun className={`w-5 h-5 shrink-0 ${classification.textColor}`} />
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 hidden xs:inline">
                      Heat Index:
                    </span>
                    <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${classification.textColor}`}>
                      {weatherData.heatIndex.toFixed(1)}°C
                    </span>
                  </div>

                  {/* Classification Badge */}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase border tracking-wider ${classification.badgeBg} ${classification.badgeText} ${classification.badgeBorder}`}
                  >
                    {classification.level}
                  </span>
                </div>
              </div>

              {/* SECTION 2: Compact Weather Indicator Pills (Middle) */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] font-mono">
                {/* Air Temperature */}
                <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-[#141e30]/80 border border-[#23334d] text-slate-300" title="Ambient Air Temperature">
                  <Thermometer className="w-3 h-3 text-rose-400" />
                  <span className="text-slate-400 text-[10px]">Air:</span>
                  <span className="font-bold text-white">{weatherData.airTemperature.toFixed(1)}°C</span>
                </div>

                {/* Relative Humidity */}
                <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-[#141e30]/80 border border-[#23334d] text-slate-300" title="Relative Humidity">
                  <Droplets className="w-3 h-3 text-sky-400" />
                  <span className="text-slate-400 text-[10px]">RH:</span>
                  <span className="font-bold text-sky-300">{weatherData.humidity}%</span>
                </div>

                {/* Weather Condition */}
                <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-[#141e30]/80 border border-[#23334d] text-slate-300" title="Sky Condition">
                  {weatherIconComponent}
                  <span className="text-slate-200 font-semibold text-[10px] truncate max-w-[110px]">
                    {weatherData.weatherText}
                  </span>
                </div>

                {/* Surface Wind */}
                <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-[#141e30]/80 border border-[#23334d] text-slate-300 hidden md:flex" title="Wind Speed">
                  <Wind className="w-3 h-3 text-teal-400" />
                  <span className="text-slate-200 font-medium text-[10px]">{weatherData.windSpeed} km/h</span>
                </div>
              </div>

              {/* SECTION 3: Warning Message, Timestamp & Controls (Right) */}
              <div className="flex items-center justify-between lg:justify-end space-x-2 text-[10px] shrink-0 pt-1 lg:pt-0 border-t lg:border-t-0 border-[#22334b]/60">
                {/* Warning message teaser */}
                <div className="hidden xl:flex items-center space-x-1 max-w-[220px] text-slate-300 truncate" title={classification.warningSummary}>
                  <AlertTriangle className={`w-3 h-3 shrink-0 ${classification.textColor}`} />
                  <span className="truncate">{classification.warningSummary}</span>
                </div>

                {/* Last updated timestamp */}
                <div className="flex items-center space-x-1 font-mono text-slate-400 text-[9px] sm:text-[10px]">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{weatherData.lastUpdated}</span>
                </div>

                {/* Live Indicator */}
                <div className="hidden sm:inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live</span>
                </div>

                {/* Manual Refresh Button */}
                <button
                  type="button"
                  onClick={() => fetchWeatherData(currentLocation, true)}
                  disabled={isRefreshing || isLoading}
                  className="p-1 sm:px-2 sm:py-1 rounded-lg bg-[#1a2538] hover:bg-[#22314a] active:scale-95 text-slate-300 hover:text-white border border-[#2a3d5b] text-[10px] font-mono font-bold flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                  title="Refresh meteorological feed"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshing || isLoading ? 'animate-spin text-emerald-400' : ''}`} />
                  <span className="hidden sm:inline">{isRefreshing || isLoading ? 'Syncing' : 'Refresh'}</span>
                </button>

                {/* Safety Protocol Expand Toggle */}
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className={`px-2 py-1 rounded-lg border transition-all text-[10px] font-mono font-bold flex items-center space-x-1 cursor-pointer ${
                    isExpanded
                      ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300'
                      : 'bg-[#1a2538] hover:bg-[#22314a] text-slate-300 border-[#2a3d5b]'
                  }`}
                  title={isExpanded ? 'Collapse safety protocols' : 'View full PAGASA classification scale & DepEd DO 037'}
                >
                  <span>Protocol</span>
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

            </div>
          ) : (
            <div className="py-1.5 flex items-center justify-center space-x-2 text-slate-400 font-mono text-[11px]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>Fetching real-time Heat Index for {currentLocation.label}...</span>
            </div>
          )}

          {/* Collapsible Section: Only visible when "Protocol" button is clicked */}
          {isExpanded && weatherData && (
            <div className="mt-2.5 pt-2.5 border-t border-[#24334b]/80 space-y-2.5 animate-fadeIn">
              {/* 4-Tier PAGASA Scale Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                {/* Caution */}
                <div
                  className={`p-2 rounded-lg border ${
                    classification.level === 'Caution'
                      ? 'bg-emerald-500/25 border-emerald-400 ring-1 ring-emerald-400'
                      : 'bg-[#0d1624] border-[#1e2d42] opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-emerald-300">
                    <span>Caution</span>
                    <span className="font-mono">27°C–32°C</span>
                  </div>
                  <p className="text-slate-300 text-[9px] mt-0.5 leading-tight">
                    Fatigue possible with prolonged activity.
                  </p>
                </div>

                {/* Extreme Caution */}
                <div
                  className={`p-2 rounded-lg border ${
                    classification.level === 'Extreme Caution'
                      ? 'bg-amber-500/25 border-amber-400 ring-1 ring-amber-400'
                      : 'bg-[#0d1624] border-[#1e2d42] opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-amber-300">
                    <span>Extreme Caution</span>
                    <span className="font-mono">33°C–41°C</span>
                  </div>
                  <p className="text-slate-300 text-[9px] mt-0.5 leading-tight">
                    Heat cramps & exhaustion possible.
                  </p>
                </div>

                {/* Danger */}
                <div
                  className={`p-2 rounded-lg border ${
                    classification.level === 'Danger'
                      ? 'bg-orange-500/25 border-orange-400 ring-1 ring-orange-400'
                      : 'bg-[#0d1624] border-[#1e2d42] opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-orange-300">
                    <span>Danger</span>
                    <span className="font-mono">42°C–51°C</span>
                  </div>
                  <p className="text-slate-300 text-[9px] mt-0.5 leading-tight">
                    Heat cramps likely; heat stroke probable.
                  </p>
                </div>

                {/* Extreme Danger */}
                <div
                  className={`p-2 rounded-lg border ${
                    classification.level === 'Extreme Danger'
                      ? 'bg-rose-500/25 border-rose-400 ring-1 ring-rose-400'
                      : 'bg-[#0d1624] border-[#1e2d42] opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-rose-300">
                    <span>Extreme Danger</span>
                    <span className="font-mono">52°C+</span>
                  </div>
                  <p className="text-slate-300 text-[9px] mt-0.5 leading-tight">
                    Heat stroke imminent! Cancel outdoor tasks.
                  </p>
                </div>
              </div>

              {/* Action Directive */}
              <div className="p-2.5 rounded-lg bg-[#0e1726] border border-[#23354f] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-300">
                <div className="flex items-start space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white">
                      San Vicente NHS Action Directive ({classification.level}):
                    </span>
                    <span className="text-slate-300 block text-[10px] mt-0.5">
                      {classification.schoolProtocols}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-slate-400 shrink-0 bg-[#152338] px-2 py-1 rounded border border-[#273d5e]">
                  DepEd DO No. 037 s. 2022
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Location Selector Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#111927] border border-[#24334b] rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#24334b]">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">Select Weather Station</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Choose the monitoring weather station for real-time temperature, humidity, and PAGASA heat index calculation:
            </p>

            <div className="space-y-1.5">
              {PRESET_LOCATIONS.map((loc) => {
                const isSelected = loc.id === selectedLocationId;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      setSelectedLocationId(loc.id);
                      try {
                        localStorage.setItem(LOCATION_STORAGE_KEY, loc.id);
                      } catch {}
                      setIsLocationModalOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 text-white font-bold ring-1 ring-emerald-500'
                        : 'bg-[#152033] border-[#25364f] text-slate-300 hover:bg-[#1c2c45] hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{loc.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {loc.name}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
