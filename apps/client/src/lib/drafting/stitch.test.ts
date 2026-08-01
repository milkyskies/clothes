import { describe, expect, it } from "vitest"
import type { Draft, Panel } from "./draft"
import { addStitch, stitchesOnEdge, stitchLine, updateStitch } from "./stitch"

function rectangle(id: string, width: number, height: number): Panel {
	return {
		id,
		name: id,
		quantity: 1,
		x: 0,
		y: 0,
		vertices: [
			{ id: `${id}-tl`, x: 0, y: 0 },
			{ id: `${id}-tr`, x: width, y: 0 },
			{ id: `${id}-br`, x: width, y: height },
			{ id: `${id}-bl`, x: 0, y: height },
		],
	}
}

const base: Draft = {
	id: "t",
	name: "t",
	panels: [rectangle("front", 30, 70)],
	seams: [],
	stitches: [],
	annotations: [],
	body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
	fabric: { name: "反物", width: 36 },
}

const hem = { panelId: "front", vertexId: "front-br" }

describe("addStitch", () => {
	it("covers_the_whole_edge_it_is_put_on", () => {
		const stitched = addStitch(base, hem, "topstitch")

		expect(stitchesOnEdge(stitched, hem)).toHaveLength(1)
		expect(stitched.stitches[0]?.run.to).toBeCloseTo(30, 6)
	})
})

describe("stitchLine", () => {
	it("sits_inside_the_cloth_rather_than_outside_the_cut_edge", () => {
		const stitched = addStitch(base, hem, "topstitch")
		const stitch = stitched.stitches[0]

		if (stitch === undefined) throw new Error("stitch missing")

		const line = stitchLine(stitched, { ...stitch, offset: 1 }, 0)

		expect(line.length).toBeGreaterThan(1)
		expect(line.every((point) => point.y < 70)).toBe(true)
		expect(line[1]?.y).toBeCloseTo(69, 1)
	})

	it("moves_further_in_when_the_offset_grows", () => {
		const stitched = addStitch(base, hem, "topstitch")
		const stitch = stitched.stitches[0]

		if (stitch === undefined) throw new Error("stitch missing")

		const near = stitchLine(stitched, { ...stitch, offset: 0.5 }, 0)
		const far = stitchLine(stitched, { ...stitch, offset: 3 }, 0)

		expect((far[1]?.y ?? 0) < (near[1]?.y ?? 0)).toBe(true)
	})

	it("stacks_extra_rows_beside_the_first", () => {
		const stitched = updateStitch(addStitch(base, hem, "topstitch"), "", {})
		const stitch = stitched.stitches[0]

		if (stitch === undefined) throw new Error("stitch missing")

		const first = stitchLine(stitched, stitch, 0)
		const second = stitchLine(stitched, stitch, 1)

		expect((second[1]?.y ?? 0) < (first[1]?.y ?? 0)).toBe(true)
	})
})
