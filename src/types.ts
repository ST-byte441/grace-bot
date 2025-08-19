export type JobRow = {
  id: number;
  guild_id: string;
  channel_id: string;
  message: string;
  role_id: string | null;
  cron: string;
  tz: string;
  created_by: string;
  enabled: number;
  created_at: string;
};

export type ReactionRoleRow = {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  emoji: string;
  role_id: string;
  created_at: string;
};