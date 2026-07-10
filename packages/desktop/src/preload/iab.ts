import { contextBridge, ipcRenderer } from "electron"

export interface IABAPI {
  navigate: (url: string) => Promise<void>
  navigateBack: () => Promise<void>
  navigateForward: () => Promise<void>
  reload: () => Promise<void>
  stop: () => Promise<void>
  getURL: () => Promise<string>
  getTitle: () => Promise<string>
  isLoading: () => Promise<boolean>
  evaluateJS: (code: string) => Promise<unknown>
  captureScreenshot: () => Promise<Uint8Array | null>
  onURLChanged: (cb: (url: string) => void) => () => void
  onTitleChanged: (cb: (title: string) => void) => () => void
  onLoadingChanged: (cb: (loading: boolean) => void) => () => void
  onConsoleMessage: (cb: (msg: string) => void) => () => void
  selectElement: (selector: string) => Promise<unknown>
  getComputedStyles: (selector: string) => Promise<Record<string, string> | null>
}

const api: IABAPI = {
  navigate: (url) => ipcRenderer.invoke("iab-navigate", url),
  navigateBack: () => ipcRenderer.invoke("iab-navigate-back"),
  navigateForward: () => ipcRenderer.invoke("iab-navigate-forward"),
  reload: () => ipcRenderer.invoke("iab-reload"),
  stop: () => ipcRenderer.invoke("iab-stop"),
  getURL: () => ipcRenderer.invoke("iab-get-url"),
  getTitle: () => ipcRenderer.invoke("iab-get-title"),
  isLoading: () => ipcRenderer.invoke("iab-is-loading"),
  evaluateJS: (code) => ipcRenderer.invoke("iab-evaluate-js", code),
  captureScreenshot: () => ipcRenderer.invoke("iab-capture-screenshot"),
  onURLChanged: (cb) => {
    const handler = (_: unknown, url: string) => cb(url)
    ipcRenderer.on("iab-url-changed", handler)
    return () => ipcRenderer.removeListener("iab-url-changed", handler)
  },
  onTitleChanged: (cb) => {
    const handler = (_: unknown, title: string) => cb(title)
    ipcRenderer.on("iab-title-changed", handler)
    return () => ipcRenderer.removeListener("iab-title-changed", handler)
  },
  onLoadingChanged: (cb) => {
    const handler = (_: unknown, loading: boolean) => cb(loading)
    ipcRenderer.on("iab-loading-changed", handler)
    return () => ipcRenderer.removeListener("iab-loading-changed", handler)
  },
  onConsoleMessage: (cb) => {
    const handler = (_: unknown, msg: string) => cb(msg)
    ipcRenderer.on("iab-console-message", handler)
    return () => ipcRenderer.removeListener("iab-console-message", handler)
  },
  selectElement: (selector) => ipcRenderer.invoke("iab-select-element", selector),
  getComputedStyles: (selector) => ipcRenderer.invoke("iab-get-computed-styles", selector),
}

contextBridge.exposeInMainWorld("iab", api)