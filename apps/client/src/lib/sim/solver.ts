import type { ClothMesh } from "./mesh"

/**
 * Small-steps XPBD: many tiny substeps with one constraint pass each settle
 * stiff cloth far better than one big step iterated, for the same cost.
 */
const SUBSTEPS = 15
const GRAVITY = -981
const DAMPING = 0.985
/** Cloth keeps the garment slightly away from the skin, like real ease. */
const CLEARANCE = 1

export interface Capsule {
	readonly ax: number
	readonly ay: number
	readonly az: number
	readonly bx: number
	readonly by: number
	readonly bz: number
	readonly radius: number
}

export interface ClothState {
	readonly positions: Float32Array
	readonly previous: Float32Array
}

export function stateOf(mesh: ClothMesh): ClothState {
	return {
		positions: new Float32Array(mesh.positions),
		previous: new Float32Array(mesh.positions),
	}
}

function projectPair(
	positions: Float32Array,
	a: number,
	b: number,
	rest: number,
	strength: number,
) {
	const ax = positions[a * 3] ?? 0
	const ay = positions[a * 3 + 1] ?? 0
	const az = positions[a * 3 + 2] ?? 0
	const bx = positions[b * 3] ?? 0
	const by = positions[b * 3 + 1] ?? 0
	const bz = positions[b * 3 + 2] ?? 0

	const dx = bx - ax
	const dy = by - ay
	const dz = bz - az
	const length = Math.sqrt(dx * dx + dy * dy + dz * dz)

	if (length < 1e-6) return

	const move = ((length - rest) / length) * 0.5 * strength

	positions[a * 3] = ax + dx * move
	positions[a * 3 + 1] = ay + dy * move
	positions[a * 3 + 2] = az + dz * move
	positions[b * 3] = bx - dx * move
	positions[b * 3 + 1] = by - dy * move
	positions[b * 3 + 2] = bz - dz * move
}

function pushOutOfCapsule(positions: Float32Array, index: number, capsule: Capsule) {
	const px = positions[index * 3] ?? 0
	const py = positions[index * 3 + 1] ?? 0
	const pz = positions[index * 3 + 2] ?? 0

	const abx = capsule.bx - capsule.ax
	const aby = capsule.by - capsule.ay
	const abz = capsule.bz - capsule.az
	const apx = px - capsule.ax
	const apy = py - capsule.ay
	const apz = pz - capsule.az

	const squared = abx * abx + aby * aby + abz * abz
	const t =
		squared < 1e-9 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / squared))

	const cx = capsule.ax + abx * t
	const cy = capsule.ay + aby * t
	const cz = capsule.az + abz * t

	const dx = px - cx
	const dy = py - cy
	const dz = pz - cz
	const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
	const wanted = capsule.radius + CLEARANCE

	if (distance >= wanted || distance < 1e-6) return

	const push = (wanted - distance) / distance

	positions[index * 3] = px + dx * push
	positions[index * 3 + 1] = py + dy * push
	positions[index * 3 + 2] = pz + dz * push
}

/**
 * Advances the cloth one frame.
 *
 * Seam constraints ramp in over the first moments so pieces that start apart
 * are drawn together instead of snapped, which is the difference between the
 * garment closing around the body and the garment exploding.
 */
export function step(
	mesh: ClothMesh,
	state: ClothState,
	capsules: readonly Capsule[],
	dt: number,
	settle: number,
) {
	const h = dt / SUBSTEPS
	const { positions, previous } = state
	const count = positions.length / 3

	// Seams close first and gravity waits its turn: zipping the garment shut
	// around the body while it is weightless, then letting it drop the last
	// centimetres onto the shoulders, is what tailors do with pins.
	const seamStrength = Math.min(1, 0.3 + settle) * 0.9
	const gravity = GRAVITY * Math.max(0, Math.min(1, settle - 0.7))

	for (let sub = 0; sub < SUBSTEPS; sub += 1) {
		for (let index = 0; index < count; index += 1) {
			const x = positions[index * 3] ?? 0
			const y = positions[index * 3 + 1] ?? 0
			const z = positions[index * 3 + 2] ?? 0
			const vx = (x - (previous[index * 3] ?? x)) * DAMPING
			const vy = (y - (previous[index * 3 + 1] ?? y)) * DAMPING
			const vz = (z - (previous[index * 3 + 2] ?? z)) * DAMPING

			previous[index * 3] = x
			previous[index * 3 + 1] = y
			previous[index * 3 + 2] = z

			positions[index * 3] = x + vx
			positions[index * 3 + 1] = y + vy + gravity * h * h
			positions[index * 3 + 2] = z + vz
		}

		for (const edge of mesh.edges) {
			projectPair(positions, edge.a, edge.b, edge.rest, 1)
		}

		for (const bend of mesh.bends) {
			projectPair(positions, bend.a, bend.b, bend.rest, 0.05)
		}

		for (const seam of mesh.seams) {
			projectPair(positions, seam.a, seam.b, 0, seamStrength)
		}

		for (let index = 0; index < count; index += 1) {
			for (const capsule of capsules) {
				pushOutOfCapsule(positions, index, capsule)
			}
		}
	}
}
