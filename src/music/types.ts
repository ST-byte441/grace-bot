// A playable YouTube video as returned by yt-dlp
export interface TrackInfo {
  id: string;
  title: string;
  url: string;
  channel: string;
  durationSec: number;
}

// A queued track, plus who added it
export interface Track extends TrackInfo {
  requestedById: string;
  requestedByName: string;
}
