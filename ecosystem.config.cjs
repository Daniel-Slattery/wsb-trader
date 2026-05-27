module.exports = {
  apps: [
    {
      // Next.js production server
      // Next.js automatically loads .env.local in production mode
      name: 'wsb-web',
      script: './node_modules/.bin/next',
      args: 'start',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      // Worker: runs two daily crons (8:30am analysis, 9:35am trade execution)
      // --env-file loads .env.local before tsx executes worker.ts
      name: 'wsb-worker',
      script: './node_modules/.bin/tsx',
      args: 'worker.ts',
      node_args: '--env-file=.env.local',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
