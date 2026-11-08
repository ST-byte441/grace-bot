import type { Track } from './types.js';

// The currently playing track plus the tracks waiting behind it
export class TrackQueue {
  #current: Track | undefined;
  #upcoming: Track[] = [];

  get current(): Track | undefined {
    return this.#current;
  }

  get upcoming(): readonly Track[] {
    return this.#upcoming;
  }

  // Returns the track's 1-based position in upcoming
  add(track: Track): number {
    return this.#upcoming.push(track);
  }

  // Moves the next track into current; current becomes undefined when nothing is left
  advance(): Track | undefined {
    this.#current = this.#upcoming.shift();
    return this.#current;
  }

  // 1-based position into upcoming
  remove(position: number): Track | undefined {
    if (!Number.isInteger(position) || position < 1 || position > this.#upcoming.length) return undefined;
    return this.#upcoming.splice(position - 1, 1)[0];
  }

  clear(): void {
    this.#current = undefined;
    this.#upcoming = [];
  }

  remainingSec(elapsedSec: number): number {
    const currentLeft = this.#current ? Math.max(0, this.#current.durationSec - elapsedSec) : 0;
    return this.#upcoming.reduce((sum, t) => sum + t.durationSec, currentLeft);
  }
}
