/**
 * Performance optimization utilities for React components and API calls
 */

// Debounce function to limit API calls
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

// Throttle function to limit execution frequency
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Memoization helper for expensive computations
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Intersection Observer for lazy loading and performance
export function createIntersectionObserver(
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  return new IntersectionObserver(callback, {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  });
}

// Virtual scrolling helper for large lists
export function createVirtualScroller<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  scrollTop: number
): { startIndex: number; endIndex: number; visibleItems: T[] } {
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  return {
    startIndex,
    endIndex,
    visibleItems: items.slice(startIndex, endIndex),
  };
}

// API call batching utility
export class ApiBatcher<T> {
  private batch: T[] = [];
  private timeout: NodeJS.Timeout | null = null;
  private batchSize: number;
  private delay: number;
  private processor: (items: T[]) => Promise<void>;

  constructor(
    processor: (items: T[]) => Promise<void>,
    batchSize = 10,
    delay = 100
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.delay = delay;
  }

  add(item: T): void {
    this.batch.push(item);
    
    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), this.delay);
    }
  }

  async flush(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.batch.length > 0) {
    const items = [...this.batch];
    this.batch = [];
      await this.processor(items);
    }
  }
}

// Request deduplication to prevent duplicate API calls
export class RequestDeduplicator<T> {
  private pendingRequests = new Map<string, Promise<T>>();

  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const promise = requestFn();
    this.pendingRequests.set(key, promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
}

// Cache management utility
export class CacheManager<K, V> {
  private cache = new Map<K, { value: V; timestamp: number; ttl: number }>();

  set(key: K, value: V, ttl = 5 * 60 * 1000): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Performance monitoring utility
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  startTimer(label: string): () => void {
    const start = performance.now();
    return () => this.endTimer(label, start);
  }

  private endTimer(label: string, start: number): void {
    const duration = performance.now() - start;
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);
  }

  getMetrics(label: string): { avg: number; min: number; max: number; count: number } {
    const values = this.metrics.get(label) || [];
    if (values.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

// React-specific performance utilities
export const ReactPerformanceUtils = {
  // Memoization helper for expensive calculations
  useMemoizedCallback: <T extends (...args: any[]) => any>(
    callback: T,
    deps: React.DependencyList
  ): T => {
    // This is a placeholder - in actual usage, use React.useCallback
    return callback;
  },

  // Prevent unnecessary re-renders
  shouldComponentUpdate: <T extends Record<string, any>>(
    prevProps: T,
    nextProps: T,
    keysToCompare: (keyof T)[]
  ): boolean => {
    return keysToCompare.some(key => prevProps[key] !== nextProps[key]);
  },

  // Deep comparison for objects
  deepEqual: (a: any, b: any): boolean => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      return keysA.every(key => deepEqual(a[key], b[key]));
    }
    
    return false;
  },
};

// Export the deepEqual function separately for convenience
const { deepEqual } = ReactPerformanceUtils;
export { deepEqual };
