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

export function toggleEdgeCurve(document: Document, panelId: string, vertexId: string): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	const index = vertexIndex(panel, vertexId)
	const source = panel.vertices[index]
	const target = panel.vertices[(index + 1) % panel.vertices.length]

	if (source === undefined || target === undefined) return document

	if (source.out !== undefined || source.nextIn !== undefined) {
		return setHandle(
			setHandle(document, panelId, vertexId, "out", undefined),
			panelId,
			vertexId,
			"nextIn",
			undefined,
		)
	}

	const spanX = (target.x - source.x) / 3
	const spanY = (target.y - source.y) / 3

	return replacePanel(document, {
		...panel,
		vertices: panel.vertices.map((vertex) =>
			vertex.id === vertexId
				? { ...vertex, out: { x: spanX, y: spanY }, nextIn: { x: -spanX, y: -spanY } }
				: vertex,
		),
	})
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

export function renamePanel(document: Document, panelId: string, name: string): Document {
	const panel = document.panels.find((entry) => entry.id === panelId)

	if (panel === undefined) return document

	return replacePanel(document, { ...panel, name })
}

export function updatePanel(
	document: Document,
	panelId: string,
	patch: Partial<Pick<Panel, "name" | "quantity" | "onFold">>,
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
					onFold: false,
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
					onFold: false,
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
