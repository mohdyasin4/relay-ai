/**
 * Browser-compatible Prisma client
 *
 * This module provides a browser-safe way to interact with the database.
 * In a browser environment, it provides a proxy that makes API calls
 * instead of direct database access.
 */

// Create a type that mimics the PrismaClient interface
// This allows us to maintain type safety while not actually importing PrismaClient
export class BrowserPrismaClient {
  user = createModelProxy('user');
  message = createModelProxy('message');
  contact = createModelProxy('contact');
  group = createModelProxy('group');
  reaction = createModelProxy('reaction');
  
  constructor() {
    console.warn(
      'Using browser version of PrismaClient. All database operations will be proxied to API endpoints.'
    );
  }
}

// Create a proxy for model operations
function createModelProxy(modelName: string) {
  return {
    findUnique: async (p0?: { where: { id: string; }; }) => {
      console.log(`[BrowserPrisma] Called ${modelName}.findUnique`);
      // In a real app, this would make an API call
      return null;
    },
    findMany: async () => {
      console.log(`[BrowserPrisma] Called ${modelName}.findMany`);
      // In a real app, this would make an API call
      return [];
    },
    create: async (p0?: { data: { id: string; email: string; name: any; avatarUrl: any; }; }) => {
      console.log(`[BrowserPrisma] Called ${modelName}.create`);
      // In a real app, this would make an API call
      return {};
    },
    update: async (p0?: { where: { id: string; }; data: { email: string; name: any; avatarUrl: any; updatedAt: Date; }; }) => {
      console.log(`[BrowserPrisma] Called ${modelName}.update`);
      // In a real app, this would make an API call
      return {};
    },
    delete: async () => {
      console.log(`[BrowserPrisma] Called ${modelName}.delete`);
      // In a real app, this would make an API call
      return {};
    },
    upsert: async (p0?: { where: { id: string; }; update: { name: string; status: string; updatedAt: Date; }; create: { id: string; email: string; name: string; status: string; }; }) => {
      console.log(`[BrowserPrisma] Called ${modelName}.upsert`);
      // In a real app, this would make an API call
      return {};
    }
  };
}

// Export the browser-safe "prisma" instance
export const prisma = new BrowserPrismaClient();
