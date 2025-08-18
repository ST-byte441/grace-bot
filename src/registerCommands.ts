import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandData } from './commands.js';

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!); //! Update the version as discord API versions update

async function main() {
  // Global commands (propagate to all guilds)
  await rest.put(Routes.applicationCommands(process.env.APP_ID!), { body: commandData }); // HTTP PUT request to discord API for global slash
  console.log('✅ Slash commands registered globally.');
}
main().catch(err => {
  console.error(err);
  process.exit(1); // Any non-zero exit code will indicate program ended with error
});
