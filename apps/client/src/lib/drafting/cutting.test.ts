import { describe, expect, it } from "vitest"
import { cuttingLayout, pieces } from "./cutting"
import type { Draft, Panel } from "./draft"
import { jinbeiTop } from "./templates/jinbei"

function rectangle(id: string, width: number, height: number, quantity = 1): Panel {
	return {
		id,
		name: id,
		quantity,
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

function draftOf(panels: Panel[], width: number): Draft {
	return {
		id: "t",
		name: "t",
		panels,
		seams: [],
		stitches: [],
		annotations: [],
		body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
		fabric: { name: "反物", width },
	}
}

describe("pieces", () => {
	it("measures_a_piece_across_and_along_the_bolt", () => {
		const [piece] = pieces(draftOf([rectangle("a", 30, 70)], 36))

		expect(piece?.across).toBe(30)
		expect(piece?.along).toBe(70)
	})

	it("counts_a_curve_that_bulges_past_its_corners", () => {
		const bowed = rectangle("a", 30, 70)
		const widened: Panel = {
			...bowed,
			vertices: bowed.vertices.map((vertex) =>
				vertex.id === "a-tr" ? { ...vertex, bow: -3 } : vertex,
			),
		}

		const [piece] = pieces(draftOf([widened], 36))

		expect(piece?.across).toBeGreaterThan(30)
	})
})

describe("cuttingLayout", () => {
	it("puts_pieces_side_by_side_until_the_cloth_runs_out_of_width", () => {
		const layout = cuttingLayout(draftOf([rectangle("a", 30, 70, 3)], 70))

		expect(layout.placements).toHaveLength(3)
		expect(layout.length).toBe(140)
	})

	it("needs_one_length_per_piece_when_nothing_fits_beside_anything", () => {
		const layout = cuttingLayout(draftOf([rectangle("a", 30, 70, 2)], 36))

		expect(layout.length).toBe(140)
	})

	it("never_pushes_a_row_down_by_placing_a_longer_piece_beside_a_shorter_one", () => {
		const layout = cuttingLayout(
			draftOf([rectangle("short", 30, 10), rectangle("long", 30, 90)], 70),
		)

		expect(layout.length).toBe(90)
	})

	it("reports_a_piece_wider_than_the_cloth_instead_of_placing_it", () => {
		const layout = cuttingLayout(draftOf([rectangle("wide", 50, 70)], 36))

		expect(layout.tooWide.map((piece) => piece.name)).toEqual(["wide"])
		expect(layout.placements).toEqual([])
	})

	it("fits_the_甚平_onto_広幅_cloth", () => {
		const layout = cuttingLayout(jinbeiTop())

		expect(layout.tooWide).toEqual([])
		expect(layout.length).toBeLessThan(400)
		expect(layout.efficiency).toBeGreaterThan(0.5)
	})
})
