import type { Interaction } from 'discord.js';
import { handleRoleCommand } from '../commands/roleCommands.js';
import { handleScheduleCommand } from '../commands/scheduleCommands.js';
import { handleReactionRoleCommand } from '../commands/reactionRoleCommands.js';

export async function handleInteractionCreate(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {
    case 'role':
      return handleRoleCommand(interaction);
    case 'schedule':
      return handleScheduleCommand(interaction);
    case 'reactionrole':
      return handleReactionRoleCommand(interaction);
  }
}