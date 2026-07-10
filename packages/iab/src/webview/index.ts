import { app, BrowserWindow, WebContentsView, ipcMain, session } from "electron"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(fileURLToPath(import.meta.url))

export type WebViewOptions = {
  window: BrowserWindow
  bounds?: { x: number; y: number; width: number; height: number }
  preloadPath?: string
}

export function createWebView(opts: WebViewOptions) {
  const ses = session.fromPartition("iab-session", { cache: true })
  const preload = opts.preloadPath ?? join(root, "../preload/index.js")

  const view = new WebContentsView({
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: "iab-session",
    },
  })

  view.setBackgroundColor("#ffffff")

  if (opts.bounds) {
    view.setBounds(opts.bounds)
  }

  opts.window.contentView.addChildView(view)

  return view
}

export function removeWebView(window: BrowserWindow, view: WebContentsView) {
  window.contentView.removeChildView(view)
  if (!view.webContents.isDestroyed()) {
    ;(view.webContents as any).destroy()
  }
}

export function navigateTo(view: WebContentsView, url: string) {
  if (view.webContents.isDestroyed()) return
  view.webContents.loadURL(url)
}

export function navigateBack(view: WebContentsView) {
  if (view.webContents.isDestroyed() || !view.webContents.navigationHistory.canGoBack()) return
  view.webContents.navigationHistory.goBack()
}

export function navigateForward(view: WebContentsView) {
  if (view.webContents.isDestroyed() || !view.webContents.navigationHistory.canGoForward()) return
  view.webContents.navigationHistory.goForward()
}

export function reload(view: WebContentsView) {
  if (view.webContents.isDestroyed()) return
  view.webContents.reload()
}

export function stop(view: WebContentsView) {
  if (view.webContents.isDestroyed()) return
  view.webContents.stop()
}

export function getCurrentURL(view: WebContentsView): string | null {
  if (view.webContents.isDestroyed()) return null
  return view.webContents.getURL()
}

export function getTitle(view: WebContentsView): string {
  if (view.webContents.isDestroyed()) return ""
  return view.webContents.getTitle()
}

export function isLoading(view: WebContentsView): boolean {
  if (view.webContents.isDestroyed()) return false
  return view.webContents.isLoading()
}

export function evaluateJS<T>(view: WebContentsView, code: string): Promise<T | null> {
  if (view.webContents.isDestroyed()) return Promise.resolve(null)
  return view.webContents.executeJavaScript(code).catch(() => null) as Promise<T | null>
}

export function captureScreenshot(view: WebContentsView): Promise<Buffer | null> {
  if (view.webContents.isDestroyed()) return Promise.resolve(null)
  return view.webContents.capturePage().then((img) => img.toPNG()).catch(() => null)
}

export function setBounds(view: WebContentsView, bounds: { x: number; y: number; width: number; height: number }) {
  if (view.webContents.isDestroyed()) return
  view.setBounds(bounds)
}

export function focus(view: WebContentsView) {
  if (view.webContents.isDestroyed()) return
  view.webContents.focus()
}