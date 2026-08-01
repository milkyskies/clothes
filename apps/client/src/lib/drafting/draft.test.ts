import { describe, expect, it } from "vitest"
import { draft } from "./draft"
import { edgesLength } from "./geometry/measure"
import type { Design, Fabric, Measurements } from "./model"
import { collarCutWidth, collarLength, kakeeriShirt } from "./templates/kakeeri-shirt"

const measurements: Measurements = kakeeriShirt.defaults.measurements
const design: Design = kakeeriShirt.defaults.design

const yuwaMenAsa: Fabric = {
	name: "YUWA 綿麻無地",
	width: 140,
	shrinkage: 4,
	pricePerMetre: 1880,
	frayProne: true,
	weight: "medium",
}

function withDesign(overrides: Partial<Design>): Design {
	return { ...design, ...overrides }
}

describe("collar band", () => {
	it("cut_width_finishes_at_the_width_the_design_asked_for", () => {
		const finished = collarCutWidth(design) / 2 - 1

		expect(finished).toBeCloseTo(design.collarWidth, 10)
	})

	it("cut_width_tracks_the_control_rather_than_staying_fixed", () => {
		expect(collarCutWidth(withDesign({ collarWidth: 8 })) / 2 - 1).toBeCloseTo(8, 10)
	})

	it("length_matches_the_front_edge_it_is_sewn_to", () => {
		const panels = kakeeriShirt.panels(measurements, design)
		const front = panels.find((panel) => panel.id === "front")
		const back = panels.find((panel) => panel.id === "back")

		if (front === undefined || back === undefined) throw new Error("panels missing")

		const frontRun = edgesLength(front.outline, ["cf-vertical", "kenzaki", "cf-diagonal"])
		const backNeckRun = edgesLength(back.outline, ["neck"]) * 2

		expect(collarLength(measurements, design)).toBeCloseTo(frontRun * 2 + backNeckRun + 5, 6)
	})

	it("length_grows_when_the_kenzaki_is_raised", () => {
		const shallow = collarLength(measurements, withDesign({ kenzakiDepth: 12 }))
		const deep = collarLength(measurements, withDesign({ kenzakiDepth: 25 }))

		expect(deep).toBeLessThan(shallow)
	})
})

describe("seam matching", () => {
	it("sleeve_head_equals_the_armhole_at_every_ease_setting", () => {
		for (const ease of [0, 8, 14, 22, 30]) {
			const result = draft(kakeeriShirt, measurements, withDesign({ ease }), yuwaMenAsa)
			const mismatch = result.issues.filter((issue) => issue.id === "armhole-sleeve-mismatch")

			expect(mismatch).toEqual([])
		}
	})
})

describe("seam allowance", () => {
	it("hem_allowance_follows_the_finish_chosen", () => {
		const mitsuori = draft(
			kakeeriShirt,
			measurements,
			withDesign({ hemFinish: "mitsuori" }),
			yuwaMenAsa,
		)
		const zigzag = draft(
			kakeeriShirt,
			measurements,
			withDesign({ hemFinish: "zigzag" }),
			yuwaMenAsa,
		)

		const mitsuoriBack = mitsuori.cutSizes.find((size) => size.name === "後ろ身頃")
		const zigzagBack = zigzag.cutSizes.find((size) => size.name === "後ろ身頃")

		if (mitsuoriBack === undefined || zigzagBack === undefined) throw new Error("panel missing")

		expect(mitsuoriBack.height - zigzagBack.height).toBeCloseTo(1.5, 6)
	})

	it("fray_prone_fabric_warns_against_zigzag", () => {
		const result = draft(
			kakeeriShirt,
			measurements,
			withDesign({ hemFinish: "zigzag" }),
			yuwaMenAsa,
		)

		expect(result.issues.map((issue) => issue.id)).toContain("fray-needs-stronger-finish")
	})
})

describe("layout", () => {
	it("reports_a_fabric_length_that_includes_shrinkage", () => {
		const result = draft(kakeeriShirt, measurements, design, yuwaMenAsa)

		expect(result.fabricNeeded).toBeCloseTo(result.layout.usedLength * 1.04, 6)
		expect(result.fabricNeeded).toBeGreaterThan(0)
	})

	it("flags_a_piece_that_will_not_fit_the_bolt_width", () => {
		const narrow: Fabric = { ...yuwaMenAsa, width: 40 }
		const result = draft(kakeeriShirt, measurements, design, narrow)

		expect(result.issues.some((issue) => issue.issueClass === "生地")).toBe(true)
	})

	it("every_piece_is_placed_when_the_bolt_is_wide_enough", () => {
		const result = draft(kakeeriShirt, measurements, design, yuwaMenAsa)
		const expected = result.panels.reduce((total, panel) => total + panel.quantity, 0)

		expect(result.layout.placements.length).toBe(expected)
		expect(result.layout.overWidth).toEqual([])
	})
})

describe("materials", () => {
	it("lace_thread_appears_only_when_kagari_is_on", () => {
		const on = draft(kakeeriShirt, measurements, withDesign({ kagari: true }), yuwaMenAsa)
		const off = draft(kakeeriShirt, measurements, withDesign({ kagari: false }), yuwaMenAsa)

		expect(on.materials.map((item) => item.id)).toContain("lace-thread")
		expect(off.materials.map((item) => item.id)).not.toContain("lace-thread")
	})

	it("button_size_scales_with_the_collar_width", () => {
		const narrow = draft(kakeeriShirt, measurements, withDesign({ collarWidth: 4 }), yuwaMenAsa)
		const wide = draft(kakeeriShirt, measurements, withDesign({ collarWidth: 8 }), yuwaMenAsa)

		const narrowButton = narrow.materials.find((item) => item.id === "buttons")
		const wideButton = wide.materials.find((item) => item.id === "buttons")

		expect(narrowButton?.note).toContain("11mm")
		expect(wideButton?.note).toContain("22mm")
	})
})

describe("sewing steps", () => {
	it("vent_steps_disappear_when_the_vents_are_closed", () => {
		const open = draft(kakeeriShirt, measurements, design, yuwaMenAsa)
		const closed = draft(
			kakeeriShirt,
			measurements,
			withDesign({ sideVent: 0, sleeveOpening: 0, kagari: false }),
			yuwaMenAsa,
		)

		expect(open.steps.map((step) => step.id)).toContain("wakiaki")
		expect(closed.steps.map((step) => step.id)).not.toContain("wakiaki")
		expect(closed.steps.map((step) => step.id)).not.toContain("kagari")
	})

	it("hem_step_names_the_finish_that_was_chosen", () => {
		const result = draft(
			kakeeriShirt,
			measurements,
			withDesign({ hemFinish: "fukuronui" }),
			yuwaMenAsa,
		)
		const hemStep = result.steps.find((step) => step.id === "suso")

		expect(hemStep?.detail).toContain("袋縫い")
	})
})

describe("wearability", () => {
	it("rejects_a_kenzaki_deeper_than_half_the_body_length", () => {
		const result = draft(kakeeriShirt, measurements, withDesign({ kenzakiDepth: 40 }), yuwaMenAsa)

		expect(result.issues.map((issue) => issue.id)).toContain("kenzaki-too-deep")
	})

	it("default_design_produces_no_errors", () => {
		const result = draft(kakeeriShirt, measurements, design, yuwaMenAsa)

		expect(result.issues.filter((issue) => issue.level === "error")).toEqual([])
	})
})
