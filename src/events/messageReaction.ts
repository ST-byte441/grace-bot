// File for handling reaction role assignment and removal
import { db } from '../db.js';
import type { 
  MessageReaction, 
  PartialMessageReaction, 
  User, 
  PartialUser, 
  MessageReactionEventDetails 
} from 'discord.js';

export async function handleMessageReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  details: MessageReactionEventDetails //TODO: Investigate why typescript throws errors in bot.ts without this
): Promise<void> {
  // Handle partial data by fetching if needed because Discord can send partial data as part of optimiziations
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Failed to fetch reaction:', error);
      return;
    }
  }

  if (user.partial) {
    try {
      await user.fetch();
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return;
    }
  }

  const { message, emoji } = reaction;
  const emojiIdentifier = emoji.id ? `<:${emoji.name}:${emoji.id}>` : emoji.name;

  const reactionRole = db.prepare(`
    SELECT role_id FROM reaction_roles 
    WHERE guild_id = ? AND message_id = ? AND emoji = ?
  `).get(message.guildId, message.id, emojiIdentifier) as { role_id: string } | undefined;

  if (!reactionRole) return;

  try {
    const guild = message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(reactionRole.role_id);

    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(role);
      console.log(`Added role ${role.name} to ${user.tag}`);
    }
  } catch (error) {
    console.error('Failed to add role:', error);
  }
}

export async function handleMessageReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  details: MessageReactionEventDetails //TODO: Same todo as above
): Promise<void> {
  // Handle partial data by fetching if needed
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Failed to fetch reaction:', error);
      return;
    }
  }

  if (user.partial) {
    try {
      await user.fetch();
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return;
    }
  }

  const { message, emoji } = reaction;
  const emojiIdentifier = emoji.id ? `<:${emoji.name}:${emoji.id}>` : emoji.name;

  const reactionRole = db.prepare(`
    SELECT role_id FROM reaction_roles 
    WHERE guild_id = ? AND message_id = ? AND emoji = ?
  `).get(message.guildId, message.id, emojiIdentifier) as { role_id: string } | undefined;

  if (!reactionRole) return;

  try {
    const guild = message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(reactionRole.role_id);

    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      console.log(`Removed role ${role.name} from ${user.tag}`);
    }
  } catch (error) {
    console.error('Failed to remove role:', error);
  }
}