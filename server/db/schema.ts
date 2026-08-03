import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
    activeTeamId: text("active_team_id"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
  },
  (table) => [uniqueIndex("organization_slug_uidx").on(table.slug)],
);

export const team = pgTable(
  "team",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").$onUpdate(
      () => /* @__PURE__ */ new Date(),
    ),
  },
  (table) => [index("team_organizationId_idx").on(table.organizationId)],
);

export const teamMember = pgTable(
  "team_member",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("teamMember_teamId_idx").on(table.teamId),
    index("teamMember_userId_idx").on(table.userId),
  ],
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    teamId: text("team_id"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  teamMembers: many(teamMember),
  members: many(member),
  invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  teams: many(team),
  members: many(member),
  invitations: many(invitation),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  organization: one(organization, {
    fields: [team.organizationId],
    references: [organization.id],
  }),
  teamMembers: many(teamMember),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, {
    fields: [teamMember.teamId],
    references: [team.id],
  }),
  user: one(user, {
    fields: [teamMember.userId],
    references: [user.id],
  }),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    platform: text("platform").default("javascript").notNull(),
    sentryProjectId: serial("sentry_project_id").notNull().unique(),
    publicKey: text("public_key").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_organization_slug_uidx").on(
      table.organizationId,
      table.slug,
    ),
    index("project_organizationId_idx").on(table.organizationId),
  ],
);

export const issue = pgTable(
  "issue",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    title: text("title").notNull(),
    culprit: text("culprit"),
    level: text("level").default("error").notNull(),
    status: text("status").default("unresolved").notNull(),
    eventCount: integer("event_count").default(1).notNull(),
    firstSeen: timestamp("first_seen").defaultNow().notNull(),
    lastSeen: timestamp("last_seen").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("issue_project_fingerprint_uidx").on(
      table.projectId,
      table.fingerprint,
    ),
    index("issue_projectId_idx").on(table.projectId),
    index("issue_lastSeen_idx").on(table.lastSeen),
  ],
);

export const errorEvent = pgTable(
  "error_event",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().unique(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    environment: text("environment").default("production").notNull(),
    release: text("release"),
    serverName: text("server_name"),
    transaction: text("transaction"),
    message: text("message"),
    exceptionType: text("exception_type"),
    exceptionValue: text("exception_value"),
    stacktrace: jsonb("stacktrace").$type<Array<Record<string, unknown>>>(),
    exceptions: jsonb("exceptions").$type<Array<Record<string, unknown>>>(),
    tags: jsonb("tags").$type<Record<string, string>>(),
    contexts: jsonb("contexts").$type<Record<string, unknown>>(),
    request: jsonb("request").$type<Record<string, unknown>>(),
    user: jsonb("user").$type<Record<string, unknown>>(),
    breadcrumbs: jsonb("breadcrumbs").$type<Array<Record<string, unknown>>>(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("errorEvent_issueId_idx").on(table.issueId),
    index("errorEvent_timestamp_idx").on(table.timestamp),
  ],
);

export const performanceTransaction = pgTable(
  "performance_transaction",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().unique(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    operation: text("operation"),
    traceId: text("trace_id"),
    spanId: text("span_id"),
    parentSpanId: text("parent_span_id"),
    startTimestamp: timestamp("start_timestamp").notNull(),
    endTimestamp: timestamp("end_timestamp").notNull(),
    durationMs: doublePrecision("duration_ms").notNull(),
    status: text("status"),
    method: text("method"),
    statusCode: integer("status_code"),
    environment: text("environment").default("production").notNull(),
    release: text("release"),
    user: jsonb("user").$type<Record<string, unknown>>(),
    request: jsonb("request").$type<Record<string, unknown>>(),
    tags: jsonb("tags").$type<Record<string, string>>(),
    contexts: jsonb("contexts").$type<Record<string, unknown>>(),
    measurements: jsonb("measurements").$type<Record<string, unknown>>(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("performanceTransaction_project_start_idx").on(table.projectId, table.startTimestamp),
    index("performanceTransaction_project_name_idx").on(table.projectId, table.name),
    index("performanceTransaction_traceId_idx").on(table.traceId),
  ],
);

export const performanceSpan = pgTable(
  "performance_span",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => performanceTransaction.id, { onDelete: "cascade" }),
    spanId: text("span_id").notNull(),
    traceId: text("trace_id"),
    parentSpanId: text("parent_span_id"),
    operation: text("operation"),
    description: text("description"),
    startTimestamp: timestamp("start_timestamp").notNull(),
    endTimestamp: timestamp("end_timestamp").notNull(),
    durationMs: doublePrecision("duration_ms").notNull(),
    status: text("status"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    tags: jsonb("tags").$type<Record<string, string>>(),
  },
  (table) => [
    uniqueIndex("performanceSpan_transaction_span_uidx").on(table.transactionId, table.spanId),
    index("performanceSpan_transactionId_idx").on(table.transactionId),
    index("performanceSpan_operation_idx").on(table.operation),
  ],
);

/**
 * Bearer token a build pipeline uses to upload source maps. Kept out of the project
 * row so the token is never serialized by the endpoints that return a project.
 *
 * Stored in plaintext on purpose: the setup page has to show it again after it was
 * created, which a hash would make impossible. It only grants source map upload on one
 * project, and reading it back is restricted to the roles that can rotate it.
 */
export const projectUploadToken = pgTable(
  "project_upload_token",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => [
    uniqueIndex("projectUploadToken_projectId_uidx").on(table.projectId),
    index("projectUploadToken_token_idx").on(table.token),
  ],
);

/**
 * A single uploaded `.map` file. `name` is the path a frame is expected to reference
 * (`~/_nuxt/entry.js.map`); `basename` backs the fallback match for bundlers that emit
 * content-hashed files, where the file name alone is already unique.
 */
export const sourceMapArtifact = pgTable(
  "source_map_artifact",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    release: text("release").notNull().default(""),
    name: text("name").notNull(),
    basename: text("basename").notNull(),
    content: text("content").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sourceMapArtifact_project_release_name_uidx").on(
      table.projectId,
      table.release,
      table.name,
    ),
    index("sourceMapArtifact_project_release_idx").on(
      table.projectId,
      table.release,
    ),
    index("sourceMapArtifact_project_basename_idx").on(
      table.projectId,
      table.basename,
    ),
  ],
);

export const projectRelations = relations(project, ({ one, many }) => ({
  organization: one(organization, {
    fields: [project.organizationId],
    references: [organization.id],
  }),
  issues: many(issue),
  transactions: many(performanceTransaction),
  sourceMaps: many(sourceMapArtifact),
  uploadToken: one(projectUploadToken),
}));

export const projectUploadTokenRelations = relations(
  projectUploadToken,
  ({ one }) => ({
    project: one(project, {
      fields: [projectUploadToken.projectId],
      references: [project.id],
    }),
  }),
);

export const sourceMapArtifactRelations = relations(
  sourceMapArtifact,
  ({ one }) => ({
    project: one(project, {
      fields: [sourceMapArtifact.projectId],
      references: [project.id],
    }),
  }),
);

export const issueRelations = relations(issue, ({ one, many }) => ({
  project: one(project, {
    fields: [issue.projectId],
    references: [project.id],
  }),
  events: many(errorEvent),
}));

export const errorEventRelations = relations(errorEvent, ({ one }) => ({
  issue: one(issue, {
    fields: [errorEvent.issueId],
    references: [issue.id],
  }),
}));

export const performanceTransactionRelations = relations(performanceTransaction, ({ one, many }) => ({
  project: one(project, {
    fields: [performanceTransaction.projectId],
    references: [project.id],
  }),
  spans: many(performanceSpan),
}));

export const performanceSpanRelations = relations(performanceSpan, ({ one }) => ({
  transaction: one(performanceTransaction, {
    fields: [performanceSpan.transactionId],
    references: [performanceTransaction.id],
  }),
}));
