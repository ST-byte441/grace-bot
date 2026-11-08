import type { Interaction } from 'discord.js';
import { handleRoleCommand } from '../commands/roleCommands.js';
import { handleScheduleCommand } from '../commands/scheduleCommands.js';
import { handleReactionRoleCommand } from '../commands/reactionRoleCommands.js';
import { handleNicknameCommand } from '../commands/nicknameCommands.js';
import { handleMusicCommand } from '../commands/musicCommands.js';

export async function handleInteractionCreate(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {
    case 'role':
      return handleRoleCommand(interaction);
    case 'schedule':
      return handleScheduleCommand(interaction);
    case 'reactionrole':
      return handleReactionRoleCommand(interaction);
    case 'nickname':
      return handleNicknameCommand(interaction);
    case 'play':
    case 'skip':
    case 'queue':
    case 'remove':
    case 'pause':
    case 'resume':
      return handleMusicCommand(interaction);
  }
}