import { describe, expect, it } from "vitest"
import { addSeam } from "./assemble"
import { pointAlong } from "./assembly"
import type { Draft, Panel } from "./draft"
import { assemble } from "./layout"
import { jinbeiTop } from "./templates/jinbei"

function rectangle(id: string, width: number, height: number, x: number): Panel {
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
	panels: [rectangle("front", 30, 70, 0), rectangle("back", 30, 70, 60)],
	seams: [],
	stitches: [],
	annotations: [],
	body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
	fabric: { name: "反物", width: 36 },
}

function placedPoint(draft: Draft, panelId: string, vertexId: string, at: number) {
	const assembled = assemble(draft)
	const placement = assembled.placements.find((entry) => entry.panelId === panelId)
	const local = pointAlong(draft, { panelId, vertexId }, at)

	if (placement === undefined || local === undefined) throw new Error("not placed")

	const { matrix } = placement

	return {
		x: matrix.a * local.x + matrix.c * local.y + matrix.e,
		y: matrix.b * local.x + matrix.d * local.y + matrix.f,
	}
}

describe("assemble", () => {
	it("brings_the_two_sewn_edges_onto_the_same_line", () => {
		const sewn = addSeam(
			base,
			{ panelId: "front", vertexId: "front-tr" },
			{
				panelId: "back",
				vertexId: "back-bl",
			},
		)

		const a = placedPoint(sewn, "front", "front-tr", 0)
		const b = placedPoint(sewn, "back", "back-bl", 70)

		expect(a.x).toBeCloseTo(b.x, 6)
		expect(a.y).toBeCloseTo(b.y, 6)
	})

	it("lays_the_joined_piece_beside_the_first_rather_than_on_top_of_it", () => {
		const sewn = addSeam(
			base,
			{ panelId: "front", vertexId: "front-tr" },
			{
				panelId: "back",
				vertexId: "back-bl",
			},
		)

		const front = placedPoint(sewn, "front", "front-tl", 0)
		const back = placedPoint(sewn, "back", "back-tr", 0)

		expect(Math.abs(back.x - front.x)).toBeGreaterThan(30)
	})

	it("leaves_a_piece_the_seams_never_reach_where_it_was_drawn", () => {
		const assembled = assemble(base)

		expect(assembled.loose).toEqual(["back"])
	})

	it("opens_the_甚平_out_into_one_connected_garment", () => {
		const assembled = assemble(jinbeiTop())
		const bodyAndSleeves = ["mae-migoro-migi", "ushiro-migoro-migi", "sode-migi", "sode-hidari"]

		expect(assembled.loose).toEqual(expect.not.arrayContaining(bodyAndSleeves))
	})
})

describe("folding", () => {
	const sewn = addSeam(
		base,
		{ panelId: "front", vertexId: "front-tr" },
		{ panelId: "back", vertexId: "back-bl" },
	)

	const folded: Draft = {
		...sewn,
		seams: sewn.seams.map((seam) => ({ ...seam, lie: "fold" as const })),
	}

	const creased: Draft = {
		...base,
		panels: base.panels.map((panel) =>
			panel.id === "front"
				? {
						...panel,
						creases: [
							{
								id: "yama",
								name: "袖山",
								a: { vertexId: "front-tr", at: 35 },
								b: { vertexId: "front-bl", at: 35 },
							},
						],
					}
				: panel,
		),
	}

	it("brings_the_joined_piece_on_top_when_the_seam_folds", () => {
		const front = placedPoint(folded, "front", "front-tl", 0)
		const back = placedPoint(folded, "back", "back-tr", 0)

		expect(Math.abs(back.x - front.x)).toBeLessThan(0.001)
	})

	it("spreads_the_same_garment_flat_when_asked_to_open_it", () => {
		const assembled = assemble(folded, { opened: true })
		const back = assembled.placements.find((entry) => entry.panelId === "back")

		expect(back?.matrix.e).not.toBeCloseTo(0, 3)
	})

	it("splits_a_piece_folded_along_its_own_袖山_into_two_halves", () => {
		const halves = assemble(creased).placements.filter((entry) => entry.panelId === "front")

		expect(halves).toHaveLength(2)
		expect(halves[0]?.flipped).toBe(false)
		expect(halves[1]?.flipped).toBe(true)
	})

	it("lands_the_far_half_of_a_fold_on_top_of_the_near_one", () => {
		const halves = assemble(creased).placements.filter((entry) => entry.panelId === "front")
		const far = halves[1]

		if (far === undefined) throw new Error("far half missing")

		// Folding at y = 35 mirrors the piece about that line, which sends y to 70 − y.
		expect(far.matrix.d).toBeCloseTo(-1, 6)
		expect(far.matrix.f).toBeCloseTo(70, 6)
	})

	it("shows_the_whole_piece_again_once_the_fold_is_opened_out", () => {
		const halves = assemble(creased, { opened: true }).placements.filter(
			(entry) => entry.panelId === "front",
		)

		expect(halves).toHaveLength(1)
		expect(halves[0]?.crease).toBeUndefined()
	})
})
