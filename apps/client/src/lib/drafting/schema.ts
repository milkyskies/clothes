import * as Schema from "effect/Schema"

/**
 * The wire and storage shape of a draft.
 *
 * The schema is the source of truth and the types are derived from it, so a
 * draft read back from disk, from a link or from a server is validated
 * against the same definition the editor works against.
 */

export const VertexSchema = Schema.Struct({
	id: Schema.String,
	x: Schema.Number,
	y: Schema.Number,
	/** How deep the edge leaving this vertex bows, in centimetres. Absent is straight. */
	bow: Schema.optional(Schema.Number),
	/** Where along that edge the bow is deepest, 0 at this vertex to 1 at the next. */
	bowAt: Schema.optional(Schema.Number),
})

export const PanelSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	quantity: Schema.Number,
	/** Vertex id of the edge lying on the fold, when the piece is cut 「わ」. */
	foldEdge: Schema.optional(Schema.String),
	x: Schema.Number,
	y: Schema.Number,
	vertices: Schema.Array(VertexSchema),
})

export const EdgeRefSchema = Schema.Struct({
	panelId: Schema.String,
	vertexId: Schema.String,
})

export const EdgeRunSchema = Schema.Struct({
	edge: EdgeRefSchema,
	from: Schema.Number,
	to: Schema.Number,
})

export const SeamSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	a: EdgeRunSchema,
	b: EdgeRunSchema,
})

export const StitchKindSchema = Schema.Literal("finish", "topstitch", "bartack", "hand")

export const StitchSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	kind: StitchKindSchema,
	run: EdgeRunSchema,
	offset: Schema.Number,
	rows: Schema.Number,
	thread: Schema.String,
})

export const AnnotationSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	run: EdgeRunSchema,
})

export const BodyReferenceSchema = Schema.Struct({
	chest: Schema.Number,
	height: Schema.Number,
	shoulderWidth: Schema.Number,
	armLength: Schema.Number,
})

export const DraftSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	/** The template this one was forked from, if any. */
	parent: Schema.optional(Schema.String),
	panels: Schema.Array(PanelSchema),
	seams: Schema.Array(SeamSchema),
	stitches: Schema.Array(StitchSchema),
	annotations: Schema.Array(AnnotationSchema),
	body: BodyReferenceSchema,
})

export type Vertex = Schema.Schema.Type<typeof VertexSchema>
export type Panel = Schema.Schema.Type<typeof PanelSchema>
export type EdgeRef = Schema.Schema.Type<typeof EdgeRefSchema>
export type EdgeRun = Schema.Schema.Type<typeof EdgeRunSchema>
export type Seam = Schema.Schema.Type<typeof SeamSchema>
export type StitchKind = Schema.Schema.Type<typeof StitchKindSchema>
export type Stitch = Schema.Schema.Type<typeof StitchSchema>
export type Annotation = Schema.Schema.Type<typeof AnnotationSchema>
export type BodyReference = Schema.Schema.Type<typeof BodyReferenceSchema>
export type Draft = Schema.Schema.Type<typeof DraftSchema>

/** A saved draft with the housekeeping a file needs but a drawing does not. */
export const FileRecordSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	updatedAt: Schema.Number,
	draft: DraftSchema,
})

export type FileRecord = Schema.Schema.Type<typeof FileRecordSchema>

export const SettingsSchema = Schema.Struct({
	snap: Schema.Number,
	lastOpenedFileId: Schema.optional(Schema.String),
})

export type Settings = Schema.Schema.Type<typeof SettingsSchema>

export const decodeDraft = Schema.decodeUnknownEither(DraftSchema)
export const decodeFileRecord = Schema.decodeUnknownEither(FileRecordSchema)
export const decodeSettings = Schema.decodeUnknownEither(SettingsSchema)

export const encodeDraft = Schema.encodeSync(DraftSchema)
export const encodeFileRecord = Schema.encodeSync(FileRecordSchema)
export const encodeSettings = Schema.encodeSync(SettingsSchema)
