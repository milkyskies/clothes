import { describe, expect, it } from "vitest"
import { edgesLength, flatten, pathLength, segmentLength } from "./measure"
import { curve, fillet, line, type Path, point } from "./path"

describe("segmentLength", () => {
	it("straight_edge_measures_its_euclidean_distance", () => {
		expect(segmentLength(point(0, 0), line("side", point(3, 4)))).toBeCloseTo(5, 10)
	})

	it("curve_with_collinear_handles_measures_as_a_straight_run", () => {
		const straightened = curve("edge", point(10, 0), point(3, 0), point(7, 0))

		expect(segmentLength(point(0, 0), straightened)).toBeCloseTo(10, 6)
	})

	it("quarter_circle_curve_measures_close_to_its_arc_length", () => {
		const radius = 10
		const rounded = fillet("kenzaki", point(0, -radius), point(0, 0), point(radius, 0), radius)
		const expected = (Math.PI * radius) / 2

		expect(segmentLength(rounded.from, rounded.segment)).toBeCloseTo(expected, 1)
	})
})

describe("pathLength", () => {
	it("rectangle_measures_its_perimeter", () => {
		const rectangle: Path = {
			start: point(0, 0),
			segments: [
				line("top", point(46, 0)),
				line("right", point(46, 70)),
				line("bottom", point(0, 70)),
				line("left", point(0, 0)),
			],
		}

		expect(pathLength(rectangle)).toBeCloseTo(232, 10)
	})
})

describe("edgesLength", () => {
	it("sums_only_the_named_edges", () => {
		const rectangle: Path = {
			start: point(0, 0),
			segments: [
				line("top", point(46, 0)),
				line("right", point(46, 70)),
				line("bottom", point(0, 70)),
				line("left", point(0, 0)),
			],
		}

		expect(edgesLength(rectangle, ["right", "left"])).toBeCloseTo(140, 10)
	})

	it("front_edge_run_gives_the_collar_band_length", () => {
		const kenzakiDepth = 18
		const bodyLength = 70
		const neckPointAcross = 8

		const rounded = fillet(
			"kenzaki",
			point(0, bodyLength),
			point(0, kenzakiDepth),
			point(neckPointAcross, 0),
			8,
		)

		const front: Path = {
			start: point(0, bodyLength),
			segments: [
				line("front-vertical", rounded.from),
				rounded.segment,
				line("front-diagonal", point(neckPointAcross, 0)),
				line("shoulder", point(25, 0)),
				line("side", point(25, bodyLength)),
				line("hem", point(0, bodyLength)),
			],
		}

		const bandRun = edgesLength(front, ["front-vertical", "kenzaki", "front-diagonal"])

		const sharpCornerRun = bodyLength - kenzakiDepth + Math.hypot(kenzakiDepth, neckPointAcross)

		expect(bandRun).toBeLessThan(sharpCornerRun)
		expect(bandRun).toBeGreaterThan(sharpCornerRun - 4)
	})
})

describe("flatten", () => {
	it("keeps_every_vertex_tagged_with_the_edge_that_produced_it", () => {
		const rounded = fillet("kenzaki", point(0, 20), point(0, 0), point(10, 0), 5)

		const path: Path = {
			start: point(0, 20),
			segments: [
				line("front-vertical", rounded.from),
				rounded.segment,
				line("front-diagonal", point(10, 0)),
				line("closing", point(0, 20)),
			],
		}

		const vertices = flatten(path)
		const producedBy = new Set(vertices.map((vertex) => vertex.segmentId))

		expect(producedBy).toEqual(new Set(["front-vertical", "kenzaki", "front-diagonal", "closing"]))
		expect(vertices.filter((vertex) => vertex.segmentId === "kenzaki").length).toBeGreaterThan(10)
	})
})
