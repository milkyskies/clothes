import type { Draft, Panel, Vertex } from "./draft"
import { findPanel, panelBounds, vertexIndex } from "./draft"

/** How close to an extreme a point has to be to count as sitting on that edge. */
const EDGE_EPSILON = 0.01

let counter = 0

/** Ids only need to be unique inside a draft, and the editor is the only writer. */
export function nextId(prefix: string): string {
	counter += 1

	return `${prefix}-${counter.toString(36)}`
}

function replacePanel(draft: Draft, panel: Panel): Draft {
	return {
		...draft,
		panels: draft.panels.map((existing) => (existing.id === panel.id ? panel : existing)),
	}
}

export function moveVertex(
	draft: Draft,
	panelId: string,
	vertexId: string,
	x: number,
	y: number,
): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return draft

	return replacePanel(draft, {
		...panel,
		vertices: panel.vertices.map((vertex) =>
			vertex.id === vertexId ? { ...vertex, x, y } : vertex,
		),
	})
}

export function movePanel(draft: Draft, panelId: string, x: number, y: number): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return draft

	return replacePanel(draft, { ...panel, x, y })
}

/**
 * Splits the edge leaving `vertexId` by inserting a vertex at the given point.
 *
 * Handles on the split edge are dropped rather than subdivided, so a curve
 * becomes two straight runs the author can re-curve deliberately.
 */
export function insertVertex(
	draft: Draft,
	panelId: string,
	vertexId: string,
	x: number,
	y: number,
): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return draft

	const index = vertexIndex(panel, vertexId)

	if (index < 0) return draft

	const vertices = [...panel.vertices]
	const source = vertices[index]

	if (source === undefined) return draft

	vertices[index] = { ...source, bow: undefined }
	vertices.splice(index + 1, 0, { id: nextId("v"), x, y })

	return replacePanel(draft, { ...panel, vertices })
}

export function deleteVertex(draft: Draft, panelId: string, vertexId: string): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined || panel.vertices.length <= 3) return draft

	return replacePanel(draft, {
		...panel,
		vertices: panel.vertices.filter((vertex) => vertex.id !== vertexId),
	})
}

/** How deep the edge leaving this vertex bows, in centimetres. */
export function edgeBow(panel: Panel, vertexId: string): number {
	return panel.vertices.find((entry) => entry.id === vertexId)?.bow ?? 0
}

/** Where along an edge its bow is deepest, from 0 to 1. */
export function edgeBowAt(panel: Panel, vertexId: string): number {
	return panel.vertices.find((entry) => entry.id === vertexId)?.bowAt ?? 0.5
}

export function setEdgeBowAt(draft: Draft, panelId: string, vertexId: string, at: number): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return draft

	const clamped = Math.min(0.95, Math.max(0.05, at))

	return replacePanel(draft, {
		...panel,
		vertices: panel.vertices.map((vertex) =>
			vertex.id === vertexId ? { ...vertex, bowAt: clamped } : vertex,
		),
	})
}

export function isCurvedEdge(panel: Panel, vertexId: string): boolean {
	return edgeBow(panel, vertexId) !== 0
}

/** Sets how deep an edge bows. Zero returns it to a straight run. */
export function setEdgeBow(draft: Draft, panelId: string, vertexId: string, bow: number): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return draft

	return replacePanel(draft, {
		...panel,
		vertices: panel.vertices.map((vertex) =>
			vertex.id === vertexId ? { ...vertex, bow: bow === 0 ? undefined : bow } : vertex,
		),
	})
}

/**
 * Rounds the corner at `vertexId` so the curve clears the corner point by `gap`
 * centimetres.
 *
 * That gap is the figure a 製図 prints against a rounded corner — the 0.7 beside
 * a 衿ぐり is the sliver between the sharp corner and the curve — so it is the
 * input, and the radius and setbacks are worked out from it. For a turn of angle
 * θ an arc of radius r clears its corner by r·(1/sin(θ/2) − 1).
 */
export function roundCorner(draft: Draft, panelId: string, vertexId: string, gap: number): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return draft

	const index = vertexIndex(panel, vertexId)
	const count = panel.vertices.length

	if (index < 0 || count < 3) return draft

	const cornerVertex = panel.vertices[index]
	const previous = panel.vertices[(index - 1 + count) % count]
	const next = panel.vertices[(index + 1) % count]

	if (cornerVertex === undefined || previous === undefined || next === undefined) return draft

	const corner = { x: cornerVertex.x, y: cornerVertex.y }

	const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y)
	const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y)

	if (incoming === 0 || outgoing === 0) return draft

	const backX = (corner.x - previous.x) / incoming
	const backY = (corner.y - previous.y) / incoming
	const forwardX = (next.x - corner.x) / outgoing
	const forwardY = (next.y - corner.y) / outgoing

	const alignment = Math.max(-1, Math.min(1, -(backX * forwardX + backY * forwardY)))
	const turn = Math.acos(alignment)
	const half = Math.sin(turn / 2)

	if (half <= 0 || half >= 1) return draft

	const radius = gap / (1 / half - 1)
	const setback = Math.min(radius / Math.tan(turn / 2), incoming * 0.9, outgoing * 0.9)

	const start = { x: corner.x - backX * setback, y: corner.y - backY * setback }
	const end = { x: corner.x + forwardX * setback, y: corner.y + forwardY * setback }

	// Depth is measured from the chord and the gap from the corner, and the corner
	// sits `toCorner` beyond that chord, so the two differ by exactly the gap.
	const chordX = end.x - start.x
	const chordY = end.y - start.y
	const chord = Math.hypot(chordX, chordY)
	const toCorner = (-chordY * (corner.x - start.x) + chordX * (corner.y - start.y)) / (chord || 1)

	const startVertex: Vertex = {
		id: nextId("v"),
		x: start.x,
		y: start.y,
		bow: Number((toCorner - Math.sign(toCorner) * gap).toFixed(3)),
	}

	const endVertex: Vertex = { id: nextId("v"), x: end.x, y: end.y }

	const vertices = [...panel.vertices]

	vertices.splice(index, 1, startVertex, endVertex)

	return replacePanel(draft, { ...panel, vertices })
}

function intersectLines(
	originA: Vertex,
	towardA: Vertex,
	originB: Vertex,
	towardB: Vertex,
): { x: number; y: number } | undefined {
	const directionAx = towardA.x - originA.x
	const directionAy = towardA.y - originA.y
	const directionBx = towardB.x - originB.x
	const directionBy = towardB.y - originB.y

	const cross = directionAx * directionBy - directionAy * directionBx

	if (Math.abs(cross) < 1e-9) return undefined

	const travel =
		((originB.x - originA.x) * directionBy - (originB.y - originA.y) * directionBx) / cross

	return { x: originA.x + directionAx * travel, y: originA.y + directionAy * travel }
}

/**
 * The inverse of `roundCorner`: puts back the sharp corner a curve was cut from,
 * by extending the two neighbouring edges until they meet.
 *
 * Falls back to straightening when those edges run parallel and never meet.
 */
export function sharpenCorner(draft: Draft, panelId: string, vertexId: string): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return draft

	const count = panel.vertices.length
	const index = vertexIndex(panel, vertexId)

	if (index < 0 || count < 4) return setEdgeBow(draft, panelId, vertexId, 0)

	const start = panel.vertices[index]
	const end = panel.vertices[(index + 1) % count]
	const before = panel.vertices[(index - 1 + count) % count]
	const after = panel.vertices[(index + 2) % count]

	if (start === undefined || end === undefined || before === undefined || after === undefined) {
		return draft
	}

	const corner = intersectLines(before, start, after, end)

	if (corner === undefined) return setEdgeBow(draft, panelId, vertexId, 0)

	const vertices = [...panel.vertices]

	vertices.splice(index, 2, { id: nextId("v"), x: corner.x, y: corner.y })

	return replacePanel(draft, { ...panel, vertices })
}

export function setFoldEdge(draft: Draft, panelId: string, vertexId: string | undefined): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return draft

	return replacePanel(draft, { ...panel, foldEdge: vertexId })
}

export function updatePanel(
	draft: Draft,
	panelId: string,
	patch: Partial<Pick<Panel, "name" | "quantity">>,
): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return draft

	return replacePanel(draft, { ...panel, ...patch })
}

export function addRectanglePanel(
	draft: Draft,
	x: number,
	y: number,
	width: number,
	height: number,
): { draft: Draft; panelId: string } {
	const panelId = nextId("panel")

	const vertices: Vertex[] = [
		{ id: nextId("v"), x: 0, y: 0 },
		{ id: nextId("v"), x: width, y: 0 },
		{ id: nextId("v"), x: width, y: height },
		{ id: nextId("v"), x: 0, y: height },
	]

	return {
		panelId,
		draft: {
			...draft,
			panels: [
				...draft.panels,
				{
					id: panelId,
					name: `パーツ${draft.panels.length + 1}`,
					quantity: 1,
					x,
					y,
					vertices,
				},
			],
		},
	}
}

export function addPolygonPanel(
	draft: Draft,
	points: readonly { x: number; y: number }[],
): { draft: Draft; panelId: string } {
	const panelId = nextId("panel")

	const originX = Math.min(...points.map((entry) => entry.x))
	const originY = Math.min(...points.map((entry) => entry.y))

	return {
		panelId,
		draft: {
			...draft,
			panels: [
				...draft.panels,
				{
					id: panelId,
					name: `パーツ${draft.panels.length + 1}`,
					quantity: 1,
					x: originX,
					y: originY,
					vertices: points.map((entry) => ({
						id: nextId("v"),
						x: entry.x - originX,
						y: entry.y - originY,
					})),
				},
			],
		},
	}
}

export function duplicatePanel(draft: Draft, panelId: string): Draft {
	const panel = draft.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return draft

	return {
		...draft,
		panels: [
			...draft.panels,
			{
				...panel,
				id: nextId("panel"),
				name: `${panel.name}のコピー`,
				x: panel.x + 6,
				y: panel.y + 6,
				vertices: panel.vertices.map((vertex) => ({ ...vertex, id: nextId("v") })),
			},
		],
	}
}

/** Removing a panel takes its seams, stitches and annotations with it. */
export function deletePanel(draft: Draft, panelId: string): Draft {
	return {
		...draft,
		panels: draft.panels.filter((panel) => panel.id !== panelId),
		seams: draft.seams.filter(
			(seam) => seam.a.edge.panelId !== panelId && seam.b.edge.panelId !== panelId,
		),
		stitches: draft.stitches.filter((stitch) => stitch.run.edge.panelId !== panelId),
		annotations: draft.annotations.filter((annotation) => annotation.run.edge.panelId !== panelId),
	}
}

/**
 * Changes how big a piece is by moving the far edges out, not by scaling it.
 *
 * Lengthening a 身頃 means the 裾 goes down while the 打ち合わせ stays where it was
 * measured from the shoulder. Scaling the whole outline would drag every
 * feature with it, which is never what a longer garment means.
 */
export function stretchPanel(draft: Draft, panelId: string, width: number, height: number): Draft {
	const panel = findPanel(draft, panelId)

	if (panel === undefined) return draft

	const bounds = panelBounds(panel)

	if (bounds.width <= 0 || bounds.height <= 0) return draft
	if (width <= 0 || height <= 0) return draft

	const acrossBy = width - bounds.width
	const alongBy = height - bounds.height

	const moved = panel.vertices.map((vertex) => ({
		...vertex,
		x: vertex.x >= bounds.maxX - EDGE_EPSILON ? vertex.x + acrossBy : vertex.x,
		y: vertex.y >= bounds.maxY - EDGE_EPSILON ? vertex.y + alongBy : vertex.y,
	}))

	return replacePanel(draft, { ...panel, vertices: moved })
}
