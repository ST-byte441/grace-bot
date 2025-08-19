// Discord Ready event handler - loads up the bot and all the scheduled tasks
import { Client } from 'discord.js';
import { loadAllSchedules } from '../scheduler.js';

export function handleReady(client: Client) {
  console.log(`🤖 Logged in as ${client.user?.tag}`);
  loadAllSchedules(client);
}