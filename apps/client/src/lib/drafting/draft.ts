import { flatten } from "./geometry/measure"
import { curve, line, type Path, type Point, point } from "./geometry/path"
import type { Draft, Panel, Vertex } from "./schema"

export type {
	Annotation,
	BodyReference,
	Crease,
	Draft,
	EdgeRef,
	EdgeRun,
	Fastening,
	Panel,
	Seam,
	Stitch,
	StitchKind,
	Vertex,
} from "./schema"

/**
 * The editor knows about panels, seams and stitches. It knows nothing about
 * 身八つ口, 剣先 or 掛襟 — those are names a template's author typed onto edges
 * and gaps, and they travel with the draft rather than living in the tool.
 */

export function findPanel(draft: Draft, panelId: string): Panel | undefined {
	return draft.panels.find((panel) => panel.id === panelId)
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

		const at = vertex.bowAt ?? 0.5
		const lead = (at * 2) / 3
		const trail = ((1 - at) * 2) / 3

		return curve(
			vertex.id,
			to,
			point(from.x + spanX * lead + sideX, from.y + spanY * lead + sideY),
			point(to.x - spanX * trail + sideX, to.y - spanY * trail + sideY),
		)
	})

	return { start: vertexPoint(first), segments }
}

export interface Bounds {
	readonly minX: number
	readonly minY: number
	readonly maxX: number
	readonly maxY: number
	readonly width: number
	readonly height: number
}

/** The smallest rectangle of cloth a panel needs, curves included. */
export function panelBounds(panel: Panel): Bounds {
	const path = panelPath(panel)
	const points = [...flatten(path).map((entry) => entry.point), ...path.segments.map((s) => s.to)]

	if (points.length === 0) {
		return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
	}

	const xs = points.map((entry) => entry.x)
	const ys = points.map((entry) => entry.y)
	const minX = Math.min(...xs)
	const minY = Math.min(...ys)
	const maxX = Math.max(...xs)
	const maxY = Math.max(...ys)

	return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}
