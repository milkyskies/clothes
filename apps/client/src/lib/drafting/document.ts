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
	/** Control point leaving this vertex, relative to it. Absent means the edge is straight. */
	readonly out?: Point
	/** Control point arriving at the next vertex, relative to that vertex. */
	readonly nextIn?: Point
}

export interface Panel {
	readonly id: string
	readonly name: string
	readonly quantity: number
	readonly onFold: boolean
	readonly x: number
	readonly y: number
	readonly vertices: readonly Vertex[]
	/** Seam allowance per edge, keyed by the id of the vertex the edge leaves. */
	readonly allowance: Readonly<Record<string, number>>
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
	readonly defaultAllowance: number
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

/** Builds the closed outline for a panel, keyed so each segment carries its starting vertex id. */
export function panelPath(panel: Panel): Path {
	const first = panel.vertices[0]

	if (first === undefined) return { start: point(0, 0), segments: [] }

	const segments = panel.vertices.map((vertex, index) => {
		const target = panel.vertices[(index + 1) % panel.vertices.length] ?? first
		const to = vertexPoint(target)

		if (vertex.out === undefined && vertex.nextIn === undefined) return line(vertex.id, to)

		const from = vertexPoint(vertex)
		const outward = vertex.out ?? { x: 0, y: 0 }
		const inward = vertex.nextIn ?? { x: 0, y: 0 }

		return curve(
			vertex.id,
			to,
			point(from.x + outward.x, from.y + outward.y),
			point(to.x + inward.x, to.y + inward.y),
		)
	})

	return { start: vertexPoint(first), segments }
}

export function panelAllowance(
	panel: Panel,
	fallback: number,
): { perEdge: Record<string, number>; fallback: number } {
	return { perEdge: { ...panel.allowance }, fallback }
}
