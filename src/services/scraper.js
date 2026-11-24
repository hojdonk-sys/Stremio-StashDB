const stashdb = require('./stashdb');
const easynews = require('./easynews');
const cache = require('../cache');

/**
 * Check if date components appear in the correct order in the string
 */
function validateDateOrder(str, yy, mm, dd) {
  const yyIndex = str.indexOf(yy);
  const mmIndex = str.indexOf(mm);
  const ddIndex = str.indexOf(dd);

  // All components must be present and in correct order
  return yyIndex !== -1 && mmIndex !== -1 && ddIndex !== -1 &&
         yyIndex < mmIndex && mmIndex < ddIndex;
}

/**
 * Filter Easynews results based on date order and optional duration
 */
function filterResults(dataItems, yy, mm, dd, expectedDuration = null) {
  return dataItems.filter(item => {
    const postTitle = item['10'] || '';
    
    // Check date order
    if (!validateDateOrder(postTitle, yy, mm, dd)) {
      return false;
    }

    // If duration is provided, check duration match (within 5 seconds tolerance)
    if (expectedDuration) {
      const actualDuration = easynews.getDuration(item);
      
      if (actualDuration && Math.abs(actualDuration - expectedDuration) > 5) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sort results by resolution (highest first)
 */
function sortByResolution(dataItems) {
  return dataItems.sort((a, b) => {
    const resA = easynews.getResolution(a);
    const resB = easynews.getResolution(b);
    return resB - resA; // Descending order
  });
}

/**
 * Process a single scene: search Easynews and cache if found
 */
async function processScene(scene, config, catalogId = 'stashdb-trending') {
  const searchQuery = stashdb.buildSearchQuery(scene);
  
  if (!searchQuery) {
    console.log(`Skipping scene ${scene.id}: No valid search query`);
    return false;
  }

  console.log(`Searching for: ${scene.title} (query: ${searchQuery})`);

  const searchResponse = await easynews.search(
    config.easynewsUsername,
    config.easynewsPassword,
    searchQuery
  );

  if (!searchResponse || !searchResponse.data || searchResponse.data.length === 0) {
    console.log(`No results found for: ${scene.title}`);
    return false;
  }

  // Get date info for filtering
  const dateInfo = stashdb.formatDateForQuery(scene.date || scene.release_date);
  
  // Filter results by date order
  let filteredResults = filterResults(
    searchResponse.data,
    dateInfo.yy,
    dateInfo.mm,
    dateInfo.dd,
    scene.duration
  );

  if (filteredResults.length === 0) {
    console.log(`No matching results after filtering for: ${scene.title}`);
    return false;
  }

  // Sort by resolution
  filteredResults = sortByResolution(filteredResults);

  // Build URLs (without credentials)
  const urlPrefix = easynews.getUrlPrefix(searchResponse);
  const results = filteredResults.map(item => ({
    url: easynews.buildUrl(urlPrefix, item),
    filename: item['10'] || item.fn,
    resolution: easynews.getResolution(item),
    codec: easynews.getCodec(item),
    size: item.size || item.rawSize,
    sizeFormatted: easynews.formatSize(item['4'] || item.size || item.rawSize),
    duration: easynews.getDuration(item)
  }));

  // Cache the scene with results + catalog tag
  const existing = cache.get(scene.id);
  const catalogs = existing && existing._catalogs ? [...existing._catalogs] : [];
  if (!catalogs.includes(catalogId)) catalogs.push(catalogId);

  cache.set(scene.id, {
    ...scene,
    _catalogs: catalogs,
    easynewsResults: results
  });

  console.log(`Cached ${results.length} results for: ${scene.title}`);
  return true;
}

/**
 * Scrape trending scenes and cache them
 * Uses environment variables for credentials
 */
async function scrape() {
  console.log('\n=== Starting scrape ===');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // Get credentials from environment
    const easynewsUsername = process.env.EASYNEWS_USERNAME;
    const easynewsPassword = process.env.EASYNEWS_PASSWORD;
    const stashdbApiKey = process.env.STASHDB_API_KEY;

    if (!easynewsUsername || !easynewsPassword || !stashdbApiKey) {
      console.error('Missing required environment variables for scraping');
      return;
    }

    const config = { easynewsUsername, easynewsPassword, stashdbApiKey };

    // Clear cache before starting new scrape to replace old data
    cache.clear();
    console.log('Cache cleared');

    // Fetch trending scenes from StashDB - 20
    const targetCount = parseInt(process.env.SCRAPE_COUNT || '20', 10);
    const scenes = await stashdb.getTrendingScenes(config.stashdbApiKey, targetCount);
    console.log(`Found ${scenes.length} trending scenes from StashDB`);

    if (scenes.length === 0) {
      console.log('No trending scenes, continuing to studios...');
    }

    // Process each scene - trending
    let successCount = 0;
    for (const scene of scenes) {
      const success = await processScene(scene, config, 'stashdb-trending');
      if (success) successCount++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Process studio scenes - 4 studios
    const studios = [
      { id: 'stashdb-studio1', stashdbId: '39cee498-a9ac-4403-910a-1a0157ad22d8', name: 'Brazzers Exxtra', limit: 100 },
      { id: 'stashdb-studio2', stashdbId: '0f1d8e2c-627e-4d05-a52e-c821b26cab0c', name: 'Evil Angel', limit: 200 },
      { id: 'stashdb-studio3', stashdbId: '5594ba40-e1ba-4e7e-b2c3-14e9bf101bd5', name: 'Her Limit', limit: 150 },
      { id: 'stashdb-studio4', stashdbId: 'f23972b2-6337-43cf-89fa-db78eebf008c', name: 'Anal Vids', limit: 250 },
    ];

    for (const st of studios) {
      console.log(`Fetching studio: ${st.name}`);
      const studioScenes = await stashdb.getStudioScenes(config.stashdbApiKey, st.stashdbId, st.limit);
      console.log(`Found ${studioScenes.length} scenes for ${st.name}`);
      for (const scene of studioScenes) {
        const success = await processScene(scene, config, st.id);
        if (success) successCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\nScrape complete: ${successCount} scenes cached`);
    console.log(`Cache size: ${cache.size()} scenes`);
  } catch (error) {
    console.error('Scrape error:', error);
  }

  console.log('=== Scrape finished ===\n');
}

/**
 * Start the scraper with initial scrape and 24h interval
 * Uses environment variables for credentials
 */
function startScraper() {
  console.log('Starting scraper...');
  
  // Run initial scrape
  scrape();

  // Schedule scraping every 24 hours (86400000 ms)
  const interval = setInterval(() => {
    scrape();
  }, 24 * 60 * 60 * 1000);

  return interval;
}

module.exports = {
  scrape,
  startScraper,
  validateDateOrder,
  filterResults,
  sortByResolution,
  processScene
};