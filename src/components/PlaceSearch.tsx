
import { useState, useEffect } from 'react';
import { MapPin, Search, Key } from 'lucide-react';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';

interface PlaceSearchProps {
  onPlaceSelect: (place: { name: string; latitude: number; longitude: number }) => void;
  placeholder?: string;
  value?: string;
}

const PlaceSearch = ({ onPlaceSelect, placeholder = "Search for a place...", value = "" }: PlaceSearchProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const { apiKey, loading, saveApiKey, searchPlaces, hasApiKey } = useGoogleMaps();

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || !hasApiKey) return;

    try {
      const places = await searchPlaces(searchQuery);
      setResults(places);
      setShowResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    }
  };

  const handlePlaceSelect = (place: any) => {
    setQuery(place.formatted_address);
    setShowResults(false);
    onPlaceSelect({
      name: place.formatted_address,
      latitude: place.latitude,
      longitude: place.longitude
    });
  };

  const handleApiKeySubmit = () => {
    if (tempApiKey.trim()) {
      saveApiKey(tempApiKey.trim());
      setShowApiKeyInput(false);
      setTempApiKey('');
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.length > 2) {
        handleSearch(query);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query, hasApiKey]);

  if (!hasApiKey) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
          <Key className="w-5 h-5 text-blue-400" />
          <div className="flex-1">
            <h4 className="text-blue-300 font-medium">Google Maps API Key Required</h4>
            <p className="text-gray-400 text-sm">
              To enable place search and geocoding, please provide your Google Maps API key.
            </p>
          </div>
          <button
            onClick={() => setShowApiKeyInput(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Key
          </button>
        </div>

        {showApiKeyInput && (
          <div className="space-y-3">
            <input
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Enter your Google Maps API key"
              className="input-cosmic w-full"
            />
            <div className="flex gap-2">
              <button
                onClick={handleApiKeySubmit}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Save Key
              </button>
              <button
                onClick={() => {
                  setShowApiKeyInput(false);
                  setTempApiKey('');
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Get your API key from{' '}
              <a 
                href="https://developers.google.com/maps/documentation/geocoding/get-api-key" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Google Cloud Console
              </a>
            </p>
          </div>
        )}

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter place manually (e.g., New York, NY, USA)"
          className="input-cosmic w-full"
          disabled
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="input-cosmic w-full pl-12"
          onFocus={() => setShowResults(results.length > 0)}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-gray-600 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {results.map((place, index) => (
            <button
              key={index}
              onClick={() => handlePlaceSelect(place)}
              className="w-full text-left p-3 hover:bg-slate-700 transition-colors flex items-center gap-3 first:rounded-t-xl last:rounded-b-xl"
            >
              <MapPin className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span className="text-gray-200 text-sm">{place.formatted_address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaceSearch;
