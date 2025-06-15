
import { useState, useEffect } from 'react';
import { MapPin, Search } from 'lucide-react';
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
  const { loading, searchPlaces } = useGoogleMaps();

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    try {
      const places = await searchPlaces(searchQuery);
      setResults(places);
      setShowResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setShowResults(false);
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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.length > 2) {
        handleSearch(query);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query]);

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
