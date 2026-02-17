import { useState, useEffect } from "react";

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
  denied: boolean;
}

/**
 * Hook do zarządzania geolokalizacją użytkownika
 * Automatycznie pobiera lokalizację przy montowaniu komponentu
 */
export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    loading: true,
    error: null,
    denied: false,
  });

  useEffect(() => {
    // Sprawdź czy geolokalizacja jest dostępna
    if (!navigator.geolocation) {
      setState({
        latitude: null,
        longitude: null,
        loading: false,
        error: "Geolokalizacja nie jest dostępna w tej przeglądarce",
        denied: false,
      });
      return;
    }

    // Pobierz lokalizację użytkownika
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          loading: false,
          error: null,
          denied: false,
        });
      },
      (error) => {
        let errorMessage = "Nie udało się pobrać lokalizacji";
        let isDenied = false;

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Użytkownik odmówił dostępu do lokalizacji";
            isDenied = true;
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Informacje o lokalizacji są niedostępne";
            break;
          case error.TIMEOUT:
            errorMessage = "Przekroczono limit czasu pobierania lokalizacji";
            break;
          default:
            errorMessage = "Wystąpił nieznany błąd podczas pobierania lokalizacji";
        }

        setState({
          latitude: null,
          longitude: null,
          loading: false,
          error: errorMessage,
          denied: isDenied,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minut
      }
    );
  }, []);

  return state;
}
