import { useEffect, useRef, useCallback } from 'react';
import { PerformanceMonitor } from '@/utils/performanceUtils';

/**
 * Hook for monitoring component performance and API calls
 */
export function usePerformanceMonitor(componentName: string) {
  const monitorRef = useRef(new PerformanceMonitor());
  const renderStartRef = useRef<number>(0);
  const renderCountRef = useRef(0);

  // Track render performance
  useEffect(() => {
    renderCountRef.current++;
    const renderTime = performance.now() - renderStartRef.current;
    
    if (renderTime > 16) { // Slower than 60fps
      console.warn(
        `🚨 ${componentName} render #${renderCountRef.current} took ${renderTime.toFixed(2)}ms (>16ms threshold)`
      );
    }
    
    // Log render performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `📊 ${componentName} render #${renderCountRef.current}: ${renderTime.toFixed(2)}ms`
      );
    }
  });

  // Start render timer
  useEffect(() => {
    renderStartRef.current = performance.now();
  });

  // Track API call performance
  const trackApiCall = useCallback(async <T>(
    apiName: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    const stopTimer = monitorRef.current.startTimer(apiName);
    
    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      
      if (duration > 1000) { // Slower than 1 second
        console.warn(
          `🐌 ${componentName} API call ${apiName} took ${duration.toFixed(2)}ms (>1000ms threshold)`
        );
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(
        `❌ ${componentName} API call ${apiName} failed after ${duration.toFixed(2)}ms:`,
        error
      );
      throw error;
    } finally {
      stopTimer();
    }
  }, [componentName]);

  // Track synchronous operation performance
  const trackOperation = useCallback(<T>(
    operationName: string,
    operation: () => T
  ): T => {
    const startTime = performance.now();
    const stopTimer = monitorRef.current.startTimer(operationName);
    
    try {
      const result = operation();
      const duration = performance.now() - startTime;
      
      if (duration > 16) { // Slower than 60fps
        console.warn(
          `🐌 ${componentName} operation ${operationName} took ${duration.toFixed(2)}ms (>16ms threshold)`
        );
      }
      
      return result;
    } finally {
      stopTimer();
    }
  }, [componentName]);

  // Get performance metrics
  const getMetrics = useCallback((label: string) => {
    return monitorRef.current.getMetrics(label);
  }, []);

  // Clear performance metrics
  const clearMetrics = useCallback(() => {
    monitorRef.current.clearMetrics();
  }, []);

  // Get all performance data
  const getPerformanceReport = useCallback(() => {
    const report = {
      componentName,
      renderCount: renderCountRef.current,
      metrics: {} as Record<string, any>,
    };

    // Get metrics for common operations
    ['render', 'apiCall', 'operation'].forEach(label => {
      report.metrics[label] = monitorRef.current.getMetrics(label);
    });

    return report;
  }, [componentName]);

  return {
    trackApiCall,
    trackOperation,
    getMetrics,
    clearMetrics,
    getPerformanceReport,
    renderCount: renderCountRef.current,
  };
}

/**
 * Hook for monitoring specific performance metrics
 */
export function usePerformanceMetrics(componentName: string, metricLabels: string[]) {
  const monitorRef = useRef(new PerformanceMonitor());
  const metricsRef = useRef<Record<string, any>>({});

  // Update metrics when they change
  useEffect(() => {
    metricLabels.forEach(label => {
      metricsRef.current[label] = monitorRef.current.getMetrics(label);
    });
  });

  const startTimer = useCallback((label: string) => {
    return monitorRef.current.startTimer(label);
  }, []);

  const getMetric = useCallback((label: string) => {
    return monitorRef.current.getMetrics(label);
  }, []);

  const getAllMetrics = useCallback(() => {
    return metricsRef.current;
  }, []);

  return {
    startTimer,
    getMetric,
    getAllMetrics,
  };
}

/**
 * Hook for monitoring component re-renders
 */
export function useRenderMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(performance.now());
  const renderTimesRef = useRef<number[]>([]);

  useEffect(() => {
    renderCountRef.current++;
    const currentTime = performance.now();
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
    
    renderTimesRef.current.push(timeSinceLastRender);
    
    // Keep only last 100 render times
    if (renderTimesRef.current.length > 100) {
      renderTimesRef.current.shift();
    }
    
    lastRenderTimeRef.current = currentTime;
    
    // Log render frequency
    if (renderCountRef.current % 10 === 0) { // Log every 10th render
      const avgRenderInterval = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;
      console.log(
        `📊 ${componentName} render #${renderCountRef.current}: avg interval ${avgRenderInterval.toFixed(2)}ms`
      );
    }
  });

  const getRenderStats = useCallback(() => {
    const times = renderTimesRef.current;
    if (times.length === 0) return { count: 0, avgInterval: 0, minInterval: 0, maxInterval: 0 };
    
    const avgInterval = times.reduce((a, b) => a + b, 0) / times.length;
    const minInterval = Math.min(...times);
    const maxInterval = Math.max(...times);
    
    return {
      count: renderCountRef.current,
      avgInterval,
      minInterval,
      maxInterval,
      recentTimes: times.slice(-10), // Last 10 render intervals
    };
  }, []);

  return {
    renderCount: renderCountRef.current,
    getRenderStats,
  };
}

/**
 * Hook for monitoring memory usage (development only)
 */
export function useMemoryMonitor(componentName: string) {
  const memoryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
        const totalMB = (memory.totalJSHeapSize / 1048576).toFixed(2);
        const limitMB = (memory.jsHeapSizeLimit / 1048576).toFixed(2);
        
        // Log memory usage every 30 seconds
        console.log(
          `💾 ${componentName} Memory: ${usedMB}MB used / ${totalMB}MB total (limit: ${limitMB}MB)`
        );
        
        // Warn if memory usage is high
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
          console.warn(
            `⚠️ ${componentName} High memory usage: ${usedMB}MB (${((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)}% of limit)`
          );
        }
      }
    };

    // Check memory every 30 seconds
    memoryCheckIntervalRef.current = setInterval(checkMemory, 30000);
    
    return () => {
      if (memoryCheckIntervalRef.current) {
        clearInterval(memoryCheckIntervalRef.current);
      }
    };
  }, [componentName]);

  return {
    // No public API needed for memory monitoring
  };
}













