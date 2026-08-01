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

export const CreasePointSchema = Schema.Struct({
	vertexId: Schema.String,
	/** How far along that edge the fold meets the outline, in centimetres. */
	at: Schema.Number,
})

/**
 * A line the cloth folds along inside a piece, rather than where two pieces meet.
 *
 * 袖山 and 肩山 are folds, not seams: the cloth is cut in one length and doubled
 * over. Nothing is sewn there, so it changes what the garment looks like without
 * changing what is cut.
 */
export const CreaseSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	a: CreasePointSchema,
	b: CreasePointSchema,
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
	creases: Schema.optional(Schema.Array(CreaseSchema)),
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
	/**
	 * Whether the second run is walked backwards against the first.
	 *
	 * Two edges of equal length can still be joined two ways, and the wrong one
	 * turns the piece inside out, so which end meets which has to be said rather
	 * than assumed. Absent reads as start meeting start.
	 */
	reversed: Schema.optional(Schema.Boolean),
	/**
	 * How the seam sits when the garment is laid on a table.
	 *
	 * 背中心 lies open and its two halves stay side by side; 肩縫い folds, and the
	 * front comes to rest on top of the back. Which one a seam does is part of
	 * the garment rather than something its lengths reveal.
	 */
	lie: Schema.optional(Schema.Literal("open", "fold")),
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

/**
 * Two runs held together when the garment is worn but never sewn: a tied 紐,
 * a button, a snap. The wearing views close them; the sewing views leave them
 * open, which is exactly how the real garment behaves on the table.
 */
export const FasteningSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	a: EdgeRunSchema,
	b: EdgeRunSchema,
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

/**
 * The cloth a draft is cut from.
 *
 * 反物 comes off the loom about 36cm wide and 広幅 about 110cm, and that width
 * is what decides whether a piece fits and how many metres to buy, so it belongs
 * to the draft rather than to a preference somewhere.
 */
export const FabricSchema = Schema.Struct({
	name: Schema.String,
	width: Schema.Number,
})

export type Fabric = Schema.Schema.Type<typeof FabricSchema>

export const DEFAULT_FABRIC: Fabric = { name: "反物", width: 36 }

export const DraftSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	/** The template this one was forked from, if any. */
	parent: Schema.optional(Schema.String),
	panels: Schema.Array(PanelSchema),
	seams: Schema.Array(SeamSchema),
	stitches: Schema.Array(StitchSchema),
	annotations: Schema.Array(AnnotationSchema),
	fastenings: Schema.optional(Schema.Array(FasteningSchema)),
	body: BodyReferenceSchema,
	fabric: Schema.optionalWith(FabricSchema, { default: () => DEFAULT_FABRIC }),
})

export type Vertex = Schema.Schema.Type<typeof VertexSchema>
export type Crease = Schema.Schema.Type<typeof CreaseSchema>
export type Panel = Schema.Schema.Type<typeof PanelSchema>
export type EdgeRef = Schema.Schema.Type<typeof EdgeRefSchema>
export type EdgeRun = Schema.Schema.Type<typeof EdgeRunSchema>
export type Seam = Schema.Schema.Type<typeof SeamSchema>
export type StitchKind = Schema.Schema.Type<typeof StitchKindSchema>
export type Stitch = Schema.Schema.Type<typeof StitchSchema>
export type Fastening = Schema.Schema.Type<typeof FasteningSchema>
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

/**
 * Unsaved state kept alongside a file so a crash or a closed tab does not lose
 * work. It is deliberately not the file: saving is explicit, and this is only
 * ever offered back as a recovery.
 */
export const RecoverySchema = Schema.Struct({
	fileId: Schema.String,
	at: Schema.Number,
	draft: DraftSchema,
})

export type Recovery = Schema.Schema.Type<typeof RecoverySchema>

export const SettingsSchema = Schema.Struct({
	snap: Schema.Number,
	lastOpenedFileId: Schema.optional(Schema.String),
})

export type Settings = Schema.Schema.Type<typeof SettingsSchema>

export const decodeDraft = Schema.decodeUnknownEither(DraftSchema)
export const decodeFileRecord = Schema.decodeUnknownEither(FileRecordSchema)
export const decodeRecovery = Schema.decodeUnknownEither(RecoverySchema)
export const decodeSettings = Schema.decodeUnknownEither(SettingsSchema)

export const encodeDraft = Schema.encodeSync(DraftSchema)
export const encodeFileRecord = Schema.encodeSync(FileRecordSchema)
export const encodeRecovery = Schema.encodeSync(RecoverySchema)
export const encodeSettings = Schema.encodeSync(SettingsSchema)
