import { describe, expect, it } from "vitest"
import { jinbeiTop } from "@/lib/drafting/templates/jinbei"
import { buildAvatar } from "./avatar"
import { buildClothMesh } from "./mesh"
import { stateOf, step } from "./solver"

describe("cloth settling", () => {
	it("drapes_the_甚平_over_the_body_without_blowing_up", { timeout: 30_000 }, () => {
		const draft = jinbeiTop()
		const mesh = buildClothMesh(draft, 170 * 0.82)
		const state = stateOf(mesh)
		const capsules = buildAvatar(draft.body)

		for (let frame = 0; frame < 300; frame += 1) {
			step(mesh, state, capsules, 1 / 60, frame / 60)
		}

		let seamGap = 0

		for (let index = 0; index < state.positions.length; index += 1) {
			expect(Number.isFinite(state.positions[index])).toBe(true)
		}

		for (const seam of mesh.seams) {
			const dx = (state.positions[seam.a * 3] ?? 0) - (state.positions[seam.b * 3] ?? 0)
			const dy = (state.positions[seam.a * 3 + 1] ?? 0) - (state.positions[seam.b * 3 + 1] ?? 0)
			const dz = (state.positions[seam.a * 3 + 2] ?? 0) - (state.positions[seam.b * 3 + 2] ?? 0)

			seamGap = Math.max(seamGap, Math.hypot(dx, dy, dz))
		}

		// Settled seams sit within a couple of centimetres; metres apart means the
		// garment never closed and centimetres of thousands means it exploded.
		expect(seamGap).toBeLessThan(8)

		let top = Number.NEGATIVE_INFINITY
		let bottom = Number.POSITIVE_INFINITY

		for (let index = 0; index < state.positions.length / 3; index += 1) {
			const y = state.positions[index * 3 + 1] ?? 0

			top = Math.max(top, y)
			bottom = Math.min(bottom, y)
		}

		// The garment should hang around the torso: top near the shoulders, hem
		// well above the floor rather than pooled on it.
		expect(top).toBeGreaterThan(120)
		expect(top).toBeLessThan(180)
		expect(bottom).toBeGreaterThan(20)
	})
})
