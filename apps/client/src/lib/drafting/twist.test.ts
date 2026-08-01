import { describe, expect, it } from "vitest"
import { flipSeam } from "./assemble"
import { checkDraft } from "./check"
import { jinbeiTop } from "./templates/jinbei"

describe("twist check", () => {
	it("finds_nothing_wrong_with_a_garment_that_is_sewn_omote_out_everywhere", () => {
		const rows = checkDraft(jinbeiTop()).filter((entry) => entry.id.startsWith("twist-"))

		expect(rows).toEqual([])
	})

	it("catches_a_袖付け_whose_ends_meet_the_wrong_way_round", () => {
		const twisted = flipSeam(jinbeiTop(), "sodetsuke-ushiro-右")
		const rows = checkDraft(twisted).filter((entry) => entry.id.startsWith("twist-"))

		expect(rows.length).toBeGreaterThan(0)
		expect(rows[0]?.severity).toBe("error")
		expect(rows[0]?.detail).toContain("向きを反転")
	})

	it("lets_a_bridge_seam_flip_because_the_whole_half_turns_over_with_it", () => {
		// 背中心 is the only seam joining the two halves, so flipping it flips every
		// left piece together and every parity still agrees: sewable, just cut with
		// the template the other way up. A twist needs a cycle to be trapped in.
		const twisted = flipSeam(jinbeiTop(), "se-chushin")
		const rows = checkDraft(twisted).filter((entry) => entry.id.startsWith("twist-"))

		expect(rows).toEqual([])
	})

	it("catches_a_袖下_that_would_roll_the_sleeve_into_a_möbius_band", () => {
		const twisted = flipSeam(jinbeiTop(), "sodeshita-右")
		const rows = checkDraft(twisted).filter((entry) => entry.id.startsWith("twist-"))

		expect(rows.map((entry) => entry.target.seamId)).toContain("sodeshita-右")
	})
})
