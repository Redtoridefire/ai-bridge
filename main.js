const { app, BrowserWindow } = require("electron");

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    title: "AI Bridge",
    webPreferences: {
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile("index.html");
});

app.on("window-all-closed", () => app.quit());
