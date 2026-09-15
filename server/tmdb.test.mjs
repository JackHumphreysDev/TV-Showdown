import test, { after } from 'node:test';
import assert from 'node:assert/strict';

process.env.TMDB_API_TOKEN = 'test-token';
const requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = new URL(input);
  requests.push(url);
  const result = url.pathname.endsWith('/discover/movie')
    ? { page: Number(url.searchParams.get('page')), total_pages: 4, total_results: 60, results: [{ id: 1, title: 'A film', release_date: '2024-02-03', popularity: 4, poster_path: '/film.jpg', overview: 'Film overview' }] }
    : url.pathname.endsWith('/discover/tv')
      ? { page: Number(url.searchParams.get('page')), total_pages: 3, total_results: 45, results: [{ id: 2, name: 'A series', first_air_date: '2023-04-05', popularity: 8, poster_path: '/series.jpg', overview: 'Series overview' }] }
      : url.pathname.endsWith('/search/movie')
        ? { page: 3, total_pages: 3, total_results: 21, results: [{ id: 3, title: 'Searched film', release_date: '2020-01-01', popularity: 2 }] }
        : { id: 4, name: 'Detailed series', first_air_date: '2022-01-01', popularity: 3, poster_path: '/detail.jpg', overview: 'Detailed overview', episode_run_time: [48], genres: [{ name: 'Drama' }], backdrop_path: '/backdrop.jpg', vote_average: 7.4, vote_count: 120, status: 'Returning Series' };
  return { ok: true, json: async () => result };
};

const { catalogueTitles, titleDetails } = await import(`./tmdb.mjs?test=${Date.now()}`);

after(() => {
  globalThis.fetch = originalFetch;
  delete process.env.TMDB_API_TOKEN;
});

test('catalogue returns paginated movies and series with UK language settings', async () => {
  const result = await catalogueTitles({ kind: 'both', page: 2 });
  assert.equal(result.configured, true);
  assert.equal(result.page, 2);
  assert.equal(result.totalPages, 4);
  assert.equal(result.totalResults, 105);
  assert.deepEqual(result.results.map(({ title, kind }) => ({ title, kind })), [
    { title: 'A series', kind: 'series' },
    { title: 'A film', kind: 'movie' },
  ]);
  const movieRequest = requests.find((request) => request.pathname.endsWith('/discover/movie'));
  assert.equal(movieRequest.searchParams.get('language'), 'en-GB');
  assert.equal(movieRequest.searchParams.get('region'), 'GB');
});

test('catalogue supports a paginated movie search', async () => {
  const result = await catalogueTitles({ query: 'searched', kind: 'movie', page: 3 });
  assert.equal(result.page, 3);
  assert.equal(result.totalPages, 3);
  assert.equal(result.results[0].title, 'Searched film');
  const request = requests.at(-1);
  assert.equal(request.pathname, '/3/search/movie');
  assert.equal(request.searchParams.get('query'), 'searched');
});

test('title details include runtime, genres and ratings', async () => {
  const result = await titleDetails('series', 4);
  assert.equal(result.configured, true);
  assert.deepEqual(result.title.genres, ['Drama']);
  assert.equal(result.title.runtime, 48);
  assert.equal(result.title.voteAverage, 7.4);
  assert.equal(result.title.backdropPath, '/backdrop.jpg');
});
