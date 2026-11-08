import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YtDlpError, searchYouTube } from './ytdlp.js';

// `false` exits 1 with no output, standing in for a broken or outdated yt-dlp
test('searchYouTube throws YtDlpError when yt-dlp fails', async () => {
  process.env.YTDLP_BIN = 'false';
  try {
    await assert.rejects(searchYouTube('anything'), YtDlpError);
  } finally {
    delete process.env.YTDLP_BIN;
  }
});

test('searchYouTube throws YtDlpError when yt-dlp is missing', async () => {
  process.env.YTDLP_BIN = '/nonexistent/yt-dlp';
  try {
    await assert.rejects(searchYouTube('anything'), YtDlpError);
  } finally {
    delete process.env.YTDLP_BIN;
  }
});
