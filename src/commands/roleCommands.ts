import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

export async function handleRoleCommand(interaction: ChatInputCommandInteraction) {
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