import { BrowserWindow, WebContentsView, ipcMain } from "electron"
import * as WebView from "../webview"
import * as Overlay from "../annotations/overlay"

type ViewState = {
  view: WebContentsView
  window: BrowserWindow
}

let currentState: ViewState | null = null

export function isAttached(): boolean {
  return currentState !== null
}

export function attachView(window: BrowserWindow, bounds?: { x: number; y: number; width: number; height: number }) {
  detachView()

  const view = WebView.createWebView({
    window,
    bounds: bounds ?? { x: 0, y: 0, width: 400, height: 600 },
  })

  wireEvents(view)
  currentState = { view, window }
  return view
}

export function detachView() {
  if (!currentState) return
  WebView.removeWebView(currentState.window, currentState.view)
  currentState = null
}

export function getView(): WebContentsView | null {
  return currentState?.view ?? null
}

function wireEvents(view: WebContentsView) {
  view.webContents.on("did-navigate", (_event, url) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send("iab-url-changed", url)
    })
  })

  view.webContents.on("page-title-updated", (_event, title) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send("iab-title-changed", title)
    })
  })

  view.webContents.on("did-start-loading", () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send("iab-loading-changed", true)
    })
  })

  view.webContents.on("did-stop-loading", () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send("iab-loading-changed", false)
    })
  })

  view.webContents.on("console-message", (_event, _level, message) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send("iab-console-message", message)
    })
  })
}

export function registerIABIpcHandlers() {
  ipcMain.handle("iab-attach", (_event, bounds) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return false
    attachView(win, bounds)
    return true
  })

  ipcMain.handle("iab-detach", () => {
    detachView()
  })

  ipcMain.handle("iab-navigate", (_event, url: string) => {
    const v = getView()
    if (!v) return
    let targetUrl = url
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      targetUrl = `https://${url}`
    }
    WebView.navigateTo(v, targetUrl)
  })

  ipcMain.handle("iab-navigate-back", () => {
    const v = getView()
    if (v) WebView.navigateBack(v)
  })

  ipcMain.handle("iab-navigate-forward", () => {
    const v = getView()
    if (v) WebView.navigateForward(v)
  })

  ipcMain.handle("iab-reload", () => {
    const v = getView()
    if (v) WebView.reload(v)
  })

  ipcMain.handle("iab-stop", () => {
    const v = getView()
    if (v) WebView.stop(v)
  })

  ipcMain.handle("iab-get-url", () => {
    const v = getView()
    return v ? WebView.getCurrentURL(v) : null
  })

  ipcMain.handle("iab-get-title", () => {
    const v = getView()
    return v ? WebView.getTitle(v) : ""
  })

  ipcMain.handle("iab-is-loading", () => {
    const v = getView()
    return v ? WebView.isLoading(v) : false
  })

  ipcMain.handle("iab-evaluate-js", async (_event, code: string) => {
    const v = getView()
    if (!v) return null
    return WebView.evaluateJS(v, code)
  })

  ipcMain.handle("iab-capture-screenshot", async () => {
    const v = getView()
    if (!v) return null
    return WebView.captureScreenshot(v)
  })

  ipcMain.handle("iab-select-element", async (_event, selector: string) => {
    const v = getView()
    if (!v) return null
    return Overlay.selectElement(v, selector)
  })

  ipcMain.handle("iab-get-computed-styles", async (_event, selector: string) => {
    const v = getView()
    if (!v) return null
    return Overlay.getComputedStyles(v, selector)
  })
}