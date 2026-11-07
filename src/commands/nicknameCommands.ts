import { ChatInputCommandInteraction, GuildMember, PermissionFlagsBits } from 'discord.js';

export async function handleNicknameCommand(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  const user = interaction.options.getUser('user', true);
  const nickname = sub === 'set' ? interaction.options.getString('nickname', true) : null; // null resets to username
  const guild = interaction.guild!;
  const target = await guild.members.fetch(user.id);
  const invoker = interaction.member as GuildMember;

  // Bot permission + hierarchy guard
  const me = guild.members.me!;
  if (!me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
    return interaction.reply({ content: 'I need **Manage Nicknames** permission.', ephemeral: true });
  }
  if (!target.manageable) { // false for the server owner and anyone at or above the bot's highest role
    return interaction.reply({ content: 'I cannot change that member\'s nickname due to **role hierarchy**.', ephemeral: true });
  }

  // Invoker hierarchy guard so users can't rename people above them. Equal rank is allowed on purpose,
  // unlike Discord's native Manage Nicknames rule, so members can rename peers with the same top role
  if (invoker.id !== guild.ownerId && target.roles.highest.position > invoker.roles.highest.position) {
    return interaction.reply({ content: 'You cannot change the nickname of someone with a higher role.', ephemeral: true });
  }

  try {
    await target.setNickname(nickname, `Changed by ${interaction.user.tag}`);
    return interaction.reply({ content: nickname ? `Set ${target}'s nickname to **${nickname}**.` : `Reset ${target}'s nickname.`, ephemeral: true });
  } catch (e: any) {
    return interaction.reply({ content: `Failed: ${e.message ?? String(e)}`, ephemeral: true });
  }
}
