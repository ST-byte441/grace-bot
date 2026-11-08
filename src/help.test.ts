import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { buildHelpEmbed } from './help.js';
import { commandData } from './commands.js';

const perms = (...flags: bigint[]) => new PermissionsBitField(flags);
const groups = (p: PermissionsBitField | null) =>
  (buildHelpEmbed(commandData, p).toJSON().fields ?? []).map(f => f.name);
const field = (p: PermissionsBitField | null, nameIncludes: string) =>
  buildHelpEmbed(commandData, p).toJSON().fields?.find(f => f.name.includes(nameIncludes))?.value ?? '';

test('a member with no special permissions sees only music and general', () => {
  assert.deepEqual(groups(perms()), ['🎵 Music', '❓ General']);
});

test('Manage Roles adds reaction roles and roles, not schedules or nicknames', () => {
  assert.deepEqual(groups(perms(PermissionFlagsBits.ManageRoles)), ['🎵 Music', '🎭 Reaction roles', '👑 Roles', '❓ General']);
});

test('Administrator sees every group', () => {
  assert.deepEqual(groups(perms(PermissionFlagsBits.Administrator)),
    ['🎵 Music', '📅 Schedules', '🎭 Reaction roles', '👑 Roles', '✏️ Nicknames', '❓ General']);
});

test('no permissions info (outside a server) shows only open commands', () => {
  assert.deepEqual(groups(null), ['🎵 Music', '❓ General']);
});

test('subcommands are listed with their own descriptions', () => {
  const value = field(perms(PermissionFlagsBits.ManageGuild), 'Schedules');
  assert.match(value, /`\/schedule ping` — Schedule a ping using a cron expression/);
  assert.match(value, /`\/schedule list`/);
  assert.match(value, /`\/schedule delete`/);
});

test('plain commands are listed with their description', () => {
  assert.match(field(perms(), 'Music'), /`\/play` — Play a song from YouTube/);
  assert.match(field(perms(), 'General'), /`\/help`/);
});

test('a command with no group lands under Other', () => {
  const extra = new SlashCommandBuilder().setName('mystery').setDescription('Does something').toJSON();
  const names = (buildHelpEmbed([...commandData, extra], perms()).toJSON().fields ?? []).map(f => f.name);
  assert.equal(names.at(-1), '📦 Other');
});
