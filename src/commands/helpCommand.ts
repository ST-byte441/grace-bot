import type { ChatInputCommandInteraction } from 'discord.js';
import { commandData } from '../commands.js';
import { buildHelpEmbed } from '../help.js';

// memberPermissions reflects the member's roles in this server (and channel overwrites)
export async function handleHelpCommand(interaction: ChatInputCommandInteraction) {
  return interaction.reply({ embeds: [buildHelpEmbed(commandData, interaction.memberPermissions)], ephemeral: true });
}
