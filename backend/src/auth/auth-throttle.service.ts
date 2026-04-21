import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type AttemptState = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthThrottleService {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxAttempts = 5;

  assertAllowed(key: string) {
    const now = Date.now();
    const current = this.attempts.get(key);

    if (!current || current.resetAt <= now) {
      this.attempts.set(key, {
        count: 0,
        resetAt: now + this.windowMs,
      });
      return;
    }

    if (current.count >= this.maxAttempts) {
      throw new HttpException(
        'Too many login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  registerFailure(key: string) {
    const now = Date.now();
    const current = this.attempts.get(key);

    if (!current || current.resetAt <= now) {
      this.attempts.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return;
    }

    current.count += 1;
    this.attempts.set(key, current);
  }

  clear(key: string) {
    this.attempts.delete(key);
  }
}
