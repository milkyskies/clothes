import { describe, expect, it } from "vitest"
import { flatten } from "./measure"
import { boundingBox, offsetPath } from "./offset"
import { distance, fillet, line, type Path, point, signedArea } from "./path"

const rectangle: Path = {
	start: point(0, 0),
	segments: [
		line("top", point(46, 0)),
		line("right", point(46, 70)),
		line("bottom", point(0, 70)),
		line("left", point(0, 0)),
	],
}

describe("offsetPath", () => {
	it("uniform_allowance_grows_a_rectangle_on_every_side", () => {
		const cut = offsetPath(rectangle, { perEdge: {}, fallback: 1.5 })
		const box = boundingBox(cut)

		expect(box.width).toBeCloseTo(49, 6)
		expect(box.height).toBeCloseTo(73, 6)
		expect(box.minX).toBeCloseTo(-1.5, 6)
		expect(box.minY).toBeCloseTo(-1.5, 6)
	})

	it("per_edge_allowance_grows_only_the_edge_it_names", () => {
		const cut = offsetPath(rectangle, { perEdge: { bottom: 3 }, fallback: 1.5 })
		const box = boundingBox(cut)

		expect(box.width).toBeCloseTo(49, 6)
		expect(box.height).toBeCloseTo(74.5, 6)
		expect(box.maxY).toBeCloseTo(73, 6)
	})

	it("offset_is_independent_of_winding_direction", () => {
		const reversed: Path = {
			start: point(0, 0),
			segments: [
				line("left", point(0, 70)),
				line("bottom", point(46, 70)),
				line("right", point(46, 0)),
				line("top", point(0, 0)),
			],
		}

		expect(signedArea(rectangle.segments.map((segment) => segment.to))).toBeGreaterThan(0)
		expect(signedArea(reversed.segments.map((segment) => segment.to))).toBeLessThan(0)

		const box = boundingBox(offsetPath(reversed, { perEdge: {}, fallback: 1.5 }))

		expect(box.width).toBeCloseTo(49, 6)
		expect(box.height).toBeCloseTo(73, 6)
	})

	it("allowance_follows_a_rounded_corner_without_collapsing_it", () => {
		const rounded = fillet("kenzaki", point(0, 40), point(0, 18), point(8, 0), 8)

		const front: Path = {
			start: point(0, 40),
			segments: [
				line("front-vertical", rounded.from),
				rounded.segment,
				line("front-diagonal", point(8, 0)),
				line("shoulder", point(25, 0)),
				line("side", point(25, 40)),
				line("hem", point(0, 40)),
			],
		}

		const cut = offsetPath(front, { perEdge: { hem: 3 }, fallback: 1.5 })
		const roundedVertices = cut.filter((vertex) => vertex.segmentId === "kenzaki")
		const original = flatten(front)

		expect(roundedVertices.length).toBeGreaterThan(10)

		for (const vertex of roundedVertices) {
			const nearest = Math.min(...original.map((source) => distance(vertex.point, source.point)))

			expect(nearest).toBeCloseTo(1.5, 2)
		}
	})

	it("degenerate_path_returns_nothing_rather_than_throwing", () => {
		expect(
			offsetPath({ start: point(0, 0), segments: [] }, { perEdge: {}, fallback: 1.5 }),
		).toEqual([])
	})
})
