import { describe, expect, it } from "vitest"
import { edgeGaps, edgeLength, openings } from "./assembly"
import type { Document, Panel, Seam } from "./document"

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

function documentWith(seams: readonly Seam[]): Document {
	return {
		id: "test",
		name: "test",
		panels: [rectangle("front", 30, 70), rectangle("back", 30, 70)],
		seams,
		stitches: [],
		annotations: [],
		body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
	}
}

const frontSide = { panelId: "front", vertexId: "front-tr" }
const backSide = { panelId: "back", vertexId: "back-tr" }

describe("edgeLength", () => {
	it("measures_the_run_leaving_the_named_vertex", () => {
		expect(edgeLength(documentWith([]), frontSide)).toBeCloseTo(70, 6)
		expect(edgeLength(documentWith([]), { panelId: "front", vertexId: "front-tl" })).toBeCloseTo(
			30,
			6,
		)
	})
})

describe("edgeGaps", () => {
	it("an_unsewn_edge_is_one_long_gap", () => {
		expect(edgeGaps(documentWith([]), frontSide)).toEqual([{ from: 0, to: 70 }])
	})

	it("a_seam_covering_the_whole_edge_leaves_nothing", () => {
		const document = documentWith([
			{
				id: "side",
				name: "脇縫い",
				a: { edge: frontSide, from: 0, to: 70 },
				b: { edge: backSide, from: 0, to: 70 },
			},
		])

		expect(edgeGaps(document, frontSide)).toEqual([])
	})

	it("a_seam_that_stops_short_leaves_the_rest_open", () => {
		const document = documentWith([
			{
				id: "side",
				name: "脇縫い",
				a: { edge: frontSide, from: 0, to: 52 },
				b: { edge: backSide, from: 0, to: 52 },
			},
		])

		expect(edgeGaps(document, frontSide)).toEqual([{ from: 52, to: 70 }])
	})

	it("a_seam_starting_late_opens_the_top_as_well", () => {
		const document = documentWith([
			{
				id: "side",
				name: "脇縫い",
				a: { edge: frontSide, from: 13, to: 52 },
				b: { edge: backSide, from: 13, to: 52 },
			},
		])

		expect(edgeGaps(document, frontSide)).toEqual([
			{ from: 0, to: 13 },
			{ from: 52, to: 70 },
		])
	})

	it("overlapping_seams_merge_rather_than_double_count", () => {
		const document = documentWith([
			{
				id: "one",
				name: "a",
				a: { edge: frontSide, from: 0, to: 40 },
				b: { edge: backSide, from: 0, to: 40 },
			},
			{
				id: "two",
				name: "b",
				a: { edge: frontSide, from: 30, to: 70 },
				b: { edge: backSide, from: 30, to: 70 },
			},
		])

		expect(edgeGaps(document, frontSide)).toEqual([])
	})
})

describe("openings", () => {
	it("carries_the_name_a_template_put_on_the_gap", () => {
		const base = documentWith([
			{
				id: "side",
				name: "脇縫い",
				a: { edge: frontSide, from: 13, to: 52 },
				b: { edge: backSide, from: 13, to: 52 },
			},
		])

		const document: Document = {
			...base,
			annotations: [
				{ id: "a1", name: "身八つ口", run: { edge: frontSide, from: 0, to: 13 } },
				{ id: "a2", name: "脇あき", run: { edge: frontSide, from: 52, to: 70 } },
			],
		}

		const named = openings(document)
			.filter((entry) => entry.edge.panelId === "front" && entry.name !== "")
			.map((entry) => entry.name)

		expect(named).toEqual(["身八つ口", "脇あき"])
	})
})
