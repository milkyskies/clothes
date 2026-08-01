import Delaunator from "delaunator"
import { boundaryOffsets, edgeLength, pointAlong, pointAtBoundary } from "@/lib/drafting/assembly"
import { type Draft, type EdgeRun, findPanel, type Panel, panelPath } from "@/lib/drafting/draft"
import { flatten } from "@/lib/drafting/geometry/measure"
import type { Point } from "@/lib/drafting/geometry/path"
import { assemble, type Matrix } from "@/lib/drafting/layout"

/** Particle spacing in centimetres. Finer drapes better and costs quadratically. */
const SPACING = 3

export interface ClothMesh {
	/** xyz per particle, already arranged around the body. */
	readonly positions: Float32Array
	/** Flat 2D rest positions, which are the cloth's true size. */
	readonly rest: Float32Array
	readonly triangles: Uint32Array
	/** Pairs of particle indices with the rest length the cloth holds them at. */
	readonly edges: readonly { a: number; b: number; rest: number }[]
	/** Weak constraints across triangle pairs that resist creasing flat. */
	readonly bends: readonly { a: number; b: number; rest: number }[]
	/** Pairs a seam holds together at distance zero. */
	readonly seams: readonly { a: number; b: number }[]
	/** Pairs a knot or button holds together, closed only once the garment is on. */
	readonly ties: readonly { a: number; b: number }[]
	/**
	 * Panels stitched onto another panel's face, with their host. The pair lies
	 * deliberately stacked, so cloth-to-cloth repulsion between them is wrong.
	 */
	readonly stacked: readonly { a: string; b: string }[]
	readonly panelOf: Uint16Array
	readonly panelIds: readonly string[]
}

interface BoundaryTag {
	readonly index: number
	readonly edgeVertexId: string
	readonly arc: number
}

function insidePolygon(polygon: readonly Point[], x: number, y: number): boolean {
	let inside = false

	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
		const a = polygon[i]
		const b = polygon[j]

		if (a === undefined || b === undefined) continue

		if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
			inside = !inside
		}
	}

	return inside
}

function applyMatrix(matrix: Matrix, point: Point): Point {
	return {
		x: matrix.a * point.x + matrix.c * point.y + matrix.e,
		y: matrix.b * point.x + matrix.d * point.y + matrix.f,
	}
}

/** Which side of its 折り山 a local point sits on, matching the layout's part numbering. */
function partClassifier(draft: Draft, panel: Panel): (local: Point) => number {
	const crease = panel.creases?.[0]

	if (crease === undefined) return () => 0

	const from = pointAlong(draft, { panelId: panel.id, vertexId: crease.a.vertexId }, crease.a.at)
	const to = pointAlong(draft, { panelId: panel.id, vertexId: crease.b.vertexId }, crease.b.at)

	if (from === undefined || to === undefined) return () => 0

	const { offsets, total } = boundaryOffsets(draft, panel)
	const startArc = (offsets.get(crease.a.vertexId) ?? 0) + crease.a.at
	const endArc = (offsets.get(crease.b.vertexId) ?? 0) + crease.b.at
	const low = Math.min(startArc, endArc)
	const high = Math.max(startArc, endArc)
	const reference = pointAtBoundary(draft, panel, (low + high) / 2)

	if (reference === undefined || total <= 0) return () => 0

	const localFrom = { x: from.x - panel.x, y: from.y - panel.y }
	const localTo = { x: to.x - panel.x, y: to.y - panel.y }
	const localRef = { x: reference.x - panel.x, y: reference.y - panel.y }

	const side = (point: Point) =>
		(localTo.x - localFrom.x) * (point.y - localFrom.y) -
		(localTo.y - localFrom.y) * (point.x - localFrom.x)

	const zeroSide = Math.sign(side(localRef)) || 1

	return (local) => (Math.sign(side(local)) === zeroSide ? 0 : 1)
}

/** The part a seam run lies on, judged by its middle, matching the layout. */
function partOfRun(draft: Draft, panel: Panel, run: EdgeRun): number {
	const crease = panel.creases?.[0]

	if (crease === undefined) return 0

	const { offsets } = boundaryOffsets(draft, panel)
	const start = offsets.get(run.edge.vertexId)
	const creaseLow = (offsets.get(crease.a.vertexId) ?? 0) + crease.a.at
	const creaseHigh = (offsets.get(crease.b.vertexId) ?? 0) + crease.b.at
	const low = Math.min(creaseLow, creaseHigh)
	const high = Math.max(creaseLow, creaseHigh)

	if (start === undefined) return 0

	const middle = start + (run.from + run.to) / 2

	return middle >= low && middle <= high ? 0 : 1
}

/**
 * Which depth each half of each piece wears at: 0 in front of the body, 1
 * behind.
 *
 * Fold seams and 折り山 send the cloth to the other side of the body; seams
 * lying open keep it on the same side. Walking that parity out from the biggest
 * piece is what lets the flat layout be stood up around an avatar.
 */
function layerParities(draft: Draft): Map<string, number> {
	const layers = new Map<string, number>()
	const queue: { key: string; layer: number }[] = []

	const seed = draft.panels[0]

	if (seed === undefined) return layers

	for (const panel of draft.panels) {
		const key = `${panel.id}#0`

		if (layers.has(key)) continue
		if (queue.length > 0) continue

		layers.set(key, 0)
		queue.push({ key, layer: 0 })

		while (queue.length > 0) {
			const current = queue.shift()

			if (current === undefined) continue

			const [panelId, partText] = current.key.split("#")
			const part = Number(partText)
			const holder = panelId === undefined ? undefined : findPanel(draft, panelId)

			if (holder === undefined) continue

			if (holder.creases?.[0] !== undefined) {
				const otherKey = `${holder.id}#${part === 0 ? 1 : 0}`

				if (!layers.has(otherKey)) {
					const layer = (current.layer + 1) % 2

					layers.set(otherKey, layer)
					queue.push({ key: otherKey, layer })
				}
			}

			for (const seam of draft.seams) {
				const runs = [
					{ mine: seam.a, other: seam.b },
					{ mine: seam.b, other: seam.a },
				]

				for (const { mine, other } of runs) {
					if (mine.edge.panelId !== holder.id) continue
					if (partOfRun(draft, holder, mine) !== part) continue

					const neighbour = findPanel(draft, other.edge.panelId)

					if (neighbour === undefined) continue

					const neighbourKey = `${neighbour.id}#${partOfRun(draft, neighbour, other)}`

					if (layers.has(neighbourKey)) continue

					const layer = (current.layer + (seam.lie === "fold" ? 1 : 0)) % 2

					layers.set(neighbourKey, layer)
					queue.push({ key: neighbourKey, layer })
				}
			}
		}
	}

	return layers
}

/**
 * Builds the particle cloth for a whole draft, arranged around a body.
 *
 * The folded flat layout is already the garment seen from the front, so each
 * particle takes its x and height from there and its depth from which side of
 * the body its half of the piece wears on. Rest lengths come from the flat 2D
 * outline — that is the cloth's true size — so the guessed 3D start only has to
 * be near enough for the seams and the body to pull it right.
 */
export function buildClothMesh(draft: Draft, shoulderY: number): ClothMesh {
	const assembly = assemble(draft)
	const loose = new Set(assembly.loose)
	const layers = layerParities(draft)

	const positions: number[] = []
	const rest: number[] = []
	const triangles: number[] = []
	const panelOf: number[] = []
	const panelIds: string[] = []
	const edges: { a: number; b: number; rest: number }[] = []
	const bends: { a: number; b: number; rest: number }[] = []
	const seams: { a: number; b: number }[] = []
	const ties: { a: number; b: number }[] = []
	const tags = new Map<string, BoundaryTag[]>()

	const placed = assembly.placements.filter((entry) => !loose.has(entry.panelId))

	const pointsOf = (placement: (typeof placed)[number]) => {
		const panel = findPanel(draft, placement.panelId)

		if (panel === undefined) return []

		return flatten(panelPath(panel)).map((sample) =>
			applyMatrix(placement.matrix, { x: panel.x + sample.point.x, y: panel.y + sample.point.y }),
		)
	}

	const worldPoints = placed.flatMap(pointsOf)
	const xs = worldPoints.map((point) => point.x)
	const centreX = (Math.min(...xs) + Math.max(...xs)) / 2

	// The height reference is the top of the biggest piece — the 肩 line — not
	// the top of everything: a collar or tie poking higher would otherwise lower
	// the whole garment until the shoulders no longer catch it.
	const biggest = [...placed].sort(
		(left, right) => areaOf(draft, right.panelId) - areaOf(draft, left.panelId),
	)[0]
	const topY = biggest === undefined ? 0 : Math.min(...pointsOf(biggest).map((point) => point.y))

	for (const panel of draft.panels) {
		if (loose.has(panel.id)) continue

		const outline = flatten(panelPath(panel)).map((sample) => sample.point)

		if (outline.length < 3) continue

		const classify = partClassifier(draft, panel)
		const matrices = new Map(
			assembly.placements
				.filter((entry) => entry.panelId === panel.id)
				.map((entry) => [entry.part, { matrix: entry.matrix, part: entry.part }]),
		)

		const panelIndex = panelIds.length

		panelIds.push(panel.id)

		const localPoints: Point[] = []
		const localTags: { edgeVertexId: string; arc: number }[] = []

		const path = panelPath(panel)

		for (let segment = 0; segment < path.segments.length; segment += 1) {
			const vertex = panel.vertices[segment]

			if (vertex === undefined) continue

			const edge = { panelId: panel.id, vertexId: vertex.id }
			const along = edgeLength(draft, edge)
			const steps = Math.max(1, Math.round(along / SPACING))

			for (let step = 0; step < steps; step += 1) {
				const arc = (along * step) / steps
				const world = pointAlong(draft, edge, arc)

				if (world === undefined) continue

				localPoints.push({ x: world.x - panel.x, y: world.y - panel.y })
				localTags.push({ edgeVertexId: vertex.id, arc })
			}
		}

		const boundaryCount = localPoints.length

		const minX = Math.min(...outline.map((point) => point.x))
		const maxX = Math.max(...outline.map((point) => point.x))
		const minY = Math.min(...outline.map((point) => point.y))
		const maxY = Math.max(...outline.map((point) => point.y))

		for (let y = minY + SPACING / 2; y < maxY; y += SPACING) {
			for (let x = minX + SPACING / 2; x < maxX; x += SPACING) {
				if (!insidePolygon(outline, x, y)) continue

				const nearBoundary = localPoints
					.slice(0, boundaryCount)
					.some((point) => Math.hypot(point.x - x, point.y - y) < SPACING * 0.45)

				if (nearBoundary) continue

				localPoints.push({ x, y })
			}
		}

		const base = positions.length / 3
		const layerDepth = 12

		for (let index = 0; index < localPoints.length; index += 1) {
			const local = localPoints[index]

			if (local === undefined) continue

			const part = classify(local)
			const chosen = matrices.get(part) ?? matrices.get(0)
			const matrix = chosen?.matrix

			if (matrix === undefined) continue

			const world = applyMatrix(matrix, { x: panel.x + local.x, y: panel.y + local.y })
			const layer = layers.get(`${panel.id}#${part}`) ?? 0

			// Cloth near the top line starts tented to the middle and lifted, so
			// the 肩 ridge and each 袖山 fold begin above the shoulders and arms
			// they must come to rest on. Left at full depth, the two faces of a
			// fold snap together underneath the support and the garment slides
			// straight off the body.
			const belowTop = Math.max(0, world.y - topY)
			const spread = Math.min(1, belowTop / 12)
			const depth = layerDepth * (0.1 + 0.9 * spread)

			positions.push(
				world.x - centreX,
				shoulderY - (world.y - topY) + 5 * (1 - spread),
				layer === 0 ? depth : -depth,
			)
			rest.push(local.x, local.y)
			panelOf.push(panelIndex)

			const tag = localTags[index]

			if (tag !== undefined) {
				const held = tags.get(`${panel.id}/${tag.edgeVertexId}`) ?? []

				held.push({ index: base + index, edgeVertexId: tag.edgeVertexId, arc: tag.arc })
				tags.set(`${panel.id}/${tag.edgeVertexId}`, held)
			}
		}

		// Internal lines get tags too: the nearest cloth particle stands in for
		// each stretch of the line, which is exactly what a stitch through the
		// face of the cloth does.
		for (const guide of panel.guides ?? []) {
			let travelled = 0

			for (let leg = 1; leg < guide.points.length; leg += 1) {
				const from = guide.points[leg - 1]
				const to = guide.points[leg]

				if (from === undefined || to === undefined) continue

				const length = Math.hypot(to.x - from.x, to.y - from.y)
				const steps = Math.max(1, Math.round(length / SPACING))

				for (let stepAt = 0; stepAt <= steps; stepAt += 1) {
					const at = stepAt / steps
					const x = from.x + (to.x - from.x) * at
					const y = from.y + (to.y - from.y) * at

					let nearest = -1
					let best = SPACING * SPACING

					for (let index = 0; index < localPoints.length; index += 1) {
						const candidate = localPoints[index]

						if (candidate === undefined) continue

						const dx = candidate.x - x
						const dy = candidate.y - y
						const squared = dx * dx + dy * dy

						if (squared < best) {
							best = squared
							nearest = index
						}
					}

					if (nearest < 0) continue

					const held = tags.get(`${panel.id}/${guide.id}`) ?? []

					held.push({
						index: base + nearest,
						edgeVertexId: guide.id,
						arc: travelled + length * at,
					})
					tags.set(`${panel.id}/${guide.id}`, held)
				}

				travelled += length
			}
		}

		const flat = localPoints.flatMap((point) => [point.x, point.y])
		const delaunay = new Delaunator(flat)
		const seen = new Set<string>()
		const edgeUse = new Map<string, number[]>()

		for (let t = 0; t < delaunay.triangles.length; t += 3) {
			const a = delaunay.triangles[t]
			const b = delaunay.triangles[t + 1]
			const c = delaunay.triangles[t + 2]

			if (a === undefined || b === undefined || c === undefined) continue

			const pa = localPoints[a]
			const pb = localPoints[b]
			const pc = localPoints[c]

			if (pa === undefined || pb === undefined || pc === undefined) continue

			const cx = (pa.x + pb.x + pc.x) / 3
			const cy = (pa.y + pb.y + pc.y) / 3

			if (!insidePolygon(outline, cx, cy)) continue

			triangles.push(base + a, base + b, base + c)

			for (const [p, q, other] of [
				[a, b, c],
				[b, c, a],
				[c, a, b],
			] as const) {
				const key = p < q ? `${p}-${q}` : `${q}-${p}`

				if (!seen.has(key)) {
					seen.add(key)

					const from = localPoints[p]
					const to = localPoints[q]

					if (from !== undefined && to !== undefined) {
						edges.push({
							a: base + p,
							b: base + q,
							rest: Math.hypot(to.x - from.x, to.y - from.y),
						})
					}
				}

				const held = edgeUse.get(key) ?? []

				held.push(other)
				edgeUse.set(key, held)
			}
		}

		for (const opposite of edgeUse.values()) {
			const [p, q] = opposite

			if (p === undefined || q === undefined) continue

			const from = localPoints[p]
			const to = localPoints[q]

			if (from === undefined || to === undefined) continue

			bends.push({ a: base + p, b: base + q, rest: Math.hypot(to.x - from.x, to.y - from.y) })
		}
	}

	// A knot holds cloth together the way a seam does, but not from the same
	// moment: seams exist before the garment goes on, knots are tied afterwards.
	// The 甚平's ties run diagonally, and closing them while the cloth was still
	// weightless dragged the whole garment sideways off the shoulders.
	const guideIds = new Set(
		draft.panels.flatMap((panel) => (panel.guides ?? []).map((guide) => `${panel.id}/${guide.id}`)),
	)

	const stacked: { a: string; b: string }[] = []

	for (const seam of draft.seams) {
		const onGuide =
			guideIds.has(`${seam.a.edge.panelId}/${seam.a.edge.vertexId}`) ||
			guideIds.has(`${seam.b.edge.panelId}/${seam.b.edge.vertexId}`)

		if (onGuide && seam.a.edge.panelId !== seam.b.edge.panelId) {
			stacked.push({ a: seam.a.edge.panelId, b: seam.b.edge.panelId })
		}
	}

	const joins = [
		...draft.seams.map((seam) => ({
			a: seam.a,
			b: seam.b,
			reversed: seam.reversed === true,
			into: seams,
		})),
		...(draft.fastenings ?? []).map((fastening) => ({
			a: fastening.a,
			b: fastening.b,
			reversed: false,
			into: ties,
		})),
	]

	for (const join of joins) {
		const sideA = collectRun(tags, join.a)
		const sideB = collectRun(tags, join.b)

		if (sideA.length === 0 || sideB.length === 0) continue

		const orderedB = join.reversed ? [...sideB].reverse() : sideB

		for (let step = 0; step < sideA.length; step += 1) {
			const a = sideA[step]
			const b = orderedB[Math.round((step * (orderedB.length - 1)) / Math.max(1, sideA.length - 1))]

			if (a === undefined || b === undefined) continue

			join.into.push({ a: a.index, b: b.index })
		}
	}

	return {
		positions: new Float32Array(positions),
		rest: new Float32Array(rest),
		triangles: new Uint32Array(triangles),
		edges,
		bends,
		seams,
		ties,
		stacked,
		panelOf: new Uint16Array(panelOf),
		panelIds,
	}
}

function areaOf(draft: Draft, panelId: string): number {
	const panel = findPanel(draft, panelId)

	if (panel === undefined) return 0

	const points = flatten(panelPath(panel)).map((sample) => sample.point)
	const xs = points.map((point) => point.x)
	const ys = points.map((point) => point.y)

	if (points.length === 0) return 0

	return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
}

function collectRun(tags: Map<string, BoundaryTag[]>, run: EdgeRun): BoundaryTag[] {
	const low = Math.min(run.from, run.to)
	const high = Math.max(run.from, run.to)

	return (tags.get(`${run.edge.panelId}/${run.edge.vertexId}`) ?? [])
		.filter((tag) => tag.arc >= low - 0.01 && tag.arc <= high + 0.01)
		.sort((left, right) => left.arc - right.arc)
}
