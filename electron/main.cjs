const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('node:path')

const isDev = !app.isPackaged
let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 900,
    minWidth: 380,
    minHeight: 640,
    backgroundColor: '#111214',
    autoHideMenuBar: true,
    title: 'MAX Upgrader',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  Menu.setApplicationMenu(null)

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // внешние ссылки — в системный браузер, а не внутрь окна
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => { win = null })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
