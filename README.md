# grace-bot
A Discord bot for scheduling messages and reaction roles!

## Features
- 📅 Schedule messages with cron expressions and timezone support
- 🎭 Reaction role assignment and removal
- 👑 Role management commands with hierarchy checks

## Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with your bot token and app ID:
   ```
   BOT_TOKEN=your_bot_token_here
   APP_ID=your_app_id_here
   TZ=America/Los_Angeles
   ```
4. Register commands: `npm run register`
5. Build and start: `npm run build && npm start`

## Development
- `npm run dev` - Start in development mode with auto-restart
- `npm run build` - Build TypeScript to JavaScript
- `npm run register` - Register slash commands with Discord

## Production Deployment (PM2)

### First-time setup:
1. Install PM2 globally: `npm install -g pm2`
2. Start your bot: `npm run pm2:start`
3. **Enable auto-startup (CRITICAL for persistence):**
   ```bash
   pm2 startup
   # Follow the command it gives you (run with sudo)
   pm2 save
   ```

### Daily usage:
- `npm run pm2:start` - Build and start bot with PM2
- `npm run pm2:stop` - Stop the bot
- `npm run pm2:restart` - Restart the bot (for updates)
- `npm run pm2:logs` - View bot logs
- `npm run pm2:status` - Check bot status

### After server reboot:
Your bot will automatically start! No need to run anything.

## How it works:
- **PM2 runs independently** of VS Code, terminals, or user sessions
- **Your bot runs as a background process** managed by PM2
- **Automatically restarts** if it crashes
- **Survives server reboots** (with proper startup configuration)
- **You can close your computer** and the bot keeps running on the server

## Commands
- `/schedule ping` - Schedule a message with cron expression
- `/schedule list` - List all scheduled messages
- `/schedule delete` - Delete a scheduled message
- `/role assign/remove` - Manage user roles
- `/reactionrole create` - Create a reaction role message
- `/reactionrole add` - Add emoji-role mapping to a message
- `/reactionrole remove` - Remove emoji-role mapping.

## Troubleshooting

### If your bot stops after server reboot:
```bash
pm2 startup  # Reconfigure auto-startup
pm2 save     # Save current processes
```

### If PM2 loses your bot:
```bash
npm run pm2:start  # Restart from config file
```

### Check if your bot is really running:
```bash
pm2 list           # Show all PM2 processes
pm2 logs grace-bot # Show recent logs
ps aux | grep node # Show all Node.js processes
```

## Upcoming Features
- Larger database connect for algos