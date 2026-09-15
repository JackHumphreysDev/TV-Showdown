const token = process.env.TMDB_API_TOKEN;
const maxPage = 500;
const defaultLanguage = 'en-GB';

async function tmdb(path, params = {}) {
  if (!token) return null;
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
  return response.json();
}

const normalise = (record, kind) => ({
  tmdbId: record.id,
  kind,
  title: kind === 'movie' ? record.title : record.name,
  year: Number((kind === 'movie' ? record.release_date : record.first_air_date || '').slice(0, 4)) || null,
  posterPath: record.poster_path || null,
  overview: record.overview || '',
  popularity: Number(record.popularity) || 0,
});

const validKind = (kind) => kind === 'movie' || kind === 'series' ? [kind] : ['movie', 'series'];
const safePage = (page) => Math.min(maxPage, Math.max(1, Number.isInteger(page) ? page : 1));

function emptyCatalogue(page) {
  return { configured: false, page, totalPages: 0, totalResults: 0, results: [] };
}

async function list(kind, query, page) {
  const type = kind === 'series' ? 'tv' : 'movie';
  const endpoint = query ? `/search/${type}` : `/discover/${type}`;
  const params = query
    ? { query, language: defaultLanguage, include_adult: 'false', page: String(page) }
      : {
        language: defaultLanguage,
        include_adult: 'false',
        page: String(page),
        sort_by: 'popularity.desc',
        ...(kind === 'movie' ? { include_video: 'false', region: 'GB' } : {}),
      };
  const data = await tmdb(endpoint, params);
  return {
    kind,
    results: (data.results || []).map((record) => normalise(record, kind)),
    totalPages: Math.min(maxPage, Number(data.total_pages) || 0),
    totalResults: Number(data.total_results) || 0,
  };
}

/**
 * Returns a paginated catalogue. TMDB exposes a finite page window rather
 * than a single "download everything" response, so callers should keep
 * requesting pages until `page >= totalPages`.
 */
export async function catalogueTitles({ query = '', kind = 'both', page = 1 } = {}) {
  const currentPage = safePage(page);
  if (!token) return emptyCatalogue(currentPage);
  const cleanQuery = String(query || '').trim();
  const types = validKind(kind);
  const lists = await Promise.all(types.map((type) => list(type, cleanQuery, currentPage)));
  return {
    configured: true,
    page: currentPage,
    totalPages: Math.max(...lists.map((result) => result.totalPages), 0),
    totalResults: lists.reduce((sum, result) => sum + result.totalResults, 0),
    results: lists.flatMap((result) => result.results)
      .sort((a, b) => b.popularity - a.popularity)
      .map(({ popularity, ...result }) => result),
  };
}

export async function searchTitles(query) {
  const catalogue = await catalogueTitles({ query, kind: 'both', page: 1 });
  return { configured: catalogue.configured, results: catalogue.results.slice(0, 16) };
}

export async function titleDetails(kind, tmdbId) {
  if (!token) return { configured: false, title: null };
  const type = kind === 'series' ? 'tv' : 'movie';
  const data = await tmdb(`/${type}/${tmdbId}`, { language: defaultLanguage });
  const title = {
    ...normalise(data, kind),
    runtime: kind === 'movie' ? data.runtime || null : data.episode_run_time?.[0] || null,
    genres: (data.genres || []).map((genre) => genre.name),
    backdropPath: data.backdrop_path || null,
    voteAverage: Number(data.vote_average) || null,
    voteCount: Number(data.vote_count) || 0,
    status: data.status || null,
  };
  return { configured: true, title };
}

export async function availability(kind, tmdbId) {
  if (!token) return { configured: false, offers: [], link: null };
  const type = kind === 'series' ? 'tv' : 'movie';
  const data = await tmdb(`/${type}/${tmdbId}/watch/providers`);
  const gb = data.results?.GB;
  const categories = [
    ['flatrate', 'Subscription'], ['free', 'Free'], ['ads', 'Free with adverts'],
    ['rent', 'Rent'], ['buy', 'Buy'],
  ];
  const offers = categories.flatMap(([key, label]) =>
    (gb?.[key] || []).map((provider) => ({
      provider: provider.provider_name,
      accessType: label,
      logoPath: provider.logo_path,
    }))
  );
  return { configured: true, offers, link: gb?.link || null, checkedAt: new Date().toISOString(), source: 'JustWatch via TMDB' };
}
