import type { Document, Panel, Vertex } from "./document"
import { vertexIndex } from "./document"

let counter = 0

/** Ids only need to be unique inside a document, and the editor is the only writer. */
export function nextId(prefix: string): string {
	counter += 1

	return `${prefix}-${counter.toString(36)}`
}

function replacePanel(document: Document, panel: Panel): Document {
	return {
		...document,
		panels: document.panels.map((existing) => (existing.id === panel.id ? panel : existing)),
	}
}

export function moveVertex(
	document: Document,
	panelId: string,
	vertexId: string,
	x: number,
	y: number,
): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	return replacePanel(document, {
		...panel,
		vertices: panel.vertices.map((vertex) =>
			vertex.id === vertexId ? { ...vertex, x, y } : vertex,
		),
	})
}

export function movePanel(document: Document, panelId: string, x: number, y: number): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	return replacePanel(document, { ...panel, x, y })
}

/**
 * Splits the edge leaving `vertexId` by inserting a vertex at the given point.
 *
 * Handles on the split edge are dropped rather than subdivided, so a curve
 * becomes two straight runs the author can re-curve deliberately.
 */
export function insertVertex(
	document: Document,
	panelId: string,
	vertexId: string,
	x: number,
	y: number,
): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	const index = vertexIndex(panel, vertexId)

	if (index < 0) return document

	const vertices = [...panel.vertices]
	const source = vertices[index]

	if (source === undefined) return document

	vertices[index] = { ...source, bow: undefined }
	vertices.splice(index + 1, 0, { id: nextId("v"), x, y })

	return replacePanel(document, { ...panel, vertices })
}

export function deleteVertex(document: Document, panelId: string, vertexId: string): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined || panel.vertices.length <= 3) return document

	return replacePanel(document, {
		...panel,
		vertices: panel.vertices.filter((vertex) => vertex.id !== vertexId),
	})
}

/**
 * A cubic whose handles are pushed `d` sideways bulges by three quarters of `d`
 * at its middle, so the depth a draft states is scaled by 4/3 to get there.
 */
const BOW_TO_HANDLE = 4 / 3

function edgeEnds(panel: Panel, vertexId: string): { from: Vertex; to: Vertex } | undefined {
	const index = vertexIndex(panel, vertexId)

	if (index < 0) return undefined

	const from = panel.vertices[index]
	const to = panel.vertices[(index + 1) % panel.vertices.length]

	if (from === undefined || to === undefined) return undefined

	return { from, to }
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
 * Falls back to dropping the handles when those edges run parallel and therefore
 * never meet.
 */
export function sharpenCorner(document: Document, panelId: string, vertexId: string): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	const count = panel.vertices.length
	const index = vertexIndex(panel, vertexId)

	if (index < 0 || count < 4) return setEdgeBow(document, panelId, vertexId, 0)

	const start = panel.vertices[index]
	const end = panel.vertices[(index + 1) % count]
	const before = panel.vertices[(index - 1 + count) % count]
	const after = panel.vertices[(index + 2) % count]

	if (start === undefined || end === undefined || before === undefined || after === undefined) {
		return document
	}

	const corner = intersectLines(before, start, after, end)

	if (corner === undefined) return setEdgeBow(document, panelId, vertexId, 0)

	const vertices = [...panel.vertices]

	vertices.splice(index, 2, { id: nextId("v"), x: corner.x, y: corner.y })

	return replacePanel(document, { ...panel, vertices })
}

/** How deep the edge leaving this vertex bows, in centimetres. */
export function edgeBow(panel: Panel, vertexId: string): number {
	return panel.vertices.find((entry) => entry.id === vertexId)?.bow ?? 0
}

/** Where along an edge its bow is deepest, from 0 to 1. */
export function edgeBowAt(panel: Panel, vertexId: string): number {
	return panel.vertices.find((entry) => entry.id === vertexId)?.bowAt ?? 0.5
}

export function setEdgeBowAt(
	document: Document,
	panelId: string,
	vertexId: string,
	at: number,
): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	const clamped = Math.min(0.95, Math.max(0.05, at))

	return replacePanel(document, {
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
export function setEdgeBow(
	document: Document,
	panelId: string,
	vertexId: string,
	bow: number,
): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	return replacePanel(document, {
		...panel,
		vertices: panel.vertices.map((vertex) =>
			vertex.id === vertexId ? { ...vertex, bow: bow === 0 ? undefined : bow } : vertex,
		),
	})
}

const CIRCULAR_TENSION = 0.552

/**
 * Rounds the corner at `vertexId` by pulling back `before` centimetres along the
 * incoming edge and `after` along the outgoing one.
 *
 * This is how Japanese drafts state a curve — 衿ぐり is written as two setbacks
 * from a corner, drawn with a 曲線定規 — rather than as handle positions, so the
 * two numbers are the input and the control points are derived.
 */
export function roundCorner(
	document: Document,
	panelId: string,
	vertexId: string,
	before: number,
	after: number,
	tension = CIRCULAR_TENSION,
): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	const index = vertexIndex(panel, vertexId)
	const count = panel.vertices.length

	if (index < 0 || count < 3) return document

	const cornerVertex = panel.vertices[index]
	const previous = panel.vertices[(index - 1 + count) % count]
	const next = panel.vertices[(index + 1) % count]

	if (cornerVertex === undefined || previous === undefined || next === undefined) return document

	const corner = { x: cornerVertex.x, y: cornerVertex.y }

	const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y)
	const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y)

	if (incoming === 0 || outgoing === 0) return document

	const backX = (corner.x - previous.x) / incoming
	const backY = (corner.y - previous.y) / incoming
	const forwardX = (next.x - corner.x) / outgoing
	const forwardY = (next.y - corner.y) / outgoing

	const start = { x: corner.x - backX * before, y: corner.y - backY * before }
	const end = { x: corner.x + forwardX * after, y: corner.y + forwardY * after }

	// The rounded run bows toward the corner it replaces, by the depth that a
	// circular arc through those two setbacks would reach.
	const chordX = end.x - start.x
	const chordY = end.y - start.y
	const chord = Math.hypot(chordX, chordY)
	const toCorner = (-chordY * (corner.x - start.x) + chordX * (corner.y - start.y)) / (chord || 1)

	const startVertex: Vertex = {
		id: nextId("v"),
		x: start.x,
		y: start.y,
		bow: Number((toCorner * tension).toFixed(3)),
	}

	const endVertex: Vertex = { id: nextId("v"), x: end.x, y: end.y }

	const vertices = [...panel.vertices]

	vertices.splice(index, 1, startVertex, endVertex)

	return replacePanel(document, { ...panel, vertices })
}

export function setFoldEdge(
	document: Document,
	panelId: string,
	vertexId: string | undefined,
): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	return replacePanel(document, { ...panel, foldEdge: vertexId })
}

export function updatePanel(
	document: Document,
	panelId: string,
	patch: Partial<Pick<Panel, "name" | "quantity">>,
): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	return replacePanel(document, { ...panel, ...patch })
}

export function addRectanglePanel(
	document: Document,
	x: number,
	y: number,
	width: number,
	height: number,
): { document: Document; panelId: string } {
	const panelId = nextId("panel")

	const vertices: Vertex[] = [
		{ id: nextId("v"), x: 0, y: 0 },
		{ id: nextId("v"), x: width, y: 0 },
		{ id: nextId("v"), x: width, y: height },
		{ id: nextId("v"), x: 0, y: height },
	]

	return {
		panelId,
		document: {
			...document,
			panels: [
				...document.panels,
				{
					id: panelId,
					name: `パーツ${document.panels.length + 1}`,
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
	document: Document,
	points: readonly { x: number; y: number }[],
): { document: Document; panelId: string } {
	const panelId = nextId("panel")

	const originX = Math.min(...points.map((entry) => entry.x))
	const originY = Math.min(...points.map((entry) => entry.y))

	return {
		panelId,
		document: {
			...document,
			panels: [
				...document.panels,
				{
					id: panelId,
					name: `パーツ${document.panels.length + 1}`,
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

export function duplicatePanel(document: Document, panelId: string): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	return {
		...document,
		panels: [
			...document.panels,
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
export function deletePanel(document: Document, panelId: string): Document {
	return {
		...document,
		panels: document.panels.filter((panel) => panel.id !== panelId),
		seams: document.seams.filter(
			(seam) => seam.a.edge.panelId !== panelId && seam.b.edge.panelId !== panelId,
		),
		stitches: document.stitches.filter((stitch) => stitch.run.edge.panelId !== panelId),
		annotations: document.annotations.filter(
			(annotation) => annotation.run.edge.panelId !== panelId,
		),
	}
}
