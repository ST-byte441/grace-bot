import type { VoiceState } from 'discord.js';
import { getSession } from '../music/session.js';

// Ends the guild's music session when the bot is disconnected/moved, or when its channel has no humans left
export function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): void {
  const session = getSession(newState.guild.id);
  if (!session) return;

  if (newState.id === newState.client.user.id) {
    if (newState.channelId !== session.channelId) void session.destroy();
    return;
  }

  if (oldState.channelId === session.channelId && newState.channelId !== session.channelId) {
    const humans = oldState.channel?.members.filter(m => !m.user.bot).size ?? 0;
    if (humans === 0) void session.destroy();
  }
}
