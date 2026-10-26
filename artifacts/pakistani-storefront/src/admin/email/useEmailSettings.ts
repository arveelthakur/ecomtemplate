import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from '../../lib/supabase/documents';
import { db } from '../../lib/supabase/index';
import { DEFAULT_EMAIL_SETTINGS, normalizeEmailSettings, type EmailSettings } from './emailTypes';

export function useEmailSettings() {
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [loading, setLoading] = useState(Boolean(db));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!db) {
      setLoading(false);
      setError('Supabase is not configured.');
      return;
    }
    return onSnapshot(doc(db, 'emailSettings', 'config'), snapshot => {
      setSettings(snapshot.exists() ? normalizeEmailSettings(snapshot.data()) : DEFAULT_EMAIL_SETTINGS);
      setError('');
      setLoading(false);
    }, failure => {
      setError(failure instanceof Error ? failure.message : 'Email settings could not be loaded.');
      setLoading(false);
    });
  }, []);

  const save = useCallback(async (next: EmailSettings) => {
    if (!db) throw new Error('Supabase is not configured.');
    const safeSettings = normalizeEmailSettings(next);
    await setDoc(doc(db, 'emailSettings', 'config'), {
      ...safeSettings,
      updatedAt: serverTimestamp(),
    });
    setSettings(safeSettings);
    setError('');
  }, []);

  return { settings, loading, error, save };
}
