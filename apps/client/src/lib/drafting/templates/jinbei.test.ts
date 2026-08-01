import { describe, expect, it } from "vitest"
import { checkDraft } from "../check"
import { cuttingLayout } from "../cutting"
import { assemble } from "../layout"
import { jinbeiTop } from "./jinbei"

describe("甚平（上）M", () => {
	it("has_nothing_wrong_with_it_as_it_ships", () => {
		const wrong = checkDraft(jinbeiTop()).filter((entry) => entry.severity !== "info")

		expect(wrong).toEqual([])
	})

	it("has_every_piece_sewn_to_the_garment", () => {
		expect(assemble(jinbeiTop()).loose).toEqual([])
	})

	it("sizes_the_collar_off_the_neckline_it_has_to_cover", () => {
		const draft = jinbeiTop()
		const collar = draft.panels.find((panel) => panel.id === "eri-migi")
		const covered = draft.seams
			.filter((seam) => seam.a.edge.panelId === "eri-migi")
			.reduce((total, seam) => total + Math.abs(seam.a.to - seam.a.from), 0)

		const length = Math.max(...(collar?.vertices ?? []).map((vertex) => vertex.y))

		expect(covered).toBeCloseTo(length, 6)
	})

	it("folds_the_sleeve_at_袖山_so_it_lies_at_half_its_cut_width", () => {
		const halves = assemble(jinbeiTop()).placements.filter((entry) => entry.panelId === "sode-migi")

		expect(halves).toHaveLength(2)
	})

	it("fits_on_広幅_cloth_with_a_length_worth_buying", () => {
		const layout = cuttingLayout(jinbeiTop())

		expect(layout.tooWide).toEqual([])
		expect(layout.length).toBeLessThan(300)
	})
})
