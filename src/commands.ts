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
].map(c => c.toJSON());
