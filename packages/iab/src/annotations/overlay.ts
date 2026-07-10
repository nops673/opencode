import { WebContentsView } from "electron"
import { evaluateJS } from "../webview"

export type ElementInfo = {
  tag: string
  id: string | null
  classes: string[]
  text: string
  html: string
  rect: { x: number; y: number; width: number; height: number }
  styles: Record<string, string>
}

export type Annotation = {
  id: string
  selector: string
  comment: string
  element: ElementInfo
  timestamp: number
}

const annotations = new Map<string, Annotation>()

export function addAnnotation(
  id: string,
  selector: string,
  comment: string,
  element: ElementInfo,
): Annotation {
  const annotation: Annotation = { id, selector, comment, element, timestamp: Date.now() }
  annotations.set(id, annotation)
  return annotation
}

export function removeAnnotation(id: string): boolean {
  return annotations.delete(id)
}

export function getAnnotation(id: string): Annotation | undefined {
  return annotations.get(id)
}

export function getAllAnnotations(): Annotation[] {
  return Array.from(annotations.values())
}

export function clearAnnotations() {
  annotations.clear()
}

export async function selectElement(
  view: WebContentsView,
  selector: string,
): Promise<ElementInfo | null> {
  return evaluateJS<ElementInfo>(
    view,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const styles = window.getComputedStyle(el)
      const styleObj = {}
      for (let i = 0; i < styles.length; i++) {
        const key = styles[i]
        styleObj[key] = styles.getPropertyValue(key)
      }
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: Array.from(el.classList),
        text: el.textContent?.trim().slice(0, 200) ?? "",
        html: el.outerHTML.slice(0, 500),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        styles: styleObj
      }
    })()`,
  )
}

export async function highlightElement(
  view: WebContentsView,
  selector: string,
): Promise<void> {
  await evaluateJS(
    view,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return
      el.style.outline = "3px solid #ff6b35"
      el.style.outlineOffset = "2px"
      el.style.backgroundColor = "rgba(255, 107, 53, 0.1)"
    })()`,
  )
}

export async function clearHighlights(view: WebContentsView): Promise<void> {
  await evaluateJS(
    view,
    `(() => {
      document.querySelectorAll("[style*='outline: 3px solid rgb(255, 107, 53)']")
        .forEach(el => {
          el.style.outline = ""
          el.style.outlineOffset = ""
          el.style.backgroundColor = ""
        })
    })()`,
  )
}

export async function getComputedStyles(
  view: WebContentsView,
  selector: string,
): Promise<Record<string, string> | null> {
  return evaluateJS<Record<string, string>>(
    view,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return null
      const styles = window.getComputedStyle(el)
      const result = {}
      for (let i = 0; i < styles.length; i++) {
        const key = styles[i]
        result[key] = styles.getPropertyValue(key)
      }
      return result
    })()`,
  )
}

export async function applyStyle(
  view: WebContentsView,
  selector: string,
  property: string,
  value: string,
): Promise<boolean> {
  const result = await evaluateJS(
    view,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return false
      el.style[${JSON.stringify(property)}] = ${JSON.stringify(value)}
      return true
    })()`,
  )
  return result === true
}

export async function getPageDOM(view: WebContentsView): Promise<string | null> {
  return evaluateJS<string>(
    view,
    `document.documentElement.outerHTML.slice(0, 100000)`,
  )
}