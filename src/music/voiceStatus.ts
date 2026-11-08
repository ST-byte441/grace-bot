import type { Client } from 'discord.js';

// Sets the text under a voice channel's name. Uses Discord's undocumented voice-status endpoint,
// so failures are logged and swallowed: playback never depends on this
export async function setVoiceStatus(client: Client, channelId: string, status: string): Promise<void> {
  try {
    await client.rest.put(`/channels/${channelId}/voice-status`, { body: { status } });
  } catch (e: any) {
    console.warn('[music]', `voice status update failed for ${channelId}:`, e?.message ?? String(e));
  }
}
