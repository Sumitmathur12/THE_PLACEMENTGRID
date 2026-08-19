const cache = new Map();

export const getUnsplashImage = async (query) => {
  const normalizedQuery = query.toLowerCase().trim();
  
  if (cache.has(normalizedQuery)) {
    return cache.get(normalizedQuery);
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    // Elegant fallback to free Unsplash Source URL layout
    const fallbackUrl = `https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80`;
    cache.set(normalizedQuery, fallbackUrl);
    return fallbackUrl;
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`
        }
      }
    );
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const url = data.results[0].urls.regular;
      cache.set(normalizedQuery, url);
      return url;
    }
  } catch (error) {
    console.error('Unsplash API fetch failed:', error.message);
  }

  const defaultFallback = `https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80`;
  cache.set(normalizedQuery, defaultFallback);
  return defaultFallback;
};
