const cache = require('../cache');

/**
 * Catalog handler - returns meta preview objects for requested catalog
 */
function catalogHandler(args) {
  const allScenes = cache.getAll();
  const wanted = args.id || 'stashdb-trending';

  // Filter by catalog tag
  const scenes = allScenes.filter(scene => {
    // Eski sahnelerde etiket yoksa, trending say
    if (!scene._catalogs) return wanted === 'stashdb-trending';
    return scene._catalogs.includes(wanted);
  });

  const metas = scenes.map(scene => {
    // Find landscape poster (width > height)
    let poster = null;
    if (scene.images && scene.images.length > 0) {
      // Prefer landscape images
      const landscapeImage = scene.images.find(img => 
        img.url && img.width && img.height && img.width > img.height
      );
      poster = landscapeImage?.url || scene.images[0]?.url || null;
    }

    return {
      id: `stashdb:${scene.id}`,
      type: 'movie',
      name: scene.title,
      poster: poster,
      posterShape: 'landscape',
      description: scene.details,
      releaseInfo: scene.date || scene.release_date || null
    };
  });

  return Promise.resolve({ metas });
}

module.exports = catalogHandler;