/**
 * This file provides a browser-safe mock for @prisma/client
 * It should be included in the build process as a module alias
 */

export class PrismaClient {
  constructor() {
    console.warn('Using mock PrismaClient for browser environment');
  }
}

export const prisma = new PrismaClient();
