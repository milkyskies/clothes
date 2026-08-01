import { describe, expect, it } from "vitest"
import { addSeam, removeSeam, runLength, seamMismatch, setSeamRun } from "./assemble"
import { edgeGaps } from "./assembly"
import type { Draft, Panel } from "./draft"

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
	panels: [rectangle("front", 30, 70), rectangle("back", 26, 70)],
	seams: [],
	stitches: [],
	annotations: [],
	body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
}

const frontSide = { panelId: "front", vertexId: "front-tr" }
const backSide = { panelId: "back", vertexId: "back-tr" }
const frontTop = { panelId: "front", vertexId: "front-tl" }

describe("addSeam", () => {
	it("sews_both_edges_end_to_end_so_a_new_seam_leaves_no_opening", () => {
		const sewn = addSeam(base, frontSide, backSide)
		const seam = sewn.seams[0]

		if (seam === undefined) throw new Error("seam missing")

		expect(runLength(seam.a)).toBeCloseTo(70, 6)
		expect(runLength(seam.b)).toBeCloseTo(70, 6)
		expect(edgeGaps(sewn, frontSide)).toEqual([])
	})

	it("refuses_to_sew_an_edge_to_itself", () => {
		expect(addSeam(base, frontSide, frontSide).seams).toEqual([])
	})
})

describe("setSeamRun", () => {
	it("shortening_a_run_opens_the_rest_of_that_edge", () => {
		const sewn = addSeam(base, frontSide, backSide)
		const seam = sewn.seams[0]

		if (seam === undefined) throw new Error("seam missing")

		const shortened = setSeamRun(sewn, seam.id, "a", 0, 52)

		expect(edgeGaps(shortened, frontSide)).toEqual([{ from: 52, to: 70 }])
	})

	it("holds_a_run_inside_its_edge", () => {
		const sewn = addSeam(base, frontSide, backSide)
		const seam = sewn.seams[0]

		if (seam === undefined) throw new Error("seam missing")

		const clamped = setSeamRun(sewn, seam.id, "a", -20, 400)
		const run = clamped.seams[0]?.a

		expect(run?.from).toBe(0)
		expect(run?.to).toBeCloseTo(70, 6)
	})

	it("reversed_values_are_read_as_a_range", () => {
		const sewn = addSeam(base, frontSide, backSide)
		const seam = sewn.seams[0]

		if (seam === undefined) throw new Error("seam missing")

		const flipped = setSeamRun(sewn, seam.id, "a", 52, 13)

		expect(flipped.seams[0]?.a.from).toBe(13)
		expect(flipped.seams[0]?.a.to).toBe(52)
	})
})

describe("seamMismatch", () => {
	it("is_zero_when_both_sides_are_the_same_length", () => {
		const sewn = addSeam(base, frontSide, backSide)
		const seam = sewn.seams[0]

		if (seam === undefined) throw new Error("seam missing")

		expect(seamMismatch(seam)).toBe(0)
	})

	it("reports_the_difference_when_edges_do_not_match", () => {
		const sewn = addSeam(base, frontTop, backSide)
		const seam = sewn.seams[0]

		if (seam === undefined) throw new Error("seam missing")

		expect(seamMismatch(seam)).toBeCloseTo(40, 1)
	})
})

describe("removeSeam", () => {
	it("reopens_the_edges_it_was_holding_together", () => {
		const sewn = addSeam(base, frontSide, backSide)
		const seam = sewn.seams[0]

		if (seam === undefined) throw new Error("seam missing")

		expect(edgeGaps(removeSeam(sewn, seam.id), frontSide)).toEqual([{ from: 0, to: 70 }])
	})
})
