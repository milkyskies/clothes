import { curve, line, type Path, type Point, point } from "./geometry/path"
import type { Draft, Panel, Vertex } from "./schema"

export type {
	Annotation,
	BodyReference,
	Draft,
	EdgeRef,
	EdgeRun,
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
