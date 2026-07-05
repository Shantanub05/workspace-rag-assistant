const NODE_BIN = '/home/ubuntu/.nvm/versions/node/v22.22.3/bin/node';
const APP_ROOT = '/home/ubuntu/apps/workspace-rag-assistant';

module.exports = {
  apps: [
    {
      name: 'workspace-rag-api',
      cwd: `${APP_ROOT}/apps/api`,
      script: NODE_BIN,
      args: 'dist/main.js',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'workspace-rag-web',
      cwd: `${APP_ROOT}/apps/web`,
      script: './node_modules/.bin/next',
      args: 'start -p 3100',
      interpreter: NODE_BIN,
      instances: 1,
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
