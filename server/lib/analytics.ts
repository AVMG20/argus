import { sql } from 'drizzle-orm'
import { db } from '../db'
import { errorEvent, issue } from '../db/schema'

export type DistributionEntry = { key: string, value: string, count: number }

/**
 * Buckets are relative to `now()` inside Postgres so the series never depends on
 * how the process and the database resolve time zones.
 */
function toSeries(rows: Array<{ ago: number, count: number }>, points: number) {
  const series = Array.from({ length: points }, () => 0)
  for (const row of rows) {
    const index = points - 1 - Number(row.ago)
    if (index >= 0 && index < points) series[index] = Number(row.count)
  }
  return series
}

async function bucketedCounts(issueId: string, seconds: number, points: number) {
  const { rows } = await db.execute<{ ago: number, count: number }>(sql`
    select floor(extract(epoch from (now() - ${errorEvent.timestamp})) / ${seconds})::int as ago,
           count(*)::int as count
    from ${errorEvent}
    where ${errorEvent.issueId} = ${issueId}
      and ${errorEvent.timestamp} >= now() - (${seconds * points} * interval '1 second')
    group by 1
  `)
  return toSeries(rows, points)
}

export async function issueSeries(issueId: string) {
  const [hourly, daily] = await Promise.all([
    bucketedCounts(issueId, 3600, 24),
    bucketedCounts(issueId, 86_400, 30)
  ])
  return { hourly, daily }
}

/** 24 hourly buckets per issue, keyed by issue id, for the project list sparklines. */
export async function projectIssueSeries(projectId: string) {
  const { rows } = await db.execute<{ issue_id: string, ago: number, count: number }>(sql`
    select ${errorEvent.issueId} as issue_id,
           floor(extract(epoch from (now() - ${errorEvent.timestamp})) / 3600)::int as ago,
           count(*)::int as count
    from ${errorEvent}
    inner join ${issue} on ${issue.id} = ${errorEvent.issueId}
    where ${issue.projectId} = ${projectId}
      and ${errorEvent.timestamp} >= now() - interval '24 hours'
    group by 1, 2
  `)

  const grouped = new Map<string, Array<{ ago: number, count: number }>>()
  for (const row of rows) {
    const bucket = grouped.get(row.issue_id) || []
    bucket.push({ ago: Number(row.ago), count: Number(row.count) })
    grouped.set(row.issue_id, bucket)
  }

  return Object.fromEntries([...grouped].map(([id, bucket]) => [id, toSeries(bucket, 24)]))
}

export async function projectSeries(projectId: string) {
  const { rows } = await db.execute<{ ago: number, count: number }>(sql`
    select floor(extract(epoch from (now() - ${errorEvent.timestamp})) / 3600)::int as ago,
           count(*)::int as count
    from ${errorEvent}
    inner join ${issue} on ${issue.id} = ${errorEvent.issueId}
    where ${issue.projectId} = ${projectId}
      and ${errorEvent.timestamp} >= now() - interval '24 hours'
    group by 1
  `)
  return toSeries(rows, 24)
}

/**
 * Rolls every event of an issue up into the dimensions that answer "who and what
 * is affected": SDK contexts, request, user, release, plus every custom tag.
 */
export async function issueDistribution(issueId: string) {
  const { rows } = await db.execute<DistributionEntry>(sql`
    with source as (
      select * from ${errorEvent} where ${errorEvent.issueId} = ${issueId}
    ),
    dimensions as (
      select 'environment' as key, environment as value from source
      union all select 'release', release from source
      union all select 'transaction', transaction from source
      union all select 'server', server_name from source
      union all select 'browser', coalesce(contexts->'browser'->>'name', tags->>'browser.name', tags->>'browser') from source
      union all select 'browser version', coalesce(contexts->'browser'->>'version', tags->>'browser.version') from source
      union all select 'os', coalesce(contexts->'os'->>'name', tags->>'os.name', tags->>'os') from source
      union all select 'device', coalesce(contexts->'device'->>'model', contexts->'device'->>'family', tags->>'device.family') from source
      union all select 'runtime', coalesce(contexts->'runtime'->>'name', tags->>'runtime.name') from source
      union all select 'url', coalesce(request->>'url', tags->>'url') from source
      union all select 'user', coalesce("user"->>'id', "user"->>'email', "user"->>'username') from source
      union all select 'level', coalesce(raw_payload->>'level', tags->>'level') from source
      union all select 'sdk', concat(raw_payload->'sdk'->>'name', ' ', raw_payload->'sdk'->>'version') from source
      union all select concat('tag:', entry.key), entry.value from source, jsonb_each_text(coalesce(source.tags, '{}'::jsonb)) as entry
    )
    select key, value, count(*)::int as count
    from dimensions
    where value is not null and btrim(value) <> ''
    group by key, value
    order by key asc, count desc, value asc
  `)

  return rows.map(row => ({ key: row.key, value: row.value, count: Number(row.count) }))
}
