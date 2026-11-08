import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import type { PermissionsBitField, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';

// Display order of groups; descriptions and permissions come from the command definitions themselves
const GROUPS: { title: string; commands: string[] }[] = [
  { title: '🎵 Music', commands: ['play', 'skip', 'queue', 'remove', 'pause', 'resume'] },
  { title: '📅 Schedules', commands: ['schedule'] },
  { title: '🎭 Reaction roles', commands: ['reactionrole'] },
  { title: '👑 Roles', commands: ['role'] },
  { title: '✏️ Nicknames', commands: ['nickname'] },
  { title: '❓ General', commands: ['help'] },
];
const OTHER = '📦 Other';

type CommandJSON = RESTPostAPIChatInputApplicationCommandsJSONBody;

// Same rule Discord applies by default: no required permissions, or the member has them all (Administrator passes)
function canUse(cmd: CommandJSON, perms: PermissionsBitField | null): boolean {
  const required = cmd.default_member_permissions;
  if (required === undefined || required === null) return true;
  return perms !== null && perms.has(BigInt(required));
}

// One line per subcommand, or one for the command itself
function lines(cmd: CommandJSON): string[] {
  const subs = (cmd.options ?? []).filter(o => o.type === ApplicationCommandOptionType.Subcommand);
  if (subs.length === 0) return [`\`/${cmd.name}\` — ${cmd.description}`];
  return subs.map(s => `\`/${cmd.name} ${s.name}\` — ${s.description}`);
}

export function buildHelpEmbed(commands: readonly CommandJSON[], perms: PermissionsBitField | null): EmbedBuilder {
  const usable = commands.filter(c => canUse(c, perms));
  const grouped = new Set(GROUPS.flatMap(g => g.commands));

  const sections = GROUPS.map(g => ({
    title: g.title,
    cmds: g.commands.map(name => usable.find(c => c.name === name)).filter((c): c is CommandJSON => c !== undefined),
  }));
  sections.push({ title: OTHER, cmds: usable.filter(c => !grouped.has(c.name)) });

  return new EmbedBuilder()
    .setTitle('grace-bot commands')
    .setDescription('Here are the commands you can use in this server:')
    .addFields(
      sections
        .filter(s => s.cmds.length > 0)
        .map(s => ({ name: s.title, value: s.cmds.flatMap(lines).join('\n').slice(0, 1024) })),
    );
}
