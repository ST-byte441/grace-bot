import { ActionRowBuilder, ComponentType, PermissionFlagsBits, StringSelectMenuBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Guild, GuildMember, User, VoiceBasedChannel } from 'discord.js';
import { buildQueueEmbed, isYouTubePlaylistOnly, isYouTubeUrl, toSelectOption } from '../music/format.js';
import { MusicSession, getSession } from '../music/session.js';
import type { Track, TrackInfo } from '../music/types.js';
import { YtDlpError, resolveVideo, searchYouTube } from '../music/ytdlp.js';

const PICK_TIMEOUT_MS = 60_000;
const YTDLP_DOWN = 'YouTube lookups are unavailable right now — try again later.';

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

function voiceChannelOf(guild: Guild, user: User): VoiceBasedChannel | null {
  return guild.voiceStates.cache.get(user.id)?.channel ?? null;
}

function displayName(interaction: ChatInputCommandInteraction): string {
  const m = interaction.member;
  return m && 'displayName' in m ? (m as GuildMember).displayName : interaction.user.displayName;
}

// For /play: the invoker's session, joining their channel if the bot isn't in voice
function sessionForPlay(guild: Guild, user: User): Result<MusicSession> {
  const channel = voiceChannelOf(guild, user);
  if (!channel) return { ok: false, message: 'Join a voice channel first.' };
  const existing = getSession(guild.id);
  if (existing) {
    return existing.channelId === channel.id
      ? { ok: true, value: existing }
      : { ok: false, message: `I'm already playing in <#${existing.channelId}>.` };
  }
  const canSpeak = guild.members.me ? channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.Speak) : false;
  if (!channel.joinable || !canSpeak) return { ok: false, message: "I can't join or speak in that channel." };
  return { ok: true, value: MusicSession.create(channel) };
}

// For control commands: the session, only if the invoker is in the bot's channel
function sessionForControl(guild: Guild, user: User): Result<MusicSession> {
  const channel = voiceChannelOf(guild, user);
  if (!channel) return { ok: false, message: 'Join a voice channel first.' };
  const session = getSession(guild.id);
  if (!session) return { ok: false, message: 'Nothing is playing.' };
  if (session.channelId !== channel.id) return { ok: false, message: 'You need to be in my voice channel.' };
  return { ok: true, value: session };
}

// Enqueues and returns the confirmation text
function enqueue(session: MusicSession, info: TrackInfo, interaction: ChatInputCommandInteraction): string {
  const track: Track = { ...info, requestedById: interaction.user.id, requestedByName: displayName(interaction) };
  const position = session.enqueue(track);
  return session.queue.current === track ? `Now playing **${track.title}**` : `Queued **${track.title}** (#${position})`;
}

async function handlePlay(interaction: ChatInputCommandInteraction, guild: Guild) {
  const query = interaction.options.getString('query', true).trim();

  // Check voice before doing a slow lookup, so the user hears about it right away
  if (!voiceChannelOf(guild, interaction.user)) return interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
  if (isYouTubePlaylistOnly(query)) {
    return interaction.reply({ content: "Playlists aren't supported — paste a single video link.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  if (isYouTubeUrl(query)) {
    const video = await resolveVideo(query);
    if (!video.ok) {
      return interaction.editReply(video.reason === 'live' ? "Live streams aren't supported." : "I can't play that video.");
    }
    const session = sessionForPlay(guild, interaction.user);
    if (!session.ok) return interaction.editReply(session.message);
    return interaction.editReply(enqueue(session.value, video.track, interaction));
  }

  const results = await searchYouTube(query);
  if (results.length === 0) return interaction.editReply(`No results for **${query}**.`);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`music-pick:${interaction.id}`)
    .setPlaceholder('Pick a song…')
    .addOptions(results.map(toSelectOption));
  const reply = await interaction.editReply({
    content: '',
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  });

  let pick;
  try {
    pick = await reply.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: PICK_TIMEOUT_MS,
      filter: i => i.user.id === interaction.user.id && i.customId === `music-pick:${interaction.id}`,
    });
  } catch {
    return interaction.editReply({ content: 'Search timed out.', components: [] });
  }

  const chosen = results.find(r => r.id === pick.values[0]);
  if (!chosen) return pick.update({ content: "I can't play that video.", components: [] });
  // Search results are unchecked: confirm the pick is playable (not private, age-restricted or live) before queueing
  await pick.deferUpdate();
  const video = await resolveVideo(chosen.url);
  if (!video.ok) {
    const content = video.reason === 'live' ? "Live streams aren't supported." : "I can't play that video.";
    return interaction.editReply({ content, components: [] });
  }
  // Re-check voice: the user or the bot may have moved while the picker was open
  const session = sessionForPlay(guild, interaction.user);
  if (!session.ok) return interaction.editReply({ content: session.message, components: [] });
  return interaction.editReply({ content: enqueue(session.value, video.track, interaction), components: [] });
}

async function handleControl(interaction: ChatInputCommandInteraction, guild: Guild) {
  const reply = (content: string) => interaction.reply({ content, ephemeral: true });

  if (interaction.commandName === 'queue') {
    const session = getSession(guild.id);
    if (!session || !session.queue.current) return reply('Nothing is playing.');
    return interaction.reply({ embeds: [buildQueueEmbed(session.queue, session.elapsedSec)], ephemeral: true });
  }

  const found = sessionForControl(guild, interaction.user);
  if (!found.ok) return reply(found.message);
  const session = found.value;

  switch (interaction.commandName) {
    case 'skip': {
      const current = session.queue.current;
      if (!current) return reply('Nothing is playing.');
      session.skip();
      return reply(`Skipped **${current.title}**.`);
    }
    case 'remove': {
      const position = interaction.options.getInteger('position', true);
      const removed = session.queue.remove(position);
      return reply(removed ? `Removed **${removed.title}**.` : `There's no song at position ${position}.`);
    }
    case 'pause':
      if (session.isPaused) return reply('Already paused.');
      return reply(session.pause() ? 'Paused.' : 'Nothing is playing.');
    case 'resume':
      if (!session.isPaused) return reply('Not paused.');
      return reply(session.resume() ? 'Resumed.' : 'Nothing is playing.');
  }
}

export async function handleMusicCommand(interaction: ChatInputCommandInteraction): Promise<unknown> {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This only works in a server.', ephemeral: true });
  try {
    return interaction.commandName === 'play' ? await handlePlay(interaction, guild) : await handleControl(interaction, guild);
  } catch (e) {
    console.error('[music]', `/${interaction.commandName} failed:`, e);
    const content = e instanceof YtDlpError ? YTDLP_DOWN : 'Something went wrong.';
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content, components: [] });
      else await interaction.reply({ content, ephemeral: true });
    } catch { /* interaction expired */ }
    return undefined;
  }
}
