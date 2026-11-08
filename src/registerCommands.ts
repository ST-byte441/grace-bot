import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandData } from './commands.js';

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!); //! Update the version as discord API versions update

// Returns the value after `flag` in argv, if present
function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const appId = process.env.APP_ID!;
  const guildId = argValue('--guild');
  const clearGuildId = argValue('--clear-guild');

  if (clearGuildId) {
    // Remove guild-scoped test commands so they don't show twice next to the global ones
    await rest.put(Routes.applicationGuildCommands(appId, clearGuildId), { body: [] });
    console.log(`✅ Cleared guild commands for ${clearGuildId}.`);
  } else if (guildId) {
    // Guild-scoped registration is instant and only visible in that guild (for testing)
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commandData });
    console.log(`✅ Slash commands registered to guild ${guildId}.`);
  } else {
    // Global commands (propagate to all guilds)
    await rest.put(Routes.applicationCommands(appId), { body: commandData }); // HTTP PUT request to discord API for global slash
    console.log('✅ Slash commands registered globally.');
  }
}
main().catch(err => {
  console.error(err);
  process.exit(1); // Any non-zero exit code will indicate program ended with error
});
