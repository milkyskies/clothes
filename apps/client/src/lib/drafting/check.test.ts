import { describe, expect, it } from "vitest"
import { addSeam, flipSeam, setSeamRun } from "./assemble"
import { checkDraft, openingRings } from "./check"
import type { Draft, Panel } from "./draft"

function rectangle(id: string, width: number, height: number, x = 0): Panel {
	return {
		id,
		name: id,
		quantity: 1,
		x,
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
	panels: [rectangle("front", 30, 70), rectangle("back", 30, 70, 40)],
	seams: [],
	stitches: [],
	annotations: [],
	body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
	fabric: { name: "反物", width: 36 },
}

const frontRight = { panelId: "front", vertexId: "front-tr" }
const frontLeft = { panelId: "front", vertexId: "front-bl" }
const backRight = { panelId: "back", vertexId: "back-tr" }
const backLeft = { panelId: "back", vertexId: "back-bl" }
const frontTop = { panelId: "front", vertexId: "front-tl" }

function sewSides(draft: Draft): Draft {
	return addSeam(addSeam(draft, frontRight, backLeft), frontLeft, backRight)
}

describe("checkDraft", () => {
	it("says_nothing_is_wrong_when_two_edges_of_equal_length_are_sewn", () => {
		const sewn = addSeam(base, frontRight, backLeft)

		expect(checkDraft(sewn).filter((entry) => entry.severity === "error")).toEqual([])
	})

	it("reports_a_seam_whose_two_sides_cannot_meet", () => {
		const sewn = addSeam(base, frontTop, backLeft)
		const reported = checkDraft(sewn).find((entry) => entry.id.startsWith("length-"))

		expect(reported?.severity).toBe("error")
		expect(reported?.detail).toContain("40.0cm ちがいます")
	})

	it("treats_a_difference_cloth_can_ease_as_a_warning_not_an_error", () => {
		const sewn = addSeam(base, frontRight, backLeft)
		const seam = sewn.seams[0]

		if (seam === undefined) throw new Error("seam missing")

		const eased = setSeamRun(sewn, seam.id, "a", 0, 68.8)
		const reported = checkDraft(eased).find((entry) => entry.id.startsWith("length-"))

		expect(reported?.severity).toBe("warn")
	})

	it("catches_the_same_stretch_of_cloth_being_sewn_by_two_seams", () => {
		const sewn = addSeam(addSeam(base, frontRight, backLeft), frontRight, backRight)
		const reported = checkDraft(sewn).find((entry) => entry.id.startsWith("overlap-"))

		expect(reported?.severity).toBe("error")
		expect(reported?.title).toBe("同じところを2回縫っています")
	})

	it("reports_a_panel_that_is_never_sewn_to_anything", () => {
		const loose = { ...base, panels: [...base.panels, rectangle("sode", 32, 62, 80)] }
		const sewn = addSeam(loose, frontRight, backLeft)
		const reported = checkDraft(sewn).find((entry) => entry.id === "detached-sode")

		expect(reported?.severity).toBe("warn")
		expect(reported?.title).toBe("sodeがどこにも付いていません")
	})
})

describe("cloth checks", () => {
	it("reports_a_piece_that_will_not_fit_across_the_cloth", () => {
		const narrow: Draft = { ...base, fabric: { name: "反物", width: 20 } }
		const reported = checkDraft(narrow).find((entry) => entry.id === "too-wide-front")

		expect(reported?.severity).toBe("error")
		expect(reported?.fix).toBe("cutting")
	})

	it("keeps_the_length_to_buy_in_front_of_the_maker", () => {
		const reported = checkDraft(base).find((entry) => entry.id === "cloth")

		expect(reported?.severity).toBe("info")
		expect(reported?.title).toContain("1.40m")
	})
})

describe("openingRings", () => {
	it("measures_the_hem_and_the_neck_of_a_closed_tube_separately", () => {
		const rings = openingRings(sewSides(base))

		expect(rings).toHaveLength(2)
		expect(rings.every((ring) => ring.closed)).toBe(true)
		expect(rings[0]?.length).toBeCloseTo(60, 6)
		expect(rings[1]?.length).toBeCloseTo(60, 6)
	})

	it("counts_a_身八つ口_as_part_of_the_hole_it_opens_into", () => {
		const sewn = sewSides(base)
		const seam = sewn.seams[0]

		if (seam === undefined) throw new Error("seam missing")

		const opened = setSeamRun(setSeamRun(sewn, seam.id, "a", 15, 70), seam.id, "b", 0, 55)
		const rings = openingRings(opened)

		expect(rings).toHaveLength(2)
		expect(rings[0]?.length).toBeCloseTo(90, 6)
		expect(rings[1]?.length).toBeCloseTo(60, 6)
	})

	it("splits_a_ring_differently_when_a_piece_is_sewn_on_turned_around", () => {
		const sewn = sewSides(base)
		const seam = sewn.seams[0]

		if (seam === undefined) throw new Error("seam missing")

		const turned = flipSeam(sewn, seam.id)
		const rings = openingRings(turned)

		expect(rings).toHaveLength(1)
		expect(rings[0]?.length).toBeCloseTo(120, 6)
	})

	it("sees_two_loose_panels_as_two_separate_outlines", () => {
		const rings = openingRings(base)

		expect(rings).toHaveLength(2)
		expect(rings[0]?.length).toBeCloseTo(200, 6)
	})
})
