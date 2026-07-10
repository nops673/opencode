import { useLayout } from "@/context/layout"
import { createSignal, createEffect, onCleanup, createMemo, onMount } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"

declare global {
  interface Window {
    iab?: {
      attach: (bounds?: { x: number; y: number; width: number; height: number }) => Promise<unknown>
      detach: () => Promise<unknown>
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
      selectElement: (selector: string) => Promise<unknown>
      getComputedStyles: (selector: string) => Promise<Record<string, string> | null>
      onURLChanged: (cb: (url: string) => void) => () => void
      onTitleChanged: (cb: (title: string) => void) => () => void
      onLoadingChanged: (cb: (loading: boolean) => void) => () => void
    }
  }
}

export function IabPanel() {
  const layout = useLayout()
  const iab = layout.iab
  const [url, setUrl] = createSignal("")
  const [pageTitle, setPageTitle] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [annotationMode, setAnnotationMode] = createSignal(false)
  let containerRef: HTMLDivElement | undefined

  const isElectron = () => typeof window !== "undefined" && "iab" in window

  function syncWebViewBounds() {
    if (!containerRef || !window.iab) return
    const rect = containerRef.getBoundingClientRect()
    window.iab.attach({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) })
  }

  onMount(() => {
    if (!window.iab) return
    syncWebViewBounds()
    const unsubURL = window.iab.onURLChanged((u) => setUrl(u))
    const unsubTitle = window.iab.onTitleChanged((t) => setPageTitle(t))
    const unsubLoad = window.iab.onLoadingChanged((l) => setLoading(l))
    onCleanup(() => {
      unsubURL()
      unsubTitle()
      unsubLoad()
      window.iab?.detach()
    })
  })

  createEffect(() => {
    if (!iab.opened() || !containerRef || !window.iab) return
    syncWebViewBounds()
  })

  function handleNavigate() {
    const val = url().trim()
    if (!val || !window.iab) return
    window.iab.navigate(val)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleNavigate()
  }

  function toggleAnnotation() {
    const next = !annotationMode()
    setAnnotationMode(next)
  }

  function handleBack() { window.iab?.navigateBack() }
  function handleForward() { window.iab?.navigateForward() }
  function handleReload() { window.iab?.reload() }
  function handleStop() { window.iab?.stop() }

  return (
    <aside
      class="flex flex-col h-full border-l border-border-weak-base bg-surface-base"
      style={{ width: `${iab.width()}px` }}
    >
      <div class="flex items-center gap-1 px-2 py-1.5 border-b border-border-weak-base">
        <button
          type="button"
          class="flex items-center justify-center w-6 h-6 rounded-sm hover:bg-v2-overlay-simple-overlay-hover disabled:opacity-30"
          onClick={handleBack}
          disabled={!isElectron()}
          title="Back"
        >
          <Icon name="outline-square-arrow" size="small" />
        </button>
        <button
          type="button"
          class="flex items-center justify-center w-6 h-6 rounded-sm hover:bg-v2-overlay-simple-overlay-hover disabled:opacity-30"
          onClick={handleForward}
          disabled={!isElectron()}
          title="Forward"
        >
          <Icon name="outline-square-arrow" size="small" style="transform: scaleX(-1)" />
        </button>
        <div class="flex-1 flex items-center gap-1 min-w-0">
          <input
            type="text"
            class="flex-1 min-w-0 h-7 rounded-sm px-2 text-[13px] bg-v2-surface-surface-input-default border border-v2-border-border-input-default text-v2-text-text-base outline-none focus:border-v2-border-border-active"
            placeholder="Enter URL..."
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            class="shrink-0 flex items-center justify-center w-6 h-6 rounded-sm hover:bg-v2-overlay-simple-overlay-hover disabled:opacity-30"
            onClick={loading() ? handleStop : handleReload}
            disabled={!isElectron()}
            title={loading() ? "Stop" : "Reload"}
          >
            <Icon name={loading() ? "close" : "reset"} size="small" />
          </button>
        </div>
      </div>

      <div class="flex items-center gap-1 px-2 py-1 border-b border-border-weak-base">
        <div class="flex-1 text-[12px] text-v2-text-text-faint truncate">
          {pageTitle() || "No page loaded"}
        </div>
        <button
          type="button"
          class="flex items-center gap-1 h-6 rounded-sm px-1.5 text-[12px] transition-colors focus-visible:outline-none"
          classList={{
            "text-v2-text-text-faint hover:bg-v2-overlay-simple-overlay-hover": !annotationMode(),
            "bg-v2-overlay-simple-overlay-pressed text-v2-text-text-muted": annotationMode(),
          }}
          onClick={toggleAnnotation}
          disabled={!isElectron()}
          title={annotationMode() ? "Exit annotation mode" : "Annotate page elements"}
        >
          <Icon name="edit" size="small" />
          <span>Annotate</span>
        </button>
      </div>

      <div ref={containerRef} class="flex-1 relative" />

      {!isElectron() && (
        <div class="px-3 py-4 text-[12px] text-v2-text-text-faint text-center">
          Browser preview requires the Electron desktop app.
        </div>
      )}
    </aside>
  )
}