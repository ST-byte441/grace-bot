import { ChatInputCommandInteraction, TextChannel, NewsChannel, ThreadChannel } from 'discord.js';
import cron from 'node-cron';
import { db } from '../db.js';
import { addScheduleToRuntime, removeScheduleFromRuntime } from '../scheduler.js';

export async function handleScheduleCommand(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'ping') {
    const cronExpr = interaction.options.getString('cron', true).trim();
    const message = interaction.options.getString('message', true);
    const role = interaction.options.getRole('role');
    const tz = interaction.options.getString('tz') || process.env.TZ || 'UTC'; // TODO: Check how timezones works in display

    if (!cron.validate(cronExpr)) {
      return interaction.reply({ content: 'Invalid cron. Example: `0 9 * * 1-5` (9am weekdays).', ephemeral: true });
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
    const rows = db.prepare(`SELECT id, channel_id, cron, tz, role_id, message, enabled FROM schedules WHERE guild_id = ? ORDER BY id`).all(interaction.guildId) as {
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
    ).join('\n'); //? This needs further investigating...
    return interaction.reply({ content: text, ephemeral: true });
  }

  if (sub === 'delete') {
    const id = interaction.options.getInteger('id', true);
    const info = db.prepare(`DELETE FROM schedules WHERE id = ? AND guild_id = ?`).run(id, interaction.guildId);
    removeScheduleFromRuntime(id);
    return interaction.reply({ content: info.changes ? `Deleted #${id}.` : `Not found.`, ephemeral: true });
  }
}