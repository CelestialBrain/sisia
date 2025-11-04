export class RateLimiter {
  private messageTimestamps: number[] = [];
  private readonly MESSAGES_PER_MINUTE = 10;
  private readonly TIMEOUT_DURATION = 30000; // 30 seconds
  private timeoutUntil: number = 0;

  canSendMessage(): { allowed: boolean; reason?: string; waitTime?: number } {
    const now = Date.now();

    // Check if user is in timeout
    if (now < this.timeoutUntil) {
      const waitTime = Math.ceil((this.timeoutUntil - now) / 1000);
      return {
        allowed: false,
        reason: `You're sending messages too quickly. Please wait ${waitTime} seconds.`,
        waitTime
      };
    }

    // Remove timestamps older than 1 minute
    this.messageTimestamps = this.messageTimestamps.filter(
      timestamp => now - timestamp < 60000
    );

    // Check if exceeded limit
    if (this.messageTimestamps.length >= this.MESSAGES_PER_MINUTE) {
      this.timeoutUntil = now + this.TIMEOUT_DURATION;
      const waitTime = Math.ceil(this.TIMEOUT_DURATION / 1000);
      return {
        allowed: false,
        reason: `You're sending messages too quickly. Please wait ${waitTime} seconds.`,
        waitTime
      };
    }

    // Allow message
    this.messageTimestamps.push(now);
    return { allowed: true };
  }

  reset(): void {
    this.messageTimestamps = [];
    this.timeoutUntil = 0;
  }
}
