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

	vertices[index] = { ...source, out: undefined, nextIn: undefined }
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

export function setHandle(
	document: Document,
	panelId: string,
	vertexId: string,
	side: "out" | "nextIn",
	handle: { x: number; y: number } | undefined,
): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	return replacePanel(document, {
		...panel,
		vertices: panel.vertices.map((vertex) =>
			vertex.id === vertexId ? { ...vertex, [side]: handle } : vertex,
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

	const corner = panel.vertices[index]
	const previous = panel.vertices[(index - 1 + count) % count]
	const next = panel.vertices[(index + 1) % count]

	if (corner === undefined || previous === undefined || next === undefined) return document

	const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y)
	const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y)

	if (incoming === 0 || outgoing === 0) return document

	const backX = (corner.x - previous.x) / incoming
	const backY = (corner.y - previous.y) / incoming
	const forwardX = (next.x - corner.x) / outgoing
	const forwardY = (next.y - corner.y) / outgoing

	const start = { x: corner.x - backX * before, y: corner.y - backY * before }
	const end = { x: corner.x + forwardX * after, y: corner.y + forwardY * after }

	const startVertex: Vertex = {
		id: nextId("v"),
		x: start.x,
		y: start.y,
		out: { x: backX * before * tension, y: backY * before * tension },
		nextIn: { x: -forwardX * after * tension, y: -forwardY * after * tension },
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

	const allowance = { ...panel.allowance }

	if (panel.foldEdge !== undefined) delete allowance[panel.foldEdge]
	// A fold is not cut, so it never carries seam allowance.
	if (vertexId !== undefined) allowance[vertexId] = 0

	return replacePanel(document, { ...panel, foldEdge: vertexId, allowance })
}

export function setEdgeAllowance(
	document: Document,
	panelId: string,
	vertexId: string,
	allowance: number,
): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	return replacePanel(document, {
		...panel,
		allowance: { ...panel.allowance, [vertexId]: allowance },
	})
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
					allowance: {},
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
					allowance: {},
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
