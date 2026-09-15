import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type Kind = 'movie' | 'series';
export type Status = 'want' | 'watching' | 'watched';
export type Me = { id: string; email: string; profile_id: string; name: string; colour: string; active: number };
export type Member = { accountId: string; profileId: string; name: string; colour: string; active: number; role: 'owner' | 'member' };
export type Item = { id: string; title: string; kind: Kind; year?: number | null; tmdbId?: number | null; posterPath?: string | null; overview?: string | null; status: Status; profileId?: string; accountId?: string };
export type Group = { id: string; name: string; region: string; role: string; memberCount?: number; members?: Member[]; watchlists?: Item[] };
export type Result = { id: string; watchlistItemId: string; title: string; kind: Kind; year?: number | null; tmdbId?: number | null; posterPath?: string | null; overview?: string | null; profile_name: string; state: string };
export type Spin = { id: string; state: string; version: number; winnerProfileId: string; result: Result; canSkip: boolean };
export type SearchResult = { tmdbId: number; title: string; kind: Kind; year?: number | null; posterPath?: string | null; overview?: string; popularity?: number };
export type CatalogueResponse = { configured: boolean; page: number; totalPages: number; totalResults: number; results: SearchResult[] };
export type CatalogueTitle = SearchResult & { runtime?: number | null; genres?: string[]; backdropPath?: string | null; voteAverage?: number | null; voteCount?: number; status?: string | null };
export type CatalogueDetailsResponse = { configured: boolean; title: CatalogueTitle | null };
export type Offer = { provider: string; accessType: string };
export type Availability = { configured: boolean; offers: Offer[]; link?: string | null; checkedAt?: string; source?: string };
export type HistoryRow = {
  id: string;
  sessionId: string;
  sessionState: 'active' | 'accepted' | 'superseded' | 'cancelled';
  roundStartedAt: string;
  createdAt: string;
  winnerName: string;
  title: string;
  kind: Kind;
  year?: number | null;
  resultState: 'pending' | 'skipped' | 'accepted';
};

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export async function getToken() {
  return Platform.OS === 'web' ? localStorage.getItem('tv-showdown-token') : SecureStore.getItemAsync('tv-showdown-token');
}
export async function setStoredToken(token: string | null) {
  if (Platform.OS === 'web') {
    if (token) localStorage.setItem('tv-showdown-token', token);
    else localStorage.removeItem('tv-showdown-token');
  } else if (token) await SecureStore.setItemAsync('tv-showdown-token', token);
  else await SecureStore.deleteItemAsync('tv-showdown-token');
}
export async function api<T>(path: string, token: string | null, method = 'GET', data?: object): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Something went wrong');
  return json as T;
}
