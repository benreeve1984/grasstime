'use client';

import React, { useState, ChangeEvent } from 'react';

interface WeatherResult {
  postcode: string;
  latitude: number;
  longitude: number;
  daysAbove8: number;
  frostDays: number;
  recommendation: string;
  rating: string;
}

export default function Home() {
  const [postcode, setPostcode] = useState('HP18 9HE');
  const [results, setResults] = useState<WeatherResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Constants for logic
  const DAYS_TO_CHECK = 14;
  const TEMP_AVG_THRESHOLD = 8;
  const FROST_THRESHOLD = 2;
  const REQUIRED_DAYS_ABOVE_8 = 10;
  const ALLOWED_FROST_DAYS = 2;

  const handlePostcodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPostcode(e.target.value);
  };

  const getRecommendationColor = (recommendation: string) => {
    if (recommendation.includes('Go')) {
      return 'bg-green-50 border-green-200';
    } else if (recommendation.includes('Marginal')) {
      return 'bg-amber-50 border-amber-200';
    } else {
      return 'bg-red-50 border-red-200';
    }
  };

  const checkWeather = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // 1) Get lat/long from postcodes.io
      const postcodeData = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
      if (!postcodeData.ok) {
        throw new Error(`Postcode error: ${postcodeData.statusText}`);
      }
      const postcodeJson = await postcodeData.json();

      if (postcodeJson.status !== 200 || !postcodeJson.result) {
        throw new Error(`Invalid postcode response: ${postcodeJson.error}`);
      }

      const { latitude, longitude } = postcodeJson.result;

      // 2) Get 16-day daily forecast from Open-Meteo
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min&forecast_days=16&timezone=Europe%2FLondon`;
      const forecastResp = await fetch(forecastUrl);
      if (!forecastResp.ok) {
        throw new Error(`Forecast error: ${forecastResp.statusText}`);
      }
      const forecastJson = await forecastResp.json();

      const dailyMax = forecastJson.daily.temperature_2m_max;
      const dailyMin = forecastJson.daily.temperature_2m_min;

      // 3) Apply the sowing logic
      let daysAbove8 = 0;
      let frostDays = 0;

      const daysAvailable = Math.min(dailyMax.length, DAYS_TO_CHECK);

      for (let i = 0; i < daysAvailable; i++) {
        const tMax = dailyMax[i];
        const tMin = dailyMin[i];
        const tAvg = (tMax + tMin) / 2;

        if (tAvg >= TEMP_AVG_THRESHOLD) {
          daysAbove8++;
        }
        if (tMin < FROST_THRESHOLD) {
          frostDays++;
        }
      }

      // 4) Determine recommendation & rating
      let recommendation = "No-Go (Wait)";
      if (daysAbove8 >= REQUIRED_DAYS_ABOVE_8 && frostDays <= ALLOWED_FROST_DAYS) {
        recommendation = "Go (Good/Excellent)";
      }

      let rating = "Poor";
      if (daysAbove8 >= 12 && frostDays <= 1) {
        rating = "Excellent";
      } else if (daysAbove8 >= 10 && frostDays <= 2) {
        rating = "Good";
      } else if (daysAbove8 >= 5) {
        rating = "Marginal";
      }

      setResults({
        postcode,
        latitude,
        longitude,
        daysAbove8,
        frostDays,
        recommendation,
        rating
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Should I Seed My Grass?</h1>
          <p className="text-lg text-gray-600">Get personalized advice based on your location&apos;s weather forecast</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8">
          <div className="space-y-4">
            <div>
              <label htmlFor="postcode-input" className="block text-sm font-medium text-gray-700 mb-2">
                Enter a UK Postcode
              </label>
              <input
                type="text"
                id="postcode-input"
                value={postcode}
                onChange={handlePostcodeChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., HP18 9HE"
              />
            </div>
            <button
              onClick={checkWeather}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Checking...' : 'Check Planting Advice'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-8">
            {error}
          </div>
        )}

        {results && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4">14-Day Weather</h2>
              <p><strong>Days with Avg &ge; {TEMP_AVG_THRESHOLD}°C:</strong> {results.daysAbove8}<br/>
                 <strong>Days with Min &lt; {FROST_THRESHOLD}°C:</strong> {results.frostDays}</p>
            </div>
            
            <div className={`p-6 rounded-lg shadow-sm border ${getRecommendationColor(results.recommendation)}`}>
              <h2 className="text-xl font-semibold mb-4">Recommendation</h2>
              <p className="text-lg"><strong>{results.recommendation}</strong></p>
              <p className="mt-2"><strong>Overall Rating:</strong> {results.rating}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 