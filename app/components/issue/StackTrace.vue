<script setup lang="ts">
import type { ExceptionRecord, FrameLocation, FrameRecord } from '~/utils/sentry'

type FrameRow = { frame: FrameRecord, app: boolean, location: FrameLocation, key: string, index: number }

const props = defineProps<{ exceptions: ExceptionRecord[] }>()

const newestFirst = ref(false)
const openFrames = ref(new Set<string>())
const openMechanisms = ref(new Set<number>())

const chain = computed(() => {
  const groups = props.exceptions.map((exception, index) => ({ exception, index, frames: framesFor(exception) }))
  // Only the best-ranked frames count as app code. When every frame ties — a trace that is
  // all dependencies, or one the SDK flagged wholesale — they stay equal rather than all dim.
  const ranks = groups.flatMap(group => group.frames.map(frameRank))
  const best = ranks.length ? Math.max(...ranks) : 0
  return groups.map(({ exception, index, frames }) => ({
    exception,
    index,
    chips: mechanismChips(exception.mechanism),
    // The page header already names a single exception; only a chain needs re-identifying.
    identify: groups.length > 1,
    frames: frames.map((frame, frameIndex): FrameRow => ({
      frame,
      app: frameRank(frame) === best,
      location: frameLocationParts(frame),
      key: `${index}:${frameIndex}`,
      index: frameIndex
    }))
  }))
})

/**
 * `chain` is built newest-first (the throw site leads). Call order flips both the frames
 * and the causal chain, so the trace reads top-down as the program actually ran.
 */
const orderedChain = computed(() => {
  if (newestFirst.value) return chain.value
  return [...chain.value].reverse().map(group => ({ ...group, frames: [...group.frames].reverse() }))
})

const allFrames = computed(() => chain.value.flatMap(item => item.frames))
const inAppCount = computed(() => allFrames.value.filter(row => row.app).length)
const systemCount = computed(() => allFrames.value.length - inAppCount.value)
const minifiedCount = computed(() => allFrames.value.filter(row => looksMinified(row.frame)).length)
const sourceCount = computed(() => allFrames.value.filter(row => sourceLines(row.frame).length > 0).length)
const expandableCount = computed(() => allFrames.value.filter(row => frameHasDetails(row.frame)).length)
const stackText = computed(() => stackTraceText(props.exceptions))

/** Opens the frame most likely to hold the bug: the deepest app frame with source. */
const defaultOpenFrames = computed(() => {
  const keys: string[] = []
  for (const { frames } of chain.value) {
    const withSource = frames.filter(row => sourceLines(row.frame).length > 0)
    const target = withSource.find(row => row.app) || withSource[0]
    if (target) keys.push(target.key)
  }
  return keys
})

watch(defaultOpenFrames, (keys) => {
  openFrames.value = new Set(keys)
}, { immediate: true })

function renderedLines(frame: FrameRecord) {
  const column = Number(frame.colno || 0)
  return sourceLines(frame).flatMap((line) => {
    if (!line.active || column < 1) return [{ ...line, caret: false }]
    const indent = (line.code.match(/^\s*/)?.[0] || '').length
    const offset = Math.max(0, Math.min(column - 1, line.code.length)) - indent
    if (offset < 0) return [{ ...line, caret: false }]
    return [
      { ...line, caret: false },
      { number: 0, code: `${' '.repeat(indent)}${' '.repeat(offset)}^`, active: false, caret: true }
    ]
  })
}

function toggleFrame(key: string) {
  const next = new Set(openFrames.value)
  if (!next.delete(key)) next.add(key)
  openFrames.value = next
}

function toggleMechanism(index: number) {
  const next = new Set(openMechanisms.value)
  if (!next.delete(index)) next.add(index)
  openMechanisms.value = next
}

function mechanismChips(mechanism: ExceptionRecord['mechanism']) {
  if (!mechanism) return []
  return Object.entries(mechanism)
    .filter(([key, value]) => !['handled', 'data', 'description'].includes(key) && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${inlineValue(value, 40)}`)
}

function expandAll() {
  openFrames.value = new Set(chain.value.flatMap(({ frames }) => frames.map(row => row.key)))
}

function collapseAll() {
  openFrames.value = new Set()
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        :label="newestFirst ? 'Throw site first' : 'Call order'"
        :icon="newestFirst ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-narrow-wide'"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="newestFirst = !newestFirst"
      />
      <span class="font-mono text-[11px] text-dimmed">
        {{ allFrames.length }} frames · {{ inAppCount }} in app · {{ systemCount }} library
      </span>
      <div class="ml-auto flex items-center gap-1">
        <!-- Without source context or locals there is nothing behind a frame to open. -->
        <UButton
          v-if="expandableCount"
          label="Expand all"
          icon="i-lucide-unfold-vertical"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="expandAll"
        />
        <UButton
          v-if="expandableCount"
          label="Collapse"
          icon="i-lucide-fold-vertical"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="collapseAll"
        />
        <CopyButton
          :value="stackText"
          label="Copy"
          size="xs"
        />
      </div>
    </div>

    <UAlert
      v-if="minifiedCount && minifiedCount >= allFrames.length / 2"
      color="warning"
      variant="subtle"
      icon="i-lucide-file-search"
      title="This stack trace looks minified"
      :description="`${minifiedCount} of ${allFrames.length} frames have a position but no source. Upload source maps for this release so Argus can show the original code.`"
      :ui="{ title: 'text-sm', description: 'text-xs' }"
    />

    <UAlert
      v-if="!allFrames.length"
      color="neutral"
      variant="subtle"
      icon="i-lucide-file-warning"
      title="No stack frames captured"
      description="The SDK reported this exception without a stack trace. Check the breadcrumbs tab for the events that led here."
      :ui="{ title: 'text-sm', description: 'text-xs' }"
    />

    <UAlert
      v-else-if="!sourceCount && !minifiedCount"
      color="neutral"
      variant="subtle"
      icon="i-lucide-code"
      title="No source context in this event"
      description="The SDK sent frame positions but no surrounding code, so there is nothing to expand. See the SDK setup guide for how to attach code snippets."
      :ui="{ title: 'text-sm', description: 'text-xs' }"
    />

    <div
      v-for="{ exception, index, frames, chips, identify } in orderedChain"
      :key="index"
      class="overflow-hidden rounded-lg border border-default bg-elevated/20"
    >
      <header
        v-if="identify || chips.length || exception.mechanism?.description"
        class="border-b border-default bg-elevated/40 px-3 py-2"
      >
        <template v-if="identify">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="font-mono text-[11px] text-dimmed">#{{ chain.length - index }}</span>
            <code class="text-sm font-semibold text-error">{{ exception.type || 'Error' }}</code>
            <UBadge
              v-if="exception.mechanism?.handled !== undefined"
              :color="exception.mechanism.handled ? 'neutral' : 'error'"
              :variant="exception.mechanism.handled ? 'outline' : 'solid'"
              size="sm"
            >
              {{ exception.mechanism.handled ? 'handled' : 'unhandled' }}
            </UBadge>
            <UBadge
              v-if="exception.module"
              color="neutral"
              variant="outline"
              size="sm"
            >
              {{ exception.module }}
            </UBadge>
            <span
              v-if="index < chain.length - 1"
              class="text-[11px] text-dimmed"
            >
              caused by #{{ chain.length - index - 1 }}
            </span>
            <span class="ml-auto font-mono text-[11px] text-dimmed">{{ frames.length }} frames</span>
          </div>

          <p class="mt-1.5 break-words text-sm leading-6 text-highlighted">
            {{ exception.value || 'Exception without a message' }}
          </p>
        </template>

        <p
          v-if="exception.mechanism?.description"
          class="text-xs text-muted"
          :class="identify ? 'mt-1' : ''"
        >
          {{ exception.mechanism.description }}
        </p>

        <div
          v-if="chips.length"
          class="flex flex-wrap items-center gap-1"
          :class="identify || exception.mechanism?.description ? 'mt-2' : ''"
        >
          <span
            v-for="chip in chips"
            :key="chip"
            class="rounded bg-accented/50 px-1.5 py-0.5 font-mono text-[10px] text-muted"
          >{{ chip }}</span>
          <UButton
            v-if="hasValues(exception.mechanism?.data)"
            :label="openMechanisms.has(index) ? 'Hide mechanism data' : 'Mechanism data'"
            size="xs"
            color="neutral"
            variant="link"
            :ui="{ base: 'px-1 py-0 text-[10px]' }"
            @click="toggleMechanism(index)"
          />
        </div>

        <DataList
          v-if="openMechanisms.has(index)"
          :data="exception.mechanism?.data"
          class="mt-2 rounded border border-default bg-default px-2 py-1"
          key-width="8rem"
        />
      </header>

      <div class="divide-y divide-default/60">
        <div
          v-for="entry in frames"
          :key="entry.key"
          class="border-l-2"
          :class="entry.app ? 'border-l-error/60' : 'border-transparent'"
        >
          <button
            type="button"
            class="flex w-full min-w-0 items-center gap-2 py-1.5 pl-2 pr-3 text-left transition-colors"
            :class="[
              frameHasDetails(entry.frame) ? 'cursor-pointer hover:bg-elevated/60' : 'cursor-default',
              entry.app ? '' : 'opacity-70'
            ]"
            :disabled="!frameHasDetails(entry.frame)"
            @click="toggleFrame(entry.key)"
          >
            <UIcon
              v-if="frameHasDetails(entry.frame)"
              name="i-lucide-chevron-right"
              class="size-3 shrink-0 transition-transform"
              :class="[
                'text-dimmed',
                openFrames.has(entry.key) ? 'rotate-90' : ''
              ]"
            />
            <code
              class="min-w-0 shrink truncate font-mono text-[13px]"
              :class="entry.app ? 'font-semibold text-highlighted' : 'text-muted'"
            >{{ frameFunction(entry.frame) }}</code>
            <span
              v-if="index === 0 && entry.index === 0"
              class="shrink-0 rounded bg-error/10 px-1.5 py-px font-mono text-[10px] text-error/80"
            >thrown here</span>
            <!-- Directory dimmed and truncatable, file name and position always legible. -->
            <span
              class="ml-auto flex min-w-0 shrink items-baseline font-mono text-[11.5px]"
              :title="entry.location.full"
            >
              <span class="truncate text-dimmed">{{ entry.location.dir }}</span>
              <span
                class="shrink-0"
                :class="entry.app ? 'text-highlighted' : 'text-muted'"
              >{{ entry.location.file }}</span>
              <span class="shrink-0 text-dimmed">{{ entry.location.position }}</span>
            </span>
          </button>

          <div
            v-if="openFrames.has(entry.key) && frameHasDetails(entry.frame)"
            class="border-t border-default/60 bg-default"
          >
            <div
              v-if="sourceLines(entry.frame).length"
              class="overflow-x-auto py-1 font-mono text-[11.5px] leading-[1.65]"
            >
              <div
                v-for="(line, lineIndex) in renderedLines(entry.frame)"
                :key="lineIndex"
                class="flex min-w-max"
                :class="line.active ? 'bg-error/10' : ''"
              >
                <span class="w-12 shrink-0 select-none border-r border-default/60 px-2 text-right text-dimmed">{{ line.caret ? '' : line.number }}</span>
                <code
                  class="whitespace-pre px-3"
                  :class="line.active ? 'font-medium text-error' : line.caret ? 'text-error/70' : 'text-muted'"
                >{{ line.code }}</code>
              </div>
            </div>

            <div
              v-if="hasValues(entry.frame.vars)"
              class="border-t border-default/60 px-3 py-2"
            >
              <p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-dimmed">
                Local variables
              </p>
              <DataList
                :data="entry.frame.vars"
                key-width="10rem"
              />
            </div>

            <div
              v-if="frameMetadata(entry.frame).length"
              class="flex flex-wrap gap-1 border-t border-default/60 px-3 py-2"
            >
              <span
                v-for="[metaKey, metaValue] in frameMetadata(entry.frame)"
                :key="metaKey"
                class="max-w-full truncate rounded bg-accented/50 px-1.5 py-0.5 font-mono text-[10px] text-muted"
                :title="String(metaValue)"
              >{{ metaKey }}: {{ inlineValue(metaValue, 60) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
