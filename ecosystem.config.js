module.exports = {
  apps: [
    {
      name: "logmart-pos",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        DATABASE: "sqlite.db",
        JWT_SECRET: "GANTI_DENGAN_SECRET_YANG_AMAN_SAAT_DEPLOY"
      }
    }
  ]
};
