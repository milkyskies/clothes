import { curve, line, type Path, type Point, point } from "./geometry/path"

/**
 * The editor knows about panels, seams and stitches. It knows nothing about
 * 身八つ口, 剣先 or 掛襟 — those are names a template's author typed onto edges
 * and gaps, and they travel with the document rather than living in the tool.
 */

export interface Vertex {
	readonly id: string
	readonly x: number
	readonly y: number
	/**
	 * How deep the edge leaving this vertex bows, in centimetres, to the left of
	 * its direction. Absent or zero is a straight run.
	 *
	 * A draft states a curve as a depth — the 0.7 written against a 衿ぐり — so
	 * that is what is stored, and the control points are worked out from it.
	 */
	readonly bow?: number
}

export interface Panel {
	readonly id: string
	readonly name: string
	readonly quantity: number
	/** Vertex id of the edge that lies on the fold, if the piece is cut 「わ」. */
	readonly foldEdge?: string
	readonly x: number
	readonly y: number
	readonly vertices: readonly Vertex[]
}

/** An edge is the run leaving `vertexId`, so inserting points elsewhere does not renumber it. */
export interface EdgeRef {
	readonly panelId: string
	readonly vertexId: string
}

/** A run measured in centimetres from the start of an edge. */
export interface EdgeRun {
	readonly edge: EdgeRef
	readonly from: number
	readonly to: number
}

/**
 * Two edge runs sewn to each other. A run shorter than its edge leaves the rest
 * unsewn, which is the only way this model produces an opening.
 */
export interface Seam {
	readonly id: string
	readonly name: string
	readonly a: EdgeRun
	readonly b: EdgeRun
}

export type StitchKind = "finish" | "topstitch" | "bartack" | "hand"

export interface Stitch {
	readonly id: string
	readonly name: string
	readonly kind: StitchKind
	readonly run: EdgeRun
	readonly offset: number
	readonly rows: number
	readonly thread: string
}

/** A label on part of an edge. This is where a template records a name like 身八つ口. */
export interface Annotation {
	readonly id: string
	readonly name: string
	readonly run: EdgeRun
}

export interface BodyReference {
	readonly chest: number
	readonly height: number
	readonly shoulderWidth: number
	readonly armLength: number
}

export interface Document {
	readonly id: string
	readonly name: string
	readonly parent?: string
	readonly panels: readonly Panel[]
	readonly seams: readonly Seam[]
	readonly stitches: readonly Stitch[]
	readonly annotations: readonly Annotation[]
	readonly body: BodyReference
}

export function findPanel(document: Document, panelId: string): Panel | undefined {
	return document.panels.find((panel) => panel.id === panelId)
}

export function findVertex(panel: Panel, vertexId: string): Vertex | undefined {
	return panel.vertices.find((vertex) => vertex.id === vertexId)
}

export function vertexIndex(panel: Panel, vertexId: string): number {
	return panel.vertices.findIndex((vertex) => vertex.id === vertexId)
}

export function nextVertex(panel: Panel, vertexId: string): Vertex | undefined {
	const index = vertexIndex(panel, vertexId)

	if (index < 0) return undefined

	return panel.vertices[(index + 1) % panel.vertices.length]
}

export function vertexPoint(vertex: Vertex): Point {
	return point(vertex.x, vertex.y)
}

/**
 * A cubic whose control points are pushed `d` sideways bulges by three quarters
 * of `d` at its middle, so a stated depth is scaled by 4/3 to reach it.
 */
const BOW_TO_HANDLE = 4 / 3

/** Builds the closed outline for a panel, keyed so each segment carries its starting vertex id. */
export function panelPath(panel: Panel): Path {
	const first = panel.vertices[0]

	if (first === undefined) return { start: point(0, 0), segments: [] }

	const segments = panel.vertices.map((vertex, index) => {
		const target = panel.vertices[(index + 1) % panel.vertices.length] ?? first
		const to = vertexPoint(target)
		const bow = vertex.bow ?? 0

		if (bow === 0) return line(vertex.id, to)

		const from = vertexPoint(vertex)
		const spanX = to.x - from.x
		const spanY = to.y - from.y
		const span = Math.hypot(spanX, spanY)

		if (span === 0) return line(vertex.id, to)

		const sideX = (-spanY / span) * bow * BOW_TO_HANDLE
		const sideY = (spanX / span) * bow * BOW_TO_HANDLE

		return curve(
			vertex.id,
			to,
			point(from.x + spanX / 3 + sideX, from.y + spanY / 3 + sideY),
			point(to.x - spanX / 3 + sideX, to.y - spanY / 3 + sideY),
		)
	})

	return { start: vertexPoint(first), segments }
}
