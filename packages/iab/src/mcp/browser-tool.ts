import { Effect, Schema } from "effect"
import * as WebView from "../webview"
import * as Overlay from "../annotations/overlay"
import { getView, isAttached } from "../desktop/main"
import DESCRIPTION from "./browser-tool.txt"

const Parameters = Schema.Struct({
  action: Schema.String.annotate({
    description: "Action to perform: navigate, back, forward, reload, stop, screenshot, evaluate, select, styles, dom",
  }),
  url: Schema.optional(Schema.String).annotate({
    description: "URL for navigate action",
  }),
  code: Schema.optional(Schema.String).annotate({
    description: "JavaScript code for evaluate action",
  }),
  selector: Schema.optional(Schema.String).annotate({
    description: "CSS selector for select/styles actions",
  }),
})

export type Parameters = Schema.Schema.Type<typeof Parameters>

export function createBrowserTool() {
  return {
    description: DESCRIPTION,
    parameters: Parameters,
    execute: (params: Parameters) =>
      Effect.gen(function* () {
        if (!isAttached()) {
          return {
            title: "Browser not attached",
            metadata: {},
            output: "IAB is not attached to any window. Call attach first.",
          }
        }

        const view = getView()!
        const { action } = params

        switch (action) {
          case "navigate": {
            if (!params.url) return { title: "Error", metadata: {}, output: "URL required for navigate" }
            let targetUrl = params.url
            if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
              targetUrl = `https://${targetUrl}`
            }
            WebView.navigateTo(view, targetUrl)
            return { title: "Navigated", metadata: {}, output: `Navigating to ${targetUrl}` }
          }

          case "back": {
            WebView.navigateBack(view)
            return { title: "Go Back", metadata: {}, output: "Navigated back" }
          }

          case "forward": {
            WebView.navigateForward(view)
            return { title: "Go Forward", metadata: {}, output: "Navigated forward" }
          }

          case "reload": {
            WebView.reload(view)
            return { title: "Reload", metadata: {}, output: "Page reloading" }
          }

          case "stop": {
            WebView.stop(view)
            return { title: "Stop", metadata: {}, output: "Load stopped" }
          }

          case "screenshot": {
            const buf = yield* Effect.promise(() => WebView.captureScreenshot(view))
            if (!buf) return { title: "Error", metadata: {}, output: "Failed to capture screenshot" }
            return {
              title: "Screenshot",
              metadata: { screenshot: buf.toString("base64") },
              output: `Screenshot captured (${buf.length} bytes)`,
            }
          }

          case "evaluate": {
            if (!params.code) return { title: "Error", metadata: {}, output: "Code required for evaluate" }
            const result = yield* Effect.promise(() => WebView.evaluateJS(view, params.code!))
            return { title: "Evaluate", metadata: {}, output: JSON.stringify(result, null, 2) }
          }

          case "select": {
            if (!params.selector) return { title: "Error", metadata: {}, output: "Selector required" }
            const info = yield* Effect.promise(() => Overlay.selectElement(view, params.selector!))
            if (!info) return { title: "Not Found", metadata: {}, output: `Element "${params.selector}" not found` }
            return { title: "Element", metadata: {}, output: JSON.stringify(info, null, 2) }
          }

          case "styles": {
            if (!params.selector) return { title: "Error", metadata: {}, output: "Selector required" }
            const styles = yield* Effect.promise(() => Overlay.getComputedStyles(view, params.selector!))
            if (!styles) return { title: "Not Found", metadata: {}, output: `Element "${params.selector}" not found` }
            return { title: "Styles", metadata: {}, output: JSON.stringify(styles, null, 2) }
          }

          case "dom": {
            const dom = yield* Effect.promise(() => Overlay.getPageDOM(view))
            return { title: "DOM", metadata: {}, output: dom ?? "Failed to get DOM" }
          }

          default:
            return { title: "Error", metadata: {}, output: `Unknown action: ${action}` }
        }
      }),
  }
}