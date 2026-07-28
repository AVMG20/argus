import { TraceMap, originalPositionFor, sourceContentFor } from '@jridgewell/trace-mapping'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../db'
import { sourceMapArtifact } from '../db/schema'
import type { Frame } from './ingest'

/** Lines of original source kept either side of the resolved line. */
const CONTEXT_LINES = 5

/**
 * Parsed maps are held between requests because decoding one is far more expensive than
 * the lookups it serves. Bundles are large, so the cache counts entries, not bytes.
 */
const CACHE_LIMIT = 24
const parsedMaps = new Map<string, TraceMap>()

function parseArtifact(id: string, content: string) {
  const cached = parsedMaps.get(id)
  if (cached) {
    // Re-insert so the map moves to the most-recently-used end of the eviction order.
    parsedMaps.delete(id)
    parsedMaps.set(id, cached)
    return cached
  }

  const map = new TraceMap(JSON.parse(content))
  parsedMaps.set(id, map)
  if (parsedMaps.size > CACHE_LIMIT) {
    const oldest = parsedMaps.keys().next().value
    if (oldest) parsedMaps.delete(oldest)
  }
  return map
}

export function forgetSourceMaps(ids: string[]) {
  for (const id of ids) parsedMaps.delete(id)
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

/**
 * Picks the map for a frame, tightening from an exact path match in the event's own
 * release outward. The fallbacks matter because content-hashed file names are already
 * unique, and plenty of SDKs never set a release at all.
 */
function selectArtifact(frame: Frame, release: string, artifacts: ArtifactRow[]) {
  const names = lookupNames(frame)
  if (!names.length) return
  const basenames = names.map(artifactBasename)

  const candidates: Array<(row: ArtifactRow) => boolean> = [
    row => row.release === release && names.includes(row.name),
    row => row.release === release && basenames.includes(row.basename),
    row => names.includes(row.name),
    row => basenames.includes(row.basename)
  ]

  for (const matches of candidates) {
    const found = artifacts.find(matches)
    if (found) return found
  }
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
  if (!traced.source || traced.line === null) return frame

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

  const uncached = [...needed].filter(id => !parsedMaps.has(id))
  if (uncached.length) {
    const rows = await db.select({ id: sourceMapArtifact.id, content: sourceMapArtifact.content })
      .from(sourceMapArtifact)
      .where(inArray(sourceMapArtifact.id, uncached))
    for (const row of rows) {
      try {
        parseArtifact(row.id, row.content)
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
      const map = artifact && parsedMaps.get(artifact.id)
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
