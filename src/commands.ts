import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const commandData = [
  new SlashCommandBuilder() // Allows use of discords slash command definition
    .setName('role')
    .setDescription('Assign or remove a role')
    .addSubcommand(sc =>
      sc.setName('assign')
        .setDescription('Assign a role to a user')
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
    .addSubcommand(sc =>
      sc.setName('remove')
        .setDescription('Remove a role from a user')
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Create/list/delete scheduled pings')
    .addSubcommand(sc =>
      sc.setName('ping')
        .setDescription('Schedule a ping using a cron expression')
        .addStringOption(o => o.setName('cron').setDescription('Cron, e.g. "0 9 * * 1-5"').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Optional role to mention'))
        .addStringOption(o => o.setName('tz').setDescription('IANA TZ like America/Los_Angeles')))
    .addSubcommand(sc =>
      sc.setName('list').setDescription('List scheduled pings'))
    .addSubcommand(sc =>
      sc.setName('delete')
        .setDescription('Delete a scheduled ping')
        .addIntegerOption(o => o.setName('id').setDescription('Schedule ID').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create reaction role messages')
    .addSubcommand(sc =>
      sc.setName('create')
        .setDescription('Create a reaction role message')
        .addStringOption(o => o.setName('title').setDescription('Message title').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Message description').setRequired(true)))
    .addSubcommand(sc =>
      sc.setName('add')
        .setDescription('Add a reaction role to a message')
        .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
        .addStringOption(o => o.setName('emoji').setDescription('Emoji (e.g., 😀 or :custom:)').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
    .addSubcommand(sc =>
      sc.setName('remove')
        .setDescription('Remove a reaction role from a message')
        .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
        .addStringOption(o => o.setName('emoji').setDescription('Emoji to remove').setRequired(true)))
    .addSubcommand(sc =>
      sc.setName('edit')
        .setDescription('Edit an existing reaction role message')
        .addStringOption(o => o.setName('message_id').setDescription('Message ID to edit').setRequired(true))
        .addStringOption(o => o.setName('title').setDescription('New title (optional)').setRequired(false))
        .addStringOption(o => o.setName('description').setDescription('New description (optional)').setRequired(false)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) 
].map(c => c.toJSON());
