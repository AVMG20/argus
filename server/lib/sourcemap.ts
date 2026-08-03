import { TraceMap, originalPositionFor, sourceContentFor } from '@jridgewell/trace-mapping'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../db'
import { sourceMapArtifact } from '../db/schema'
import type { Frame } from './ingest'

/** Lines of original source kept either side of the resolved line. */
const CONTEXT_LINES = 5

/**
 * Parsed maps are held between requests because decoding one is far more expensive than
 * the lookups it serves. The budget is in bytes rather than entries: a decoded bundle map
 * runs to tens of megabytes, so a count says nothing about the memory actually held.
 * Serialized length stands in for the decoded footprint, which it under-counts but tracks.
 */
const CACHE_LIMIT_BYTES = 256 * 1024 * 1024
const parsedMaps = new Map<string, { map: TraceMap, bytes: number }>()
let cachedBytes = 0

function cachedMap(id: string) {
  const entry = parsedMaps.get(id)
  if (!entry) return
  // Re-insert so the map moves to the most-recently-used end of the eviction order.
  parsedMaps.delete(id)
  parsedMaps.set(id, entry)
  return entry.map
}

function parseArtifact(id: string, content: string) {
  const map = new TraceMap(JSON.parse(content))
  // Drop any previous entry first, so re-parsing an id cannot double count its bytes.
  forgetSourceMaps([id])
  parsedMaps.set(id, { map, bytes: content.length })
  cachedBytes += content.length

  // Never evict down to nothing: one map larger than the budget would otherwise be
  // dropped the moment it was parsed, and re-parsed on every request.
  while (cachedBytes > CACHE_LIMIT_BYTES && parsedMaps.size > 1) {
    const [oldest, entry] = parsedMaps.entries().next().value!
    parsedMaps.delete(oldest)
    cachedBytes -= entry.bytes
  }
  return map
}

export function forgetSourceMaps(ids: string[]) {
  for (const id of ids) {
    const entry = parsedMaps.get(id)
    if (!entry) continue
    parsedMaps.delete(id)
    cachedBytes -= entry.bytes
  }
}

/**
 * Reduces the many shapes a frame path arrives in — absolute URLs, Sentry's `app:///`
 * scheme, `~/` upload prefixes, Windows separators — to one comparable relative path.
 */
export function normalizeArtifactPath(value: unknown) {
  let path = String(value || '').trim().replaceAll('\\', '/')
  if (!path) return ''

  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(path)
  if (scheme) {
    try {
      path = new URL(path).pathname
    } catch {
      // Schemes like `app:///` are not valid URLs everywhere; drop the authority by hand.
      path = path.slice(scheme[0].length).replace(/^[^/]*/, '')
    }
  }

  path = path.split(/[?#]/)[0] || ''
  return path.replace(/^~/, '').replace(/^\.\//, '').replace(/^\/+/, '')
}

export function artifactBasename(path: string) {
  return path.split('/').pop() || path
}

/** Bundler source URLs carry scheme and traversal noise that hides the real file name. */
export function cleanSourcePath(source: string) {
  let path = String(source || '').replaceAll('\\', '/')

  if (path.startsWith('webpack://')) path = path.slice('webpack://'.length).replace(/^[^/]*\//, '')
  else if (path.startsWith('file://')) path = path.slice('file://'.length)
  else {
    const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(path)
    if (scheme) path = path.slice(scheme[0].length).replace(/^[^/]*/, '')
  }

  while (path.startsWith('./') || path.startsWith('../')) path = path.replace(/^\.\.?\//, '')
  return path.replace(/^\/+/, '') || String(source || '')
}

/** A frame is worth resolving when it has a position but no source context to show. */
export function needsSourceMap(frame: Frame) {
  const hasPosition = Boolean(frame.lineno)
  const hasSource = Boolean(frame.contextLine ?? frame.context_line)
  return hasPosition && !hasSource
}

/** The `.map` names a frame could have been built from, most specific first. */
function lookupNames(frame: Frame) {
  const names = new Set<string>()
  for (const value of [frame.filename, frame.abs_path]) {
    const path = normalizeArtifactPath(value)
    if (!path) continue
    names.add(path.endsWith('.map') ? path : `${path}.map`)
  }
  return [...names]
}

type ArtifactRow = { id: string, release: string, name: string, basename: string }

/** The one match, or nothing when picking between several would be a guess. */
function only(rows: ArtifactRow[]) {
  return rows.length === 1 ? rows[0] : undefined
}

/**
 * Picks the map for a frame, tightening from an exact path match in the event's own
 * release outward. The cross-release fallback matters because plenty of SDKs never set a
 * release at all, but it only applies when the match is unambiguous: with several builds
 * to choose from there is nothing that says which one a frame came from, and the wrong map
 * resolves to plausible-looking line numbers that are harder to distrust than no mapping.
 */
function selectArtifact(frame: Frame, release: string, artifacts: ArtifactRow[]) {
  const names = lookupNames(frame)
  if (!names.length) return
  const basenames = names.map(artifactBasename)

  const byName = (row: ArtifactRow) => names.includes(row.name)
  const byBasename = (row: ArtifactRow) => basenames.includes(row.basename)

  // Inside the event's own release the newest upload is the answer, so `find` is enough.
  const sameRelease = artifacts.filter(row => row.release === release)
  return sameRelease.find(byName)
    ?? sameRelease.find(byBasename)
    ?? only(artifacts.filter(byName))
    ?? only(artifacts.filter(byBasename))
}

function contextAround(map: TraceMap, source: string, line: number) {
  const content = sourceContentFor(map, source)
  if (!content) return
  const lines = content.split(/\r?\n/)
  const index = line - 1
  if (index < 0 || index >= lines.length) return

  return {
    contextLine: lines[index],
    preContext: lines.slice(Math.max(0, index - CONTEXT_LINES), index),
    postContext: lines.slice(index + 1, index + 1 + CONTEXT_LINES)
  }
}

function resolveFrame(frame: Frame, map: TraceMap, artifact: ArtifactRow): Frame {
  const traced = originalPositionFor(map, {
    line: Number(frame.lineno),
    // Sentry columns are 1-based, source map columns are 0-based.
    column: Math.max(0, Number(frame.colno ?? 1) - 1)
  })
  if (!traced.source || traced.line === null || traced.column === null) return frame

  const source = cleanSourcePath(traced.source)
  const context = contextAround(map, traced.source, traced.line)
  const vendor = /(^|\/)(node_modules|\.pnpm)\//.test(source)

  return {
    ...frame,
    filename: source,
    abs_path: traced.source,
    function: traced.name || frame.function,
    lineno: traced.line,
    colno: traced.column + 1,
    // Minified bundles routinely mislabel app code, so trust the resolved path instead.
    inApp: !vendor,
    in_app: !vendor,
    ...context,
    sourcemap: {
      release: artifact.release || null,
      artifact: artifact.name,
      filename: frame.filename ?? frame.abs_path ?? null,
      lineno: frame.lineno ?? null,
      colno: frame.colno ?? null,
      function: frame.function ?? null
    }
  }
}

type FrameHolder = { frames?: Frame[] }

function stacktraceFrames(stacktrace: unknown): Frame[] {
  if (!stacktrace) return []
  if (Array.isArray(stacktrace)) return stacktrace as Frame[]
  return ((stacktrace as FrameHolder).frames || []) as Frame[]
}

type ResolvableEvent = {
  release?: string | null
  stacktrace?: unknown
  exceptions?: unknown
}

/** Every frame an event carries, across both the flat trace and the exception chain. */
function eventFrames(event: ResolvableEvent) {
  const chain = Array.isArray(event.exceptions) ? event.exceptions : []
  return [
    ...stacktraceFrames(event.stacktrace),
    ...chain.flatMap(item => stacktraceFrames((item as { stacktrace?: unknown })?.stacktrace))
  ]
}

function mapStacktrace(stacktrace: unknown, resolve: (frame: Frame) => Frame) {
  if (!stacktrace) return stacktrace
  if (Array.isArray(stacktrace)) return stacktrace.map(frame => resolve(frame as Frame))
  const holder = stacktrace as FrameHolder
  if (!holder.frames) return stacktrace
  return { ...holder, frames: holder.frames.map(resolve) }
}

/**
 * Rewrites minified frames in place of the stored ones, at read time. Nothing is written
 * back, so uploading maps after an error was captured still fixes the older events.
 */
export async function applySourceMaps<T extends ResolvableEvent>(projectId: string, events: T[]): Promise<T[]> {
  const pending = events.flatMap(event => eventFrames(event).filter(needsSourceMap))
  if (!pending.length) return events

  const names = [...new Set(pending.flatMap(lookupNames))]
  if (!names.length) return events
  const basenames = [...new Set(names.map(artifactBasename))]

  // Content is fetched separately so this first pass stays cheap even when a project
  // holds hundreds of maps whose names collide on basename.
  const matches = await db.select({
    id: sourceMapArtifact.id,
    release: sourceMapArtifact.release,
    name: sourceMapArtifact.name,
    basename: sourceMapArtifact.basename
  })
    .from(sourceMapArtifact)
    .where(and(
      eq(sourceMapArtifact.projectId, projectId),
      or(inArray(sourceMapArtifact.name, names), inArray(sourceMapArtifact.basename, basenames))
    ))
    .orderBy(desc(sourceMapArtifact.createdAt))

  if (!matches.length) return events

  const needed = new Set<string>()
  for (const event of events) {
    const release = event.release || ''
    for (const frame of eventFrames(event)) {
      if (!needsSourceMap(frame)) continue
      const artifact = selectArtifact(frame, release, matches)
      if (artifact) needed.add(artifact.id)
    }
  }
  if (!needed.size) return events

  // Held for the length of the request. Reading straight from the shared cache would let
  // one map evict another that this same request still has frames waiting on, and those
  // frames would quietly stay minified with nothing to show for it.
  const maps = new Map<string, TraceMap>()
  for (const id of needed) {
    const cached = cachedMap(id)
    if (cached) maps.set(id, cached)
  }

  const missing = [...needed].filter(id => !maps.has(id))
  if (missing.length) {
    const rows = await db.select({ id: sourceMapArtifact.id, content: sourceMapArtifact.content })
      .from(sourceMapArtifact)
      .where(inArray(sourceMapArtifact.id, missing))
    for (const row of rows) {
      try {
        maps.set(row.id, parseArtifact(row.id, row.content))
      } catch {
        // A map that no longer parses should not take the whole issue view down.
      }
    }
  }

  return events.map((event) => {
    const release = event.release || ''
    const resolve = (frame: Frame) => {
      if (!needsSourceMap(frame)) return frame
      const artifact = selectArtifact(frame, release, matches)
      const map = artifact && maps.get(artifact.id)
      if (!artifact || !map) return frame
      try {
        return resolveFrame(frame, map, artifact)
      } catch {
        return frame
      }
    }

    const chain = Array.isArray(event.exceptions) ? event.exceptions : undefined
    return {
      ...event,
      stacktrace: mapStacktrace(event.stacktrace, resolve),
      exceptions: chain?.map((item) => {
        const exception = item as { stacktrace?: unknown }
        if (!exception?.stacktrace) return item
        return { ...exception, stacktrace: mapStacktrace(exception.stacktrace, resolve) }
      }) ?? event.exceptions
    }
  })
}
