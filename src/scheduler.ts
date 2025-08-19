// This file is to connect persistent schedule data from DB to current running cron jobs to ensure scheduled messages are sent at the right time
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { db } from './db.js';
import { Client, TextChannel } from 'discord.js';
import type { JobRow } from './types.js';

const tasks = new Map<number, ScheduledTask>();

export function loadAllSchedules(client: Client) {
  // stops and clears all task
  for (const t of tasks.values()) t.stop();
  tasks.clear();

  // schedule loader from database
  const rows = db.prepare(`SELECT * FROM schedules WHERE enabled = 1`).all() as JobRow[];
  for (const job of rows) {
    if (!cron.validate(job.cron)) continue; // continue is a javascript control flow keyword to just skip and move on...
    const task = cron.schedule(job.cron, async () => { // cron.schedule takes 3 args: cron expression (when to run), async what to run, options object (for us, timezone)
      const channel = await client.channels.fetch(job.channel_id).catch(() => null);
      if (channel && channel.isTextBased()) {
        const prefix = job.role_id ? `<@&${job.role_id}> ` : '';
        (channel as TextChannel).send({ content: `${prefix}${job.message}` }).catch(() => {});
      }
    }, { timezone: job.tz || 'UTC' }); 

    tasks.set(job.id, task);
  }
  console.log(`🔁 Loaded ${tasks.size} scheduled jobs.`);
}

export function addScheduleToRuntime(id: number, cronExpr: string, tz: string, fn: () => Promise<void>) { // adds new schedule at runtime
  if (!cron.validate(cronExpr)) return;
  const task = cron.schedule(cronExpr, fn, { timezone: tz || 'UTC' });
  tasks.set(id, task);
}
export function removeScheduleFromRuntime(id: number) { // stops and removes schedule by ID
  const t = tasks.get(id);
  if (t) { t.stop(); tasks.delete(id); }
}
