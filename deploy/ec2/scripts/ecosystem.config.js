module.exports = {
  apps: [
    {
      name: 'workspace-rag-api',
      cwd: '/home/ubuntu/apps/workspace-rag-assistant/apps/api',
      script: 'node',
      args: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'workspace-rag-web',
      cwd: '/home/ubuntu/apps/workspace-rag-assistant/apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3100',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
