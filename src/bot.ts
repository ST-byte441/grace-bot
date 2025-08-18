// Main entry point for grace-bot
import 'dotenv/config';
import {
  Client, GatewayIntentBits, Partials, PermissionFlagsBits, TextChannel, NewsChannel, ThreadChannel
} from 'discord.js';
import cron from 'node-cron';
import { db } from './db.js';
import { loadAllSchedules, addScheduleToRuntime, removeScheduleFromRuntime } from './scheduler.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // for role operations
  ],
  partials: [Partials.GuildMember], // allows bot to receive incomplete objects of guildmembers data 
});

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user?.tag}`);
  loadAllSchedules(client);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ROLE COMMANDS
  if (interaction.commandName === 'role') {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true);
    const guild = interaction.guild!;
    const member = await guild.members.fetch(user.id);

    // Bot permission + hierarchy guard
    const me = guild.members.me!;
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: 'I need **Manage Roles** permission.', ephemeral: true });
    }
    const targetRole = guild.roles.cache.get(role.id)!;
    if (!targetRole || targetRole.position >= me.roles.highest.position) {
      return interaction.reply({ content: 'I cannot manage that role due to **role hierarchy**.', ephemeral: true });
    }

    try {
      if (sub === 'assign') {
        await member.roles.add(role.id);
        return interaction.reply({ content: `Assigned ${role} to ${member}.`, ephemeral: true });
      } else {
        await member.roles.remove(role.id);
        return interaction.reply({ content: `Removed ${role} from ${member}.`, ephemeral: true });
      }
    } catch (e: any) {
      return interaction.reply({ content: `Failed: ${e.message ?? String(e)}`, ephemeral: true });
    }
  }

  // SCHEDULE COMMANDS
  if (interaction.commandName === 'schedule') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ping') { // If '/schedule ping' was invoked (for Cron expression scheduling)
      const cronExpr = interaction.options.getString('cron', true).trim();
      const message = interaction.options.getString('message', true);
      const role = interaction.options.getRole('role');
      const tz = interaction.options.getString('tz') || process.env.TZ || 'UTC';

      if (!cron.validate(cronExpr)) {
        return interaction.reply({ content: 'Invalid cron. Example: `0 9 * * 1-5` (9am weekdays).', ephemeral: true }); // ephemeral makes bot's reply visible only to user who invoked command
      }

      const stmt = db.prepare(`
        INSERT INTO schedules (guild_id, channel_id, message, role_id, cron, tz, created_by, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `);
      const info = stmt.run(interaction.guildId, interaction.channelId, message, role?.id ?? null, cronExpr, tz, interaction.user.id);

      // attach to runtime scheduler immediately
      addScheduleToRuntime(Number(info.lastInsertRowid), cronExpr, tz, async () => {
        const channel = await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
        if (
            channel instanceof TextChannel ||
            channel instanceof NewsChannel ||
            channel instanceof ThreadChannel
            ) {
            const prefix = role ? `<@&${role.id}> ` : '';
            await channel.send({ content: `${prefix}${message}` }).catch(() => {});
        }
      });

      return interaction.reply({ content: `Scheduled **#${info.lastInsertRowid}**: \`${cronExpr}\` (${tz}).`, ephemeral: true });
    }

    if (sub === 'list') {
      const rows = db.prepare(`SELECT id, channel_id, cron, tz, role_id, message, enabled FROM schedules WHERE guild_id = ? ORDER BY id`).all(interaction.guildId) as { //TODO: make a TSTypes and add this...
        id: number;
        channel_id: string;
        cron: string;
        tz: string;
        role_id: string | null;
        message: string;
        enabled: number;
      }[];
      if (!rows.length) return interaction.reply({ content: 'No schedules.', ephemeral: true });
      const text = rows.map(r =>
        `#${r.id} • <#${r.channel_id}> • \`${r.cron}\` (${r.tz}) • ${r.role_id ? `<@&${r.role_id}>` : 'no role'} • ${r.enabled ? '✅' : '⛔'} • ${r.message}`
      ).join('\n'); //? This is formatted summary of schedules sent as bot response. Needs some investigating...
      return interaction.reply({ content: text, ephemeral: true });
    }

    if (sub === 'delete') {
      const id = interaction.options.getInteger('id', true);
      const info = db.prepare(`DELETE FROM schedules WHERE id = ? AND guild_id = ?`).run(id, interaction.guildId);
      removeScheduleFromRuntime(id);
      return interaction.reply({ content: info.changes ? `Deleted #${id}.` : `Not found.`, ephemeral: true });
    }
  }
});

client.login(process.env.BOT_TOKEN); // Needs to be invoked at the bottom to ensure event handlers and setup are registered before