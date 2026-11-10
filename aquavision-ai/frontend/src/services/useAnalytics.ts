import { useEffect, useState } from 'react';
import { fetchAnalytics } from './api';
import type { Analytics } from '../types';

export function useAnalytics() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAnalytics()
      .then((data) => {
        if (active) setAnalytics(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Analytics could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { analytics, loading, error };
}
