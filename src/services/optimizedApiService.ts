import { CacheManager, RequestDeduplicator, ApiBatcher, debounce, throttle } from '../utils/performanceUtils';

/**
 * Optimized API Service with caching, deduplication, and batching
 */
export class OptimizedApiService {
  private cache = new CacheManager<string, any>();
  private deduplicator = new RequestDeduplicator();
  private batchers = new Map<string, ApiBatcher<any>>();
  
  // Cache TTLs in milliseconds
  private readonly CACHE_TTLS = {
    CONTACTS: 5 * 60 * 1000,        // 5 minutes
    MESSAGES: 2 * 60 * 1000,        // 2 minutes
    USER_PROFILE: 10 * 60 * 1000,   // 10 minutes
    AI_RESPONSES: 1 * 60 * 1000,    // 1 minute
  };

  /**
   * Get cached data or fetch if not available
   */
  async getCached<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const data = await fetchFn();
    this.cache.set(key, data, ttl || this.CACHE_TTLS.USER_PROFILE);
    return data;
  }

  /**
   * Deduplicate API requests to prevent duplicate calls
   */
  async deduplicateRequest<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    return this.deduplicator.deduplicate(key, requestFn);
  }

  /**
   * Batch API requests for better performance
   */
  addToBatch<T>(
    batchKey: string,
    item: T,
    processor: (items: T[]) => Promise<void>,
    batchSize = 10,
    delay = 100
  ): void {
    if (!this.batchers.has(batchKey)) {
      this.batchers.set(
        batchKey,
        new ApiBatcher(processor, batchSize, delay)
      );
    }
    
    this.batchers.get(batchKey)!.add(item);
  }

  /**
   * Flush all pending batches
   */
  async flushAllBatches(): Promise<void> {
    const promises = Array.from(this.batchers.values()).map(batcher => batcher.flush());
    await Promise.all(promises);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size(),
      keys: Array.from(this.cache['cache'].keys()),
    };
  }
}

/**
 * Optimized Message Service with caching and batching
 */
export class OptimizedMessageService {
  private apiService = new OptimizedApiService();
  private messageCache = new Map<string, { messages: any[]; timestamp: number }>();
  private readonly MESSAGE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  /**
   * Get messages for a contact with caching
   */
  async getMessages(
    contactId: string,
    limit = 50,
    offset = 0
  ): Promise<any[]> {
    const cacheKey = `messages:${contactId}:${limit}:${offset}`;
    
    return this.apiService.getCached(
      cacheKey,
      async () => {
        // Simulate API call - replace with actual MessageService call
        const messages = await this.fetchMessagesFromAPI(contactId, limit, offset);
        return messages;
      },
      this.MESSAGE_CACHE_TTL
    );
  }

  /**
   * Batch save messages for better performance
   */
  async batchSaveMessages(messages: any[]): Promise<void> {
    this.apiService.addToBatch(
      'saveMessages',
      messages,
      async (batchedMessages) => {
        // Simulate batch API call - replace with actual batch save
        await this.saveMessagesBatch(batchedMessages.flat());
      },
      5, // Batch size
      200 // Delay in ms
    );
  }

  /**
   * Get latest messages for multiple contacts efficiently
   */
  async getLatestMessagesForContacts(
    userId: string,
    contacts: any[],
    limit = 1
  ): Promise<Record<string, any[]>> {
    const cacheKey = `latestMessages:${userId}:${contacts.length}:${limit}`;
    
    return this.apiService.getCached(
      cacheKey,
      async () => {
        // Simulate API call - replace with actual MessageService call
        const results: Record<string, any[]> = {};
        
        // Process contacts in parallel for better performance
        await Promise.all(
          contacts.map(async (contact) => {
            try {
              const messages = await this.fetchMessagesFromAPI(contact.id, limit, 0);
              if (messages.length > 0) {
                results[contact.id] = messages;
              }
            } catch (error) {
              console.error(`Failed to fetch messages for contact ${contact.id}:`, error);
            }
          })
        );
        
        return results;
      },
      this.MESSAGE_CACHE_TTL
    );
  }

  /**
   * Invalidate message cache for a specific contact
   */
  invalidateContactCache(contactId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.messageCache.keys()) {
      if (key.includes(`messages:${contactId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.messageCache.delete(key));
  }

  /**
   * Prefetch messages for better perceived performance
   */
  async prefetchMessages(contactId: string): Promise<void> {
    // Prefetch next page of messages
    const nextOffset = 50;
    this.getMessages(contactId, 50, nextOffset).catch(console.error);
  }

  private async fetchMessagesFromAPI(contactId: string, limit: number, offset: number): Promise<any[]> {
    // Simulate API delay - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // Return mock data for demonstration
    return Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
      id: `msg-${contactId}-${offset + i}`,
      contactId,
      text: `Mock message ${offset + i}`,
      timestamp: new Date(Date.now() - (offset + i) * 60000),
      senderId: offset + i % 2 === 0 ? 'user' : contactId,
    }));
  }

  private async saveMessagesBatch(messages: any[]): Promise<void> {
    // Simulate batch save - replace with actual batch API call
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    console.log(`Batch saved ${messages.length} messages`);
  }
}

/**
 * Optimized Contact Service with intelligent caching
 */
export class OptimizedContactService {
  private apiService = new OptimizedApiService();
  private contactCache = new Map<string, { contact: any; timestamp: number }>();
  private readonly CONTACT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get contact by ID with caching
   */
  async getContactById(contactId: string): Promise<any | null> {
    const cacheKey = `contact:${contactId}`;
    
    return this.apiService.getCached(
      cacheKey,
      async () => {
        // Simulate API call - replace with actual ContactService call
        const contact = await this.fetchContactFromAPI(contactId);
        return contact;
      },
      this.CONTACT_CACHE_TTL
    );
  }

  /**
   * Get multiple contacts efficiently
   */
  async getContactsByIds(contactIds: string[]): Promise<any[]> {
    const results: any[] = [];
    const uncachedIds: string[] = [];
    
    // Check cache first
    for (const id of contactIds) {
      const cached = this.contactCache.get(id);
      if (cached && Date.now() - cached.timestamp < this.CONTACT_CACHE_TTL) {
        results.push(cached.contact);
      } else {
        uncachedIds.push(id);
      }
    }
    
    // Fetch uncached contacts in parallel
    if (uncachedIds.length > 0) {
      const fetchedContacts = await Promise.all(
        uncachedIds.map(id => this.getContactById(id))
      );
      
      results.push(...fetchedContacts.filter(Boolean));
    }
    
    return results;
  }

  /**
   * Update contact cache
   */
  updateContactCache(contactId: string, contact: any): void {
    this.contactCache.set(contactId, {
      contact,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate contact cache
   */
  invalidateContactCache(contactId: string): void {
    this.contactCache.delete(contactId);
  }

  private async fetchContactFromAPI(contactId: string): Promise<any | null> {
    // Simulate API delay - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
    
    // Return mock data for demonstration
    return {
      id: contactId,
      name: `Contact ${contactId}`,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${contactId}`,
      status: 'online',
      isGroup: false,
      isAi: false,
    };
  }
}

/**
 * Optimized AI Service with response caching
 */
export class OptimizedAiService {
  private apiService = new OptimizedApiService();
  private responseCache = new Map<string, { response: string; timestamp: number }>();
  private readonly AI_CACHE_TTL = 1 * 60 * 1000; // 1 minute

  /**
   * Get AI response with caching
   */
  async getAiResponse(
    prompt: string,
    context?: string
  ): Promise<string> {
    const cacheKey = `ai:${this.hashString(prompt + (context || ''))}`;
    
    return this.apiService.getCached(
      cacheKey,
      async () => {
        // Simulate AI API call - replace with actual AI service call
        const response = await this.fetchAiResponse(prompt, context);
        return response;
      },
      this.AI_CACHE_TTL
    );
  }

  /**
   * Stream AI response with intelligent caching
   */
  async *streamAiResponse(
    prompt: string,
    context?: string
  ): AsyncGenerator<string> {
    const cacheKey = `ai:${this.hashString(prompt + (context || ''))}`;
    const cached = this.responseCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.AI_CACHE_TTL) {
      // Return cached response as stream
      const words = cached.response.split(' ');
      for (const word of words) {
        yield word + ' ';
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming
      }
      return;
    }
    
    // Stream new response
    let fullResponse = '';
    for await (const chunk of this.fetchAiResponseStream(prompt, context)) {
      fullResponse += chunk;
      yield chunk;
    }
    
    // Cache the complete response
    this.responseCache.set(cacheKey, {
      response: fullResponse,
      timestamp: Date.now(),
    });
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private async fetchAiResponse(prompt: string, context?: string): Promise<string> {
    // Simulate AI API delay - replace with actual AI service call
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    return `This is a mock AI response to: "${prompt}". ${context ? `Context: ${context}` : ''}`;
  }

  private async *fetchAiResponseStream(prompt: string, context?: string): AsyncGenerator<string> {
    // Simulate streaming AI response - replace with actual streaming API call
    const response = await this.fetchAiResponse(prompt, context);
    const words = response.split(' ');
    
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    }
  }
}

// Export instances for use throughout the app
export const optimizedMessageService = new OptimizedMessageService();
export const optimizedContactService = new OptimizedContactService();
export const optimizedAiService = new OptimizedAiService();
export const optimizedApiService = new OptimizedApiService();









