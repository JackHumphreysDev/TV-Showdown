const token = process.env.TMDB_API_TOKEN;

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
});

export async function searchTitles(query) {
  if (!token) return { configured: false, results: [] };
  const [movies, series] = await Promise.all([
    tmdb('/search/movie', { query, language: 'en-GB', include_adult: 'false' }),
    tmdb('/search/tv', { query, language: 'en-GB', include_adult: 'false' }),
  ]);
  return {
    configured: true,
    results: [
      ...movies.results.slice(0, 8).map((r) => normalise(r, 'movie')),
      ...series.results.slice(0, 8).map((r) => normalise(r, 'series')),
    ],
  };
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
