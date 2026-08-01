import { describe, expect, it } from "vitest"
import type { Draft, Panel } from "./draft"
import { panelPath } from "./draft"
import { roundCorner } from "./edit"
import { flatten } from "./geometry/measure"

function square(size: number): Panel {
	return {
		id: "p",
		name: "p",
		quantity: 1,
		x: 0,
		y: 0,
		vertices: [
			{ id: "a", x: 0, y: 0 },
			{ id: "b", x: size, y: 0 },
			{ id: "c", x: size, y: size },
			{ id: "d", x: 0, y: size },
		],
	}
}

function documentWith(panel: Panel): Draft {
	return {
		id: "t",
		name: "t",
		panels: [panel],
		seams: [],
		stitches: [],
		annotations: [],
		body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
		fabric: { name: "反物", width: 36 },
	}
}

function nearestApproach(draft: Draft, corner: { x: number; y: number }): number {
	const panel = draft.panels[0]

	if (panel === undefined) throw new Error("panel missing")

	return Math.min(
		...flatten(panelPath(panel)).map((vertex) =>
			Math.hypot(vertex.point.x - corner.x, vertex.point.y - corner.y),
		),
	)
}

describe("roundCorner", () => {
	it("clears_a_right_angle_corner_by_the_stated_gap", () => {
		for (const gap of [0.7, 1.5, 3]) {
			const rounded = roundCorner(documentWith(square(20)), "p", "b", gap)

			expect(nearestApproach(rounded, { x: 20, y: 0 })).toBeCloseTo(gap, 1)
		}
	})

	it("replaces_the_corner_with_two_points", () => {
		const rounded = roundCorner(documentWith(square(20)), "p", "b", 0.7)

		expect(rounded.panels[0]?.vertices.length).toBe(5)
		expect(rounded.panels[0]?.vertices.some((vertex) => vertex.id === "b")).toBe(false)
	})

	it("leaves_the_other_corners_sharp", () => {
		const rounded = roundCorner(documentWith(square(20)), "p", "b", 0.7)

		expect(nearestApproach(rounded, { x: 20, y: 20 })).toBeCloseTo(0, 3)
		expect(nearestApproach(rounded, { x: 0, y: 0 })).toBeCloseTo(0, 3)
	})
})
