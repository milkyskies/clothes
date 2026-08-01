import { describe, expect, it } from "vitest"
import { jinbeiTop } from "@/lib/drafting/templates/jinbei"
import { buildClothMesh } from "./mesh"

describe("buildClothMesh", () => {
	const mesh = buildClothMesh(jinbeiTop(), 140)

	it("meshes_every_attached_piece_at_a_workable_particle_count", () => {
		const count = mesh.positions.length / 3

		expect(mesh.panelIds.length).toBe(jinbeiTop().panels.length)
		expect(count).toBeGreaterThan(500)
		expect(count).toBeLessThan(6000)
	})

	it("keeps_every_rest_length_near_the_particle_spacing", () => {
		for (const edge of mesh.edges) {
			expect(edge.rest).toBeGreaterThan(0.3)
			expect(edge.rest).toBeLessThan(9)
		}
	})

	it("pairs_seam_particles_that_start_within_reach_of_each_other", () => {
		expect(mesh.seams.length).toBeGreaterThan(50)

		let far = 0

		for (const seam of mesh.seams) {
			const dx = (mesh.positions[seam.a * 3] ?? 0) - (mesh.positions[seam.b * 3] ?? 0)
			const dy = (mesh.positions[seam.a * 3 + 1] ?? 0) - (mesh.positions[seam.b * 3 + 1] ?? 0)
			const dz = (mesh.positions[seam.a * 3 + 2] ?? 0) - (mesh.positions[seam.b * 3 + 2] ?? 0)

			if (Math.hypot(dx, dy, dz) > 160) far += 1
		}

		// A sewn pair starts on opposite faces of the body at worst, and the tips
		// of a pair of 紐 dangle from opposite sides before their knot pulls them
		// in; anything further than that points at a pairing bug.
		expect(far).toBe(0)
	})

	it("splits_front_and_back_layers_across_the_body", () => {
		const zs = new Set<number>()

		for (let index = 0; index < mesh.positions.length / 3; index += 1) {
			zs.add(Math.sign(mesh.positions[index * 3 + 2] ?? 0))
		}

		expect(zs.has(1)).toBe(true)
		expect(zs.has(-1)).toBe(true)
	})
})

describe("fastenings", () => {
	it("ties_the_himo_pairs_the_way_the_garment_is_worn", () => {
		const untied = { ...jinbeiTop(), fastenings: [] }
		const tied = jinbeiTop()

		const meshUntied = buildClothMesh(untied, 140)
		const meshTied = buildClothMesh(tied, 140)

		expect(meshTied.seams.length).toBeGreaterThan(meshUntied.seams.length)
	})
})
