const JUBAIL = { lat: 27.0, lon: 49.66, name: "Jubail 2nd Industrial Area" };
const REFRESH_MS = 5 * 60 * 1000;

const LEVEL_RANK = {
  reference: 0,
  safe: 1,
  clear: 1,
  ok: 1,
  caution: 2,
  warn: 2,
  high: 3,
  extreme: 3,
  stop: 4,
};

const VERIFY_LINKS = [
  { label: "OpenWeatherMap", href: "https://openweathermap.org/" },
  { label: "Weather Underground", href: "https://www.wunderground.com/" },
  { label: "AccuWeather", href: "https://www.accuweather.com/" },
  { label: "Windy.com", href: "https://www.windy.com/" },
];

let cache = null;

export function levelRank(level) {
  return LEVEL_RANK[level] ?? 0;
}

export function worstLevel(levels) {
  let winner = "safe";
  for (const level of levels) {
    if (levelRank(level) > levelRank(winner)) winner = level;
  }
  return winner;
}

function vaporPressureHpa(tempC, rh) {
  return (rh / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
}

export function estimateWbgt(tempC, rh) {
  const e = vaporPressureHpa(tempC, rh);
  return 0.567 * tempC + 0.393 * e + 3.94;
}

export function scoreWindKmh(kmh) {
  if (kmh >= 48) return "stop";
  if (kmh >= 32) return "warn";
  return "safe";
}

export function scoreRain(mmPerHour, weatherCode, hasThunder) {
  if (hasThunder) return "stop";
  const rate = mmPerHour ?? 0;
  if (rate >= 7.6) return "stop";
  if (rate >= 2.5) return "warn";
  if (weatherCode === 65 || weatherCode === 66 || weatherCode === 67 || weatherCode === 82) return "stop";
  if (weatherCode === 63 || weatherCode === 81) return "warn";
  if (rate > 0.1) return "warn";
  return "safe";
}

export function scoreLightning(hasThunder) {
  return hasThunder ? "stop" : "clear";
}

export function scoreWbgt(wbgt) {
  if (wbgt >= 35) return "stop";
  if (wbgt >= 33) return "high";
  if (wbgt >= 28) return "caution";
  return "safe";
}

export function scoreTemperature(tempC) {
  if (tempC >= 45) return "extreme";
  if (tempC >= 40) return "high";
  if (tempC >= 33) return "caution";
  return "ok";
}

export function scoreVisibility(meters) {
  if (meters == null || Number.isNaN(meters)) return "safe";
  if (meters < 200) return "stop";
  if (meters < 500) return "warn";
  return "safe";
}

export function scoreHumidity(rh) {
  if (rh >= 95) return "stop";
  if (rh >= 80) return "warn";
  return "ok";
}

function levelLabel(level) {
  const map = {
    stop: "STOP",
    warn: "WARN",
    caution: "CAUTION",
    high: "HIGH",
    extreme: "EXTREME",
    safe: "SAFE",
    clear: "CLEAR",
    ok: "OK",
    reference: "REF",
  };
  return map[level] || level.toUpperCase();
}

function toneFor(level) {
  if (level === "stop") return "bad";
  if (level === "high" || level === "extreme") return "warn";
  if (level === "warn" || level === "caution") return "caution";
  if (level === "reference") return "info";
  return "good";
}

function tile(id, label, display, level, hint, statusLabel) {
  return {
    id,
    label,
    display,
    level,
    status: statusLabel || levelLabel(level),
    hint,
    tone: toneFor(level),
  };
}

export function buildSnapshot(reading) {
  const {
    source,
    condition,
    fetchedAt,
    windKmh,
    rainMmH,
    tempC,
    feelsC,
    rh,
    pressureHpa,
    visibilityM,
    weatherCode,
    hasThunder,
  } = reading;
  const wbgt = estimateWbgt(tempC, rh);
  const rainLevel = scoreRain(rainMmH, weatherCode, false);
  const lightningLevel = scoreLightning(hasThunder);
  const tiles = [
    tile("wind", "Wind speed", `${Math.round(windKmh)} km/h`, scoreWindKmh(windKmh), "STOP ≥48 | WARN ≥32"),
    tile("rain", "Rain", rainMmH >= 0.1 ? `${rainMmH.toFixed(1)} mm/h` : "NONE", rainLevel, "heavy=STOP | moderate=WARN"),
    tile("lightning", "Lightning", hasThunder ? "DETECTED" : "CLEAR", lightningLevel, "Any detection = STOP"),
    tile("wbgt", "WBGT (Est.)", `${Math.round(wbgt)}°C`, scoreWbgt(wbgt), "STOP ≥35 | HIGH ≥33 | CAUTION ≥28"),
    tile("temperature", "Temperature", `${Math.round(tempC)}°C`, scoreTemperature(tempC), "EXTREME ≥45 | HIGH ≥40 | CAUTION ≥33"),
    tile("feels", "Feels like", `${Math.round(feelsC)}°C`, scoreTemperature(feelsC), "Heat stress index"),
    tile(
      "visibility",
      "Visibility",
      visibilityM != null ? `${Math.round(visibilityM)} m` : "—",
      scoreVisibility(visibilityM),
      "STOP <200 | WARN <500",
    ),
    tile("humidity", "Humidity", `${Math.round(rh)}%`, scoreHumidity(rh), "STOP ≥95% | WARN ≥80%"),
    {
      id: "pressure",
      label: "Pressure",
      display: `${Math.round(pressureHpa)} hPa`,
      level: "reference",
      status: "REF",
      hint: "Reference only",
      tone: "info",
    },
  ];
  const overall = worstLevel(tiles.filter((t) => t.level !== "reference").map((t) => t.level));
  return {
    source,
    location: JUBAIL.name,
    condition,
    fetchedAt,
    refreshSeconds: REFRESH_MS / 1000,
    overall: { level: overall, label: levelLabel(overall) },
    tiles,
    verifyLinks: VERIFY_LINKS,
    sop: "INMA-HSE-SOP-59",
    raw: { windKmh, rainMmH, tempC, feelsC, rh, pressureHpa, visibilityM, wbgt, hasThunder, weatherCode },
  };
}

function openMeteoThunder(code) {
  return code === 95 || code === 96 || code === 99;
}

async function fetchOpenMeteo() {
  const params = new URLSearchParams({
    latitude: String(JUBAIL.lat),
    longitude: String(JUBAIL.lon),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "weather_code",
      "wind_speed_10m",
      "surface_pressure",
    ].join(","),
    wind_speed_unit: "kmh",
    timezone: "Asia/Riyadh",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error("Open-Meteo request failed");
  const data = await response.json();
  const c = data.current;
  const code = c.weather_code;
  const labels = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "depositing rime fog",
    51: "light drizzle",
    61: "rain",
    63: "moderate rain",
    65: "heavy rain",
    95: "thunderstorm",
  };
  return {
    source: "open-meteo",
    condition: labels[code] || "current conditions",
    fetchedAt: new Date().toISOString(),
    windKmh: c.wind_speed_10m,
    rainMmH: c.rain ?? c.precipitation ?? 0,
    tempC: c.temperature_2m,
    feelsC: c.apparent_temperature,
    rh: c.relative_humidity_2m,
    pressureHpa: c.surface_pressure,
    visibilityM: code === 45 || code === 48 ? 300 : 10000,
    weatherCode: code,
    hasThunder: openMeteoThunder(code),
  };
}

async function fetchOpenWeather() {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  const params = new URLSearchParams({
    lat: String(JUBAIL.lat),
    lon: String(JUBAIL.lon),
    appid: key,
    units: "metric",
  });
  const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params}`);
  if (!response.ok) throw new Error("OpenWeatherMap request failed");
  const data = await response.json();
  const id = data.weather?.[0]?.id ?? 800;
  const hasThunder = id >= 200 && id < 300;
  return {
    source: "openweathermap",
    condition: data.weather?.[0]?.description || "current conditions",
    fetchedAt: new Date().toISOString(),
    windKmh: (data.wind?.speed ?? 0) * 3.6,
    rainMmH: data.rain?.["1h"] ?? 0,
    tempC: data.main?.temp ?? 0,
    feelsC: data.main?.feels_like ?? data.main?.temp ?? 0,
    rh: data.main?.humidity ?? 0,
    pressureHpa: data.main?.pressure ?? 0,
    visibilityM: data.visibility ?? 10000,
    weatherCode: id,
    hasThunder,
  };
}

async function fetchLiveReading() {
  if (process.env.HSE_WEATHER_FIXTURE) {
    return JSON.parse(process.env.HSE_WEATHER_FIXTURE);
  }
  try {
    const owm = await fetchOpenWeather();
    if (owm) return owm;
  } catch (error) {
    console.warn("OpenWeatherMap failed, falling back to Open-Meteo", error.message);
  }
  return fetchOpenMeteo();
}

export function getCachedWeather() {
  if (!cache) return null;
  if (Date.now() - cache.at > REFRESH_MS) return null;
  return cache.snapshot;
}

export async function refreshWeatherReading({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < REFRESH_MS) return cache.snapshot;
  const reading = await fetchLiveReading();
  const snapshot = buildSnapshot(reading);
  cache = { at: Date.now(), snapshot, reading };
  return snapshot;
}

export function snapshotForTests(reading) {
  return buildSnapshot({ ...reading, fetchedAt: reading.fetchedAt || new Date().toISOString() });
}
