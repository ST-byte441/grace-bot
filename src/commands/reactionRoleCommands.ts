import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../db.js';

export async function handleReactionRoleCommand(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'create') {
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);

    // Discord.js class embed to create an embedded message
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x0099FF)
      .setFooter({ text: 'React below to get roles!' });

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    return interaction.followUp({ content: `Reaction role message created! Message ID: \`${message.id}\``, ephemeral: true }); // Ephemeral so that only the discord user who initiated sees
  }

  if (sub === 'add') {
    const messageId = interaction.options.getString('message_id', true);
    const emoji = interaction.options.getString('emoji', true);
    const role = interaction.options.getRole('role', true);

    try {
      const message = await interaction.channel?.messages.fetch(messageId);
      if (!message) {
        return interaction.reply({ content: 'Message not found in this channel.', ephemeral: true });
      }

      await message.react(emoji);

      db.prepare(`
        INSERT INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(interaction.guildId, interaction.channelId, messageId, emoji, role.id);

      return interaction.reply({ content: `Added ${emoji} → ${role} to message.`, ephemeral: true });
    } catch (error) {
      return interaction.reply({ content: 'Failed to add reaction role. Check the message ID and emoji.', ephemeral: true });
    }
  }

  if (sub === 'remove') {
    const messageId = interaction.options.getString('message_id', true);
    const emoji = interaction.options.getString('emoji', true);

    const info = db.prepare(`
      DELETE FROM reaction_roles 
      WHERE guild_id = ? AND message_id = ? AND emoji = ?
    `).run(interaction.guildId, messageId, emoji);

    if (info.changes) {
      try {
        const message = await interaction.channel?.messages.fetch(messageId);
        await message?.reactions.cache.get(emoji)?.remove();
      } catch (error) {
        // Ignore if reaction removal fails
      }
      return interaction.reply({ content: `Removed reaction role for ${emoji}.`, ephemeral: true });
    } else {
      return interaction.reply({ content: 'Reaction role not found.', ephemeral: true });
    }
  }
}