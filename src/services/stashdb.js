const axios = require('axios');

const STASHDB_URL = 'https://stashdb.org/graphql';

const TRENDING_SCENES_QUERY = `
  query QueryScenes($page: Int!) {
    queryScenes(input: { page: $page, per_page: 25, sort: TRENDING }) {
      scenes {
        id
        title
        details
        date
        studio {
          id
          name
        }
        tags {
          name
          id
        }
        images {
          url
          width
          height
        }
      }
      count
    }
  }
`;

const STUDIO_SCENES_QUERY = `
  query QueryScenes($page: Int!, $studioId: ID!) {
    queryScenes(input: { page: $page, per_page: 25, sort: DATE, direction: DESC, studios: { value: [$studioId], modifier: INCLUDES } }) {
      scenes {
        id
        title
        details
        date
        studio {
          id
          name
        }
        tags {
          name
          id
        }
        images {
          url
          width
          height
        }
      }
      count
    }
  }
`;

async function getTrendingScenes(apiKey, targetCount = 100) {
  const allScenes = [];
  const perPage = 25;
  const maxPages = Math.ceil(targetCount / perPage);
  try {
    for (let page = 1; page <= maxPages; page++) {
      const response = await axios.post(
        STASHDB_URL,
        { query: TRENDING_SCENES_QUERY, variables: { page } },
        { headers: { 'apikey': apiKey, 'Content-Type': 'application/json' } }
      );
      if (response.data.errors) {
        console.error('StashDB GraphQL errors:', response.data.errors);
        break;
      }
      const scenes = response.data.data.queryScenes.scenes || [];
      allScenes.push(...scenes);
      console.log(`  Fetched page ${page}: ${scenes.length} scenes`);
      if (scenes.length < perPage) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return allScenes;
  } catch (error) {
    console.error('StashDB API error:', error.message);
    if (error.response) console.error('StashDB response:', JSON.stringify(error.response.data));
    return allScenes;
  }
}

async function getStudioScenes(apiKey, studioId, targetCount = 50) {
  const allScenes = [];
  const perPage = 25;
  const maxPages = Math.ceil(targetCount / perPage);
  try {
    for (let page = 1; page <= maxPages; page++) {
      const response = await axios.post(
        STASHDB_URL,
        { query: STUDIO_SCENES_QUERY, variables: { page, studioId } },
        { headers: { 'apikey': apiKey, 'Content-Type': 'application/json' } }
      );
      if (response.data.errors) {
        console.error('StashDB GraphQL errors:', response.data.errors);
        break;
      }
      const scenes = response.data.data.queryScenes.scenes || [];
      allScenes.push(...scenes);
      console.log(`  Fetched studio page ${page}: ${scenes.length} scenes`);
      if (scenes.length < perPage) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return allScenes;
  } catch (error) {
    console.error('StashDB API error:', error.message);
    if (error.response) console.error('StashDB response:', JSON.stringify(error.response.data));
    return allScenes;
  }
}

function formatDateForQuery(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return { yy, mm, dd };
}

function formatStudioName(studioName) {
  if (!studioName) return null;
  return studioName.replace(/[^a-zA-Z0-9]/g, '');
}

function buildSearchQuery(scene) {
  const dateInfo = formatDateForQuery(scene.date);
  if (!dateInfo) return null;
  const studioName = formatStudioName(scene.studio?.name);
  if (!studioName) return null;
  return `${studioName}.${dateInfo.yy}.${dateInfo.mm}.${dateInfo.dd}`;
}

module.exports = {
  getTrendingScenes,
  getStudioScenes,
  formatDateForQuery,
  formatStudioName,
  buildSearchQuery
};
