// Main entry point for grace-bot
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { handleReady } from './events/ready.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { handleMessageReactionAdd, handleMessageReactionRemove } from './events/messageReaction.js';

// Environment validation
if (!process.env.BOT_TOKEN || !process.env.APP_ID) {
  console.error('Missing required environment variables: BOT_TOKEN, APP_ID');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [ // Partials allow for partial input of objects 
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction
  ],
});

// Event handlers
client.once('ready', () => handleReady(client));

client.on('interactionCreate', handleInteractionCreate);
client.on('messageReactionAdd', handleMessageReactionAdd);
client.on('messageReactionRemove', handleMessageReactionRemove);

client.login(process.env.BOT_TOKEN);