/** One Send-to-completion measurement, including automatic tool continuations. */
export class LocusResponseTimer {
  private startedAt: number | null = null;

  start(now = performance.now()) {
    this.startedAt = now;
  }

  reset() {
    this.startedAt = null;
  }

  finish(
    { unsuccessful, continues }: { unsuccessful: boolean; continues: boolean },
    now = performance.now(),
  ) {
    if (unsuccessful) {
      this.reset();
      return null;
    }
    if (continues || this.startedAt === null) return null;
    const seconds = Math.max(0, now - this.startedAt) / 1000;
    this.reset();
    return seconds;
  }
}
