import { describe, expect, it } from "vitest"
import type { Draft, Panel } from "./draft"
import { panelBounds } from "./draft"
import { stretchPanel } from "./edit"

const stepped: Panel = {
	id: "front",
	name: "前身頃",
	quantity: 1,
	x: 0,
	y: 0,
	vertices: [
		{ id: "a", x: 0, y: 0 },
		{ id: "b", x: 40, y: 0 },
		{ id: "c", x: 40, y: 80 },
		{ id: "d", x: 0, y: 80 },
		{ id: "e", x: 0, y: 55 },
		{ id: "f", x: 2, y: 55 },
	],
}

const base: Draft = {
	id: "t",
	name: "t",
	panels: [stepped],
	seams: [],
	stitches: [],
	annotations: [],
	body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
	fabric: { name: "広幅", width: 110 },
}

describe("stretchPanel", () => {
	it("moves_the_far_edge_out_to_reach_the_asked_for_size", () => {
		const longer = stretchPanel(base, "front", 40, 90)
		const panel = longer.panels[0]

		if (panel === undefined) throw new Error("panel missing")

		expect(panelBounds(panel).height).toBeCloseTo(90, 6)
	})

	it("leaves_a_feature_measured_from_the_top_where_it_was", () => {
		const longer = stretchPanel(base, "front", 40, 90)
		const step = longer.panels[0]?.vertices.find((vertex) => vertex.id === "f")

		expect(step?.y).toBeCloseTo(55, 6)
		expect(step?.x).toBeCloseTo(2, 6)
	})

	it("refuses_a_size_that_would_turn_the_piece_inside_out", () => {
		expect(stretchPanel(base, "front", 0, 80)).toBe(base)
		expect(stretchPanel(base, "front", 40, -5)).toBe(base)
	})
})
