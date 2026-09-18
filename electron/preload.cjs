const { contextBridge } = require('electron')

// Игра полностью работает в вебе; наружу отдаём только пометку платформы.
contextBridge.exposeInMainWorld('maxUpgrader', {
  platform: 'desktop',
  version: process.env.npm_package_version || '1.0.0',
})
