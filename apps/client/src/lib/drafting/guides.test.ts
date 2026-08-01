import { describe, expect, it } from "vitest"
import { edgeGaps, edgeLength, pointAlong } from "./assembly"
import type { Draft, Panel } from "./draft"
import { jinbeiTop } from "./templates/jinbei"

const marked: Panel = {
	id: "front",
	name: "front",
	quantity: 1,
	x: 10,
	y: 5,
	vertices: [
		{ id: "a", x: 0, y: 0 },
		{ id: "b", x: 30, y: 0 },
		{ id: "c", x: 30, y: 70 },
		{ id: "d", x: 0, y: 70 },
	],
	guides: [
		{
			id: "pocket-line",
			name: "ポケット位置",
			points: [
				{ x: 5, y: 20 },
				{ x: 25, y: 20 },
			],
		},
	],
}

const base: Draft = {
	id: "t",
	name: "t",
	panels: [marked],
	seams: [],
	stitches: [],
	annotations: [],
	body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
	fabric: { name: "反物", width: 36 },
}

describe("internal lines", () => {
	it("measures_a_line_drawn_inside_the_piece_like_any_edge", () => {
		expect(edgeLength(base, { panelId: "front", vertexId: "pocket-line" })).toBeCloseTo(20, 6)
	})

	it("walks_along_it_in_draft_coordinates", () => {
		const spot = pointAlong(base, { panelId: "front", vertexId: "pocket-line" }, 10)

		expect(spot?.x).toBeCloseTo(25, 6)
		expect(spot?.y).toBeCloseTo(25, 6)
	})

	it("never_reports_an_unsewn_internal_line_as_an_opening", () => {
		const holes = edgeGaps(base, { panelId: "front", vertexId: "a" })

		expect(holes).toHaveLength(1)
	})

	it("keeps_the_甚平_clean_with_its_紐_stitched_onto_the_face", () => {
		const draft = jinbeiTop()
		const tieSeam = draft.seams.find((seam) => seam.id === "himotsuke-himo-mae-migi")

		expect(tieSeam?.b.edge.vertexId).toBe("himo-tsuke-mae")
		expect(edgeLength(draft, tieSeam?.b.edge ?? { panelId: "", vertexId: "" })).toBeCloseTo(6, 6)
	})
})
