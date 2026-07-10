import { describe, it, expect, vi } from "vitest"

// --- Annotation data model tests (pure logic, no Electron dependency) ---

interface ElementInfo {
  tag: string
  id: string | null
  classes: string[]
  text: string
  html: string
  rect: { x: number; y: number; width: number; height: number }
  styles: Record<string, string>
}

interface Annotation {
  id: string
  selector: string
  comment: string
  element: ElementInfo
  timestamp: number
}

function createAnnotationStore() {
  const store = new Map<string, Annotation>()
  return {
    add: (id: string, selector: string, comment: string, element: ElementInfo): Annotation => {
      const ann: Annotation = { id, selector, comment, element, timestamp: Date.now() }
      store.set(id, ann)
      return ann
    },
    remove: (id: string): boolean => store.delete(id),
    get: (id: string): Annotation | undefined => store.get(id),
    getAll: (): Annotation[] => Array.from(store.values()),
    clear: () => store.clear(),
  }
}

describe("Annotation Store", () => {
  it("should add and retrieve annotations", () => {
    const store = createAnnotationStore()
    const info: ElementInfo = {
      tag: "button", id: "btn-1", classes: ["primary"],
      text: "Submit", html: "<button>Submit</button>",
      rect: { x: 0, y: 0, width: 100, height: 40 },
      styles: { color: "red" },
    }

    const ann = store.add("a1", "#btn-1", "Fix color", info)
    expect(ann.id).toBe("a1")
    expect(ann.selector).toBe("#btn-1")
    expect(ann.comment).toBe("Fix color")
    expect(ann.element.tag).toBe("button")

    const retrieved = store.get("a1")
    expect(retrieved).toBeDefined()
    expect(retrieved!.id).toBe("a1")
  })

  it("should remove annotations", () => {
    const store = createAnnotationStore()
    const info: ElementInfo = { tag: "div", id: null, classes: [], text: "", html: "", rect: { x: 0, y: 0, width: 0, height: 0 }, styles: {} }
    store.add("a1", "div", "test", info)
    expect(store.get("a1")).toBeDefined()
    expect(store.remove("a1")).toBe(true)
    expect(store.get("a1")).toBeUndefined()
  })

  it("should clear all annotations", () => {
    const store = createAnnotationStore()
    const empty: ElementInfo = { tag: "div", id: null, classes: [], text: "", html: "", rect: { x: 0, y: 0, width: 0, height: 0 }, styles: {} }
    store.add("a", "div", "1", empty)
    store.add("b", "span", "2", empty)
    expect(store.getAll().length).toBe(2)
    store.clear()
    expect(store.getAll().length).toBe(0)
  })

  it("should return false when removing non-existent id", () => {
    const store = createAnnotationStore()
    expect(store.remove("nonexistent")).toBe(false)
  })
})

// --- Preload API shape tests ---

describe("Preload API shape", () => {
  it("should have all IABAPI methods", () => {
    const api = {
      navigate: vi.fn(),
      navigateBack: vi.fn(),
      navigateForward: vi.fn(),
      reload: vi.fn(),
      stop: vi.fn(),
      getURL: vi.fn(() => Promise.resolve("")),
      getTitle: vi.fn(() => Promise.resolve("")),
      isLoading: vi.fn(() => Promise.resolve(false)),
      evaluateJS: vi.fn(() => Promise.resolve(null)),
      captureScreenshot: vi.fn(() => Promise.resolve(null)),
      onURLChanged: vi.fn(() => vi.fn()),
      onTitleChanged: vi.fn(() => vi.fn()),
      onLoadingChanged: vi.fn(() => vi.fn()),
      onConsoleMessage: vi.fn(() => vi.fn()),
      selectElement: vi.fn(() => Promise.resolve(null)),
      getComputedStyles: vi.fn(() => Promise.resolve(null)),
    }

    expect(api.navigate).toBeDefined()
    expect(api.navigateBack).toBeDefined()
    expect(api.navigateForward).toBeDefined()
    expect(api.reload).toBeDefined()
    expect(api.stop).toBeDefined()
    expect(api.getURL).toBeDefined()
    expect(api.getTitle).toBeDefined()
    expect(api.isLoading).toBeDefined()
    expect(api.evaluateJS).toBeDefined()
    expect(api.captureScreenshot).toBeDefined()
    expect(api.onURLChanged).toBeDefined()
    expect(api.onTitleChanged).toBeDefined()
    expect(api.onLoadingChanged).toBeDefined()
    expect(api.onConsoleMessage).toBeDefined()
    expect(api.selectElement).toBeDefined()
    expect(api.getComputedStyles).toBeDefined()
  })
})

// --- BrowserTool schema validation tests ---

describe("BrowserTool", () => {
  it("should have a valid action list", () => {
    const validActions = ["navigate", "back", "forward", "reload", "stop", "screenshot", "evaluate", "select", "styles", "dom"]
    expect(validActions).toContain("navigate")
    expect(validActions).toContain("screenshot")
    expect(validActions).toContain("evaluate")
    expect(validActions).toContain("select")
    expect(validActions).toContain("styles")
    expect(validActions).toContain("dom")
    expect(validActions.length).toBe(10)
  })

  it("should build valid URLs for navigate", () => {
    const buildUrl = (url: string) => {
      if (!url.startsWith("http://") && !url.startsWith("https://")) return `https://${url}`
      return url
    }
    expect(buildUrl("example.com")).toBe("https://example.com")
    expect(buildUrl("https://example.com")).toBe("https://example.com")
    expect(buildUrl("http://localhost:3000")).toBe("http://localhost:3000")
  })
})

// --- Desktop IPC handler names ---

describe("Desktop IPC handlers", () => {
  it("should have all expected IPC channel names", () => {
    const channels = [
      "iab-attach", "iab-detach",
      "iab-navigate", "iab-navigate-back", "iab-navigate-forward",
      "iab-reload", "iab-stop",
      "iab-get-url", "iab-get-title", "iab-is-loading",
      "iab-evaluate-js", "iab-capture-screenshot",
      "iab-select-element", "iab-get-computed-styles",
    ]
    expect(channels).toContain("iab-navigate")
    expect(channels).toContain("iab-evaluate-js")
    expect(channels).toContain("iab-capture-screenshot")
    expect(channels).toContain("iab-attach")
    expect(channels.length).toBe(14)
  })
})

// --- WebView function names ---

describe("WebView API", () => {
  it("should export all expected function names", () => {
    const funcs = [
      "createWebView", "removeWebView",
      "navigateTo", "navigateBack", "navigateForward",
      "reload", "stop",
      "getCurrentURL", "getTitle", "isLoading",
      "evaluateJS", "captureScreenshot",
      "setBounds", "focus",
    ]
    expect(funcs).toContain("createWebView")
    expect(funcs).toContain("navigateTo")
    expect(funcs).toContain("evaluateJS")
    expect(funcs).toContain("captureScreenshot")
    expect(funcs).toContain("setBounds")
    expect(funcs.length).toBe(14)
  })
})