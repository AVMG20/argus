/**
 * Appearance preferences live in localStorage only: they change nothing on the
 * server and nothing about the stored events, so every device can pick its own
 * accent, neutral, and sidebar treatment.
 */
export type SidebarBackground = 'subtle' | 'solid' | 'flat' | 'tinted' | 'gradient' | 'glass'

export type Appearance = {
  primary: string
  neutral: string
  sidebar: SidebarBackground
}

/** Swatch hexes mirror the Tailwind 500 shade; `green` is the brand override from main.css. */
export const primaryColors = [
  { label: 'Argus green', value: 'green', hex: '#00C16A' },
  { label: 'Emerald', value: 'emerald', hex: '#00BC7D' },
  { label: 'Teal', value: 'teal', hex: '#00BBA7' },
  { label: 'Cyan', value: 'cyan', hex: '#00B8DB' },
  { label: 'Sky', value: 'sky', hex: '#00A6F4' },
  { label: 'Blue', value: 'blue', hex: '#2B7FFF' },
  { label: 'Indigo', value: 'indigo', hex: '#615FFF' },
  { label: 'Violet', value: 'violet', hex: '#8E51FF' },
  { label: 'Purple', value: 'purple', hex: '#AD46FF' },
  { label: 'Fuchsia', value: 'fuchsia', hex: '#E12AFB' },
  { label: 'Pink', value: 'pink', hex: '#F6339A' },
  { label: 'Rose', value: 'rose', hex: '#FF2056' },
  { label: 'Red', value: 'red', hex: '#FB2C36' },
  { label: 'Orange', value: 'orange', hex: '#FF6900' },
  { label: 'Amber', value: 'amber', hex: '#FE9A00' },
  { label: 'Yellow', value: 'yellow', hex: '#F0B100' },
  { label: 'Lime', value: 'lime', hex: '#7CCF00' }
] as const

export const neutralColors = [
  { label: 'Zinc', value: 'zinc', hex: '#71717B' },
  { label: 'Slate', value: 'slate', hex: '#62748E' },
  { label: 'Gray', value: 'gray', hex: '#6A7282' },
  { label: 'Neutral', value: 'neutral', hex: '#737373' },
  { label: 'Stone', value: 'stone', hex: '#79716B' }
] as const

/**
 * Static class strings so Tailwind keeps them in the build; a computed
 * `bg-${value}` would never be generated.
 */
export const sidebarBackgrounds = [
  { label: 'Subtle', value: 'subtle', icon: 'i-lucide-panel-left', description: 'Slightly raised panel', class: 'bg-elevated/60' },
  { label: 'Solid', value: 'solid', icon: 'i-lucide-square', description: 'Full elevated surface', class: 'bg-elevated' },
  { label: 'Flat', value: 'flat', icon: 'i-lucide-minus', description: 'Same surface as the page', class: 'bg-default' },
  { label: 'Tinted', value: 'tinted', icon: 'i-lucide-droplet', description: 'Washed with the accent color', class: 'bg-primary/5' },
  { label: 'Gradient', value: 'gradient', icon: 'i-lucide-blend', description: 'Accent fading into the page', class: 'bg-linear-to-b from-primary/15 via-elevated/50 to-default' },
  { label: 'Glass', value: 'glass', icon: 'i-lucide-layers', description: 'Translucent and blurred', class: 'bg-elevated/30 backdrop-blur-xl' }
] as const

const STORAGE_KEY = 'argus-appearance'

const defaults: Appearance = { primary: 'green', neutral: 'zinc', sidebar: 'subtle' }

function isValid(value: Partial<Appearance>): Appearance {
  return {
    primary: primaryColors.some(color => color.value === value.primary) ? value.primary! : defaults.primary,
    neutral: neutralColors.some(color => color.value === value.neutral) ? value.neutral! : defaults.neutral,
    sidebar: sidebarBackgrounds.some(background => background.value === value.sidebar) ? value.sidebar! : defaults.sidebar
  }
}

export function useAppearance() {
  const appearance = useState<Appearance>('argus-appearance', () => ({ ...defaults }))
  const colorMode = useColorMode()

  const sidebarClass = computed(() => sidebarBackgrounds.find(item => item.value === appearance.value.sidebar)?.class || '')
  const isDark = computed(() => colorMode.value === 'dark')

  function apply() {
    updateAppConfig({ ui: { colors: { primary: appearance.value.primary, neutral: appearance.value.neutral } } })
  }

  function persist() {
    if (import.meta.client) localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance.value))
  }

  function set(patch: Partial<Appearance>) {
    appearance.value = isValid({ ...appearance.value, ...patch })
    apply()
    persist()
  }

  function reset() {
    set({ ...defaults })
  }

  function toggleColorMode() {
    colorMode.preference = isDark.value ? 'light' : 'dark'
  }

  /** Called once on the client so a saved accent survives a reload. */
  function restore() {
    if (!import.meta.client) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        appearance.value = isValid(JSON.parse(stored))
      } catch {
        appearance.value = { ...defaults }
      }
    }
    apply()
  }

  return { appearance, sidebarClass, isDark, set, reset, restore, toggleColorMode }
}
