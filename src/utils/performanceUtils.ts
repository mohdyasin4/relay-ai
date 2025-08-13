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
  let inThrottle: boolean = false;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Memoization for expensive computations
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // Prevent memory leaks by limiting cache size
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  }) as T;
}

// Request animation frame debounce for DOM operations
export function rafDebounce<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    
    rafId = requestAnimationFrame(() => {
      func(...args);
      rafId = null;
    });
  };
}

// Batch operations to reduce re-renders
export class BatchProcessor<T> {
  private batch: T[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private batchSize: number;
  private delay: number;
  private processor: (items: T[]) => void;

  constructor(
    processor: (items: T[]) => void,
    options: { batchSize?: number; delay?: number } = {}
  ) {
    this.processor = processor;
    this.batchSize = options.batchSize || 10;
    this.delay = options.delay || 100;
  }

  add(item: T): void {
    this.batch.push(item);
    
    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.flush(), this.delay);
    }
  }

  flush(): void {
    if (this.batch.length === 0) return;
    
    const items = [...this.batch];
    this.batch = [];
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    this.processor(items);
  }
}

// Intersection Observer utility for lazy loading
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  };
  
  return new IntersectionObserver(callback, defaultOptions);
}

// Resize observer utility
export function createResizeObserver(
  callback: (entries: ResizeObserverEntry[]) => void
): ResizeObserver {
  return new ResizeObserver(throttle(callback, 16)); // ~60fps
}

// Efficient array updates that minimize re-renders
export function updateArrayImmutably<T>(
  array: T[],
  index: number,
  item: T
): T[] {
  if (array[index] === item) return array; // No change needed
  
  const newArray = [...array];
  newArray[index] = item;
  return newArray;
}

export function insertIntoArrayImmutably<T>(
  array: T[],
  index: number,
  item: T
): T[] {
  return [...array.slice(0, index), item, ...array.slice(index)];
}

export function removeFromArrayImmutably<T>(
  array: T[],
  index: number
): T[] {
  return [...array.slice(0, index), ...array.slice(index + 1)];
}

// Virtual scrolling helper
export interface VirtualScrollState {
  startIndex: number;
  endIndex: number;
  offsetY: number;
}

export function calculateVirtualScrollState(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan = 5
): VirtualScrollState {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2);
  const offsetY = startIndex * itemHeight;
  
  return { startIndex, endIndex, offsetY };
}

// Memory usage monitoring (development only)
export function monitorMemoryUsage(): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    console.group('Memory Usage');
    console.log(`Used JS Heap: ${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`);
    console.log(`Total JS Heap: ${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`);
    console.log(`Heap Limit: ${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`);
    console.groupEnd();
  }
}

// Component render performance tracker
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  if (process.env.NODE_ENV !== 'development') {
    return Component;
  }
  
  return function PerformanceTrackedComponent(props: P) {
    const renderStart = performance.now();
    
    React.useEffect(() => {
      const renderEnd = performance.now();
      const renderTime = renderEnd - renderStart;
      
      if (renderTime > 16) { // Slower than 60fps
        console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms (>16ms threshold)`);
      }
    });
    
    return React.createElement(Component, props);
  };
}
