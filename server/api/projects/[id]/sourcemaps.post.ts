import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { project, sourceMapArtifact } from '../../../db/schema'
import { requireProjectUpload } from '../../../lib/access'
import { artifactBasename, forgetSourceMaps, normalizeArtifactPath } from '../../../lib/sourcemap'

/** Generous enough for a large bundle's map, small enough to keep one request bounded. */
const MAX_FILE_BYTES = 40 * 1024 * 1024

type Rejected = { name: string, reason: string }

function validateSourceMap(raw: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Not valid JSON. Upload the .map file, not the bundle it belongs to.' }
  }

  const map = parsed as { version?: unknown, mappings?: unknown, sourcesContent?: unknown }
  if (typeof map?.mappings !== 'string') return { error: 'Missing a "mappings" field, so this is not a source map.' }

  // Positions resolve without it, but the original code cannot be shown.
  return { hasSourcesContent: Array.isArray(map.sourcesContent) && map.sourcesContent.some(Boolean) }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const selected = await db.query.project.findFirst({ where: eq(project.id, id) })
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  await requireProjectUpload(event, selected)

  const parts = await readMultipartFormData(event)
  if (!parts?.length) throw createError({ statusCode: 400, statusMessage: 'Send the .map files as multipart/form-data' })

  const field = (name: string) => parts.find(part => !part.filename && part.name === name)?.data.toString('utf8').trim()
  const release = field('release') || ''
  const prefix = field('prefix') || ''
  const files = parts.filter(part => part.filename)
  if (!files.length) throw createError({ statusCode: 400, statusMessage: 'No files were attached to the upload' })

  const uploaded: string[] = []
  const rejected: Rejected[] = []
  const replaced: string[] = []
  let withoutSources = 0

  for (const file of files) {
    const name = normalizeArtifactPath(`${prefix}${prefix && !prefix.endsWith('/') ? '/' : ''}${file.filename}`)
    if (!name) {
      rejected.push({ name: file.filename || 'unnamed', reason: 'Could not derive a file name' })
      continue
    }
    if (file.data.length > MAX_FILE_BYTES) {
      rejected.push({ name, reason: `Larger than the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB limit` })
      continue
    }

    const content = file.data.toString('utf8')
    const check = validateSourceMap(content)
    if (check.error) {
      rejected.push({ name, reason: check.error })
      continue
    }
    if (!check.hasSourcesContent) withoutSources += 1

    const [row] = await db.insert(sourceMapArtifact).values({
      id: crypto.randomUUID(),
      projectId: selected.id,
      release,
      name,
      basename: artifactBasename(name),
      content,
      size: file.data.length
    }).onConflictDoUpdate({
      target: [sourceMapArtifact.projectId, sourceMapArtifact.release, sourceMapArtifact.name],
      set: { content, size: file.data.length, createdAt: new Date() }
    }).returning({ id: sourceMapArtifact.id })

    if (row) replaced.push(row.id)
    uploaded.push(name)
  }

  // A re-upload under the same name must not keep serving the previous parse.
  forgetSourceMaps(replaced)

  if (!uploaded.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No usable source maps in the upload',
      data: { rejected }
    })
  }

  setResponseStatus(event, 201)
  return {
    release: release || null,
    uploaded: uploaded.length,
    files: uploaded,
    rejected,
    // Surfaced so a build that strips sourcesContent is caught at upload time, not later.
    warning: withoutSources
      ? `${withoutSources} map(s) have no sourcesContent, so frames will resolve to file and line but show no code. Build with sourcemap output that inlines sources.`
      : null
  }
})
