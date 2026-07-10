import { Icon } from "@opencode-ai/ui/icon"
import { useLayout } from "@/context/layout"

export function IabToggle() {
  const layout = useLayout()
  const iabOpened = layout.iab.opened

  return (
    <button
      data-action="iab-toggle"
      type="button"
      class="flex h-7 min-w-0 items-center gap-1.5 rounded-sm px-2 text-[13px] font-[440] leading-5 tracking-[-0.04px] transition-colors focus-visible:outline-none"
      classList={{
        "text-v2-text-text-faint hover:bg-v2-overlay-simple-overlay-hover": !iabOpened(),
        "bg-v2-overlay-simple-overlay-pressed text-v2-text-text-muted": iabOpened(),
      }}
      onClick={() => layout.iab.toggle()}
      title={iabOpened() ? "Close browser" : "Open browser"}
    >
      <Icon name="sidebar-right" size="small" class="shrink-0" />
      <span class="min-w-0 truncate leading-5">Browser</span>
    </button>
  )
}