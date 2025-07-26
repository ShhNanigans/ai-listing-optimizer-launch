/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// API Utility Functions with Caching and Optimization

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

const apiCache = new APICache();

// Cleanup expired cache entries every 5 minutes
setInterval(() => apiCache.cleanup(), 5 * 60 * 1000);

interface APIRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  cache?: boolean;
  cacheTTL?: number;
  timeout?: number;
}

export const apiRequest = async <T>(
  endpoint: string,
  options: APIRequestOptions = {}
): Promise<T> => {
  const {
    method = 'GET',
    body,
    headers = {},
    cache = false,
    cacheTTL,
    timeout = 30000
  } = options;

  // Create cache key for GET requests
  const cacheKey = method === 'GET' ? `${endpoint}${JSON.stringify(body || {})}` : '';
  
  // Return cached response if available
  if (cache && cacheKey && method === 'GET') {
    const cached = apiCache.get<T>(cacheKey);
    if (cached) return cached;
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      signal: controller.signal
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, requestInit);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Cache successful GET responses
    if (cache && cacheKey && method === 'GET') {
      apiCache.set(cacheKey, data, cacheTTL);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    
    throw error;
  }
};

// Specific API functions with optimized error handling
export const generateAnalysis = async (listing: string): Promise<{ content: string; sources: any[] }> => {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const content = await response.text();
    const sourcesHeader = response.headers.get('x-sources');
    const sources = sourcesHeader ? JSON.parse(decodeURIComponent(sourcesHeader)) : [];

    return { content, sources };
  } catch (error) {
    console.error('Analysis generation failed:', error);
    throw new Error('Failed to generate analysis. Please try again.');
  }
};

export const generateABTest = async (analysis: any): Promise<any> => {
  return apiRequest('/api/ab-test', {
    method: 'POST',
    body: { analysis },
    timeout: 15000
  });
};

export const generatePromoContent = async (analysis: any): Promise<any> => {
  return apiRequest('/api/promo', {
    method: 'POST',
    body: { analysis },
    timeout: 15000
  });
};

export const generateFAQs = async (analysis: any): Promise<any> => {
  return apiRequest('/api/faq', {
    method: 'POST',
    body: { analysis },
    timeout: 15000
  });
};

// Request queue for managing concurrent requests
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private readonly maxConcurrent = 3;

  async add<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests++;
    try {
      await request();
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }
}

export const requestQueue = new RequestQueue();