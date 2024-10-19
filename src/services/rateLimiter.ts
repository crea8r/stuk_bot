// src/services/rateLimiter.ts
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW } from '../config';

interface UserRate {
  count: number;
  timestamp: number;
}

const userRates: { [userId: string]: UserRate } = {};

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userRate = userRates[userId];

  if (!userRate || now - userRate.timestamp > RATE_LIMIT_WINDOW) {
    userRates[userId] = { count: 1, timestamp: now };
    return true;
  }

  if (userRate.count < RATE_LIMIT_MAX) {
    userRate.count++;
    return true;
  }

  return false;
}

// TODO: In the future, replace this with Redis implementation
// export async function checkRateLimit(userId: string): Promise<boolean> {
//   // Redis implementation here
// }
