import { useLayout } from "@/context/layout"
import { useSDK } from "@/context/sdk"
import { createSignal, createEffect, onCleanup, onMount, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { useParams } from "@solidjs/router"
import { showToast } from "@/utils/toast"

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
  const params = useParams<{ id: string }>()
  const sdk = useSDK()
  const [url, setUrl] = createSignal("")
  const [pageTitle, setPageTitle] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [annotationMode, setAnnotationMode] = createSignal(false)
  const [selectedElement, setSelectedElement] = createSignal<{ selector: string; info: unknown } | null>(null)
  const [comment, setComment] = createSignal("")
  const [sending, setSending] = createSignal(false)
  let containerRef: HTMLDivElement | undefined
  let commentInputRef: HTMLInputElement | undefined

  const isElectron = () => typeof window !== "undefined" && "iab" in window

  function syncWebViewBounds() {
    if (!containerRef || !window.iab) return
    const rect = containerRef.getBoundingClientRect()
    window.iab.attach({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    })
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

  async function toggleAnnotation() {
    const next = !annotationMode()
    setAnnotationMode(next)
    setSelectedElement(null)
    setComment("")

    if (next && window.iab) {
      const pageUrl = url() || (await window.iab.getURL())
      const all = ["a", "button", "input", "select", "textarea", "h1", "h2", "h3", "h4", "p", "img", "li", "td", "th", "div[data-testid]", "[tabindex]"]
        .map((s) => `${s}:not([hidden]):not([style*='display:none']):not([style*='display: none'])`)
        .join(",")

      await window.iab.evaluateJS(`
        (() => {
          const old = document.querySelectorAll('.iab-annotate-highlight')
          old.forEach(el => el.classList.remove('iab-annotate-highlight'))
          const style = document.createElement('style')
          style.id = 'iab-annotate-style'
          style.textContent = '.iab-annotate-highlight { outline: 2px solid #ff6b35 !important; outline-offset: 2px !important; cursor: crosshair !important; }'
          document.head.appendChild(style)

          const els = document.querySelectorAll(${JSON.stringify(all)})
          els.forEach(el => el.classList.add('iab-annotate-highlight'))

          let handler = (e) => {
            e.preventDefault()
            e.stopPropagation()
            const tag = e.target.tagName.toLowerCase()
            const id = e.target.id || ''
            const classes = Array.from(e.target.classList).filter(c => c !== 'iab-annotate-highlight').join('.')
            const selector = id ? '#' + CSS.escape(id) : tag + (classes ? '.' + classes.split(' ').join('.') : '')
            window.__iab_selected__ = selector
            els.forEach(el => el.classList.remove('iab-annotate-highlight'))
            document.getElementById('iab-annotate-style')?.remove()
            document.removeEventListener('click', handler, true)
          }
          document.addEventListener('click', handler, true)
        })()
      `)

      const result = await window.iab.evaluateJS("window.__iab_selected__ || null")
      if (result && typeof result === "string") {
        setSelectedElement({ selector: result, info: result })
        commentInputRef?.focus()
      } else {
        setAnnotationMode(false)
      }
    }
  }

  async function sendAnnotation() {
    const element = selectedElement()
    if (!element || !window.iab || !params.id) return

    setSending(true)
    try {
      const [screenshotBuf, elementInfo] = await Promise.all([
        window.iab.captureScreenshot(),
        window.iab.selectElement(element.selector),
      ])

      const parts: Array<{ type: "text"; text: string } | { type: "file"; mime: string; url: string; filename: string }> = []

      const commentText = comment().trim() || `Annotating element: ${element.selector}`
      parts.push({
        type: "text",
        text: `${commentText}\n\nElement: \`${element.selector}\`\nURL: ${url() || (await window.iab!.getURL())}`,
      })

      if (screenshotBuf) {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(screenshotBuf)))
        parts.push({
          type: "file",
          mime: "image/png",
          url: `data:image/png;base64,${base64}`,
          filename: "screenshot.png",
        })
      }

      if (elementInfo && typeof elementInfo === "object") {
        parts.push({
          type: "text",
          text: `Element details:\n\`\`\`json\n${JSON.stringify(elementInfo, null, 2)}\n\`\`\``,
        })
      }

      await sdk().client.session.promptAsync({
        sessionID: params.id,
        parts,
      })

      showToast(`Annotation sent for ${element.selector}`)
    } catch (err) {
      showToast(`Failed to send annotation: ${err}`)
    } finally {
      setSending(false)
      setAnnotationMode(false)
      setSelectedElement(null)
      setComment("")
    }
  }

  function cancelAnnotation() {
    if (window.iab) {
      window.iab.evaluateJS(`
        document.querySelectorAll('.iab-annotate-highlight').forEach(el => el.classList.remove('iab-annotate-highlight'))
        document.getElementById('iab-annotate-style')?.remove()
      `)
    }
    setAnnotationMode(false)
    setSelectedElement(null)
    setComment("")
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
          {selectedElement() ? `Selected: ${selectedElement()!.selector}` : (pageTitle() || "No page loaded")}
        </div>
        <Show when={!annotationMode() || !selectedElement()}>
          <button
            type="button"
            class="flex items-center gap-1 h-6 rounded-sm px-1.5 text-[12px] transition-colors focus-visible:outline-none"
            classList={{
              "text-v2-text-text-faint hover:bg-v2-overlay-simple-overlay-hover": !annotationMode(),
              "bg-v2-overlay-simple-overlay-pressed text-v2-text-text-muted": annotationMode(),
            }}
            onClick={toggleAnnotation}
            disabled={!isElectron()}
            title={annotationMode() ? "Cancel" : "Annotate page elements"}
          >
            <Icon name="edit" size="small" />
            <span>{annotationMode() ? "Cancel" : "Annotate"}</span>
          </button>
        </Show>
      </div>

      <Show when={annotationMode() && selectedElement()}>
        <div class="flex items-center gap-1 px-2 py-1.5 border-b border-border-weak-base bg-v2-overlay-simple-overlay-pressed">
          <input
            ref={commentInputRef}
            type="text"
            class="flex-1 min-w-0 h-7 rounded-sm px-2 text-[13px] bg-v2-surface-surface-input-default border border-v2-border-border-input-default text-v2-text-text-base outline-none focus:border-v2-border-border-active"
            placeholder="Add a comment..."
            value={comment()}
            onInput={(e) => setComment(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendAnnotation() }}
          />
          <button
            type="button"
            class="shrink-0 flex items-center justify-center w-7 h-7 rounded-sm bg-v2-accent-accent-base text-white hover:brightness-110 disabled:opacity-40"
            onClick={sendAnnotation}
            disabled={sending()}
            title="Send annotation to chat"
          >
            <Icon name="check" size="small" />
          </button>
          <button
            type="button"
            class="shrink-0 flex items-center justify-center w-7 h-7 rounded-sm hover:bg-v2-overlay-simple-overlay-hover"
            onClick={cancelAnnotation}
            disabled={sending()}
            title="Cancel"
          >
            <Icon name="xmark-small" size="small" />
          </button>
        </div>
      </Show>

      <div ref={containerRef} class="flex-1 relative" />

      {!isElectron() && (
        <div class="px-3 py-4 text-[12px] text-v2-text-text-faint text-center">
          Browser preview requires the Electron desktop app.
        </div>
      )}
    </aside>
  )
}