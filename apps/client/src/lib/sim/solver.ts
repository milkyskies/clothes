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
/** How close two unrelated bits of cloth may come before they push apart. */
const CLOTH_RADIUS = 1.6
const HASH_SIZE = 4096

export interface Capsule {
	readonly ax: number
	readonly ay: number
	readonly az: number
	readonly bx: number
	readonly by: number
	readonly bz: number
	readonly radius: number
}

export interface Grab {
	readonly index: number
	readonly x: number
	readonly y: number
	readonly z: number
}

export interface ClothState {
	readonly positions: Float32Array
	readonly previous: Float32Array
	/**
	 * Pairs self-collision must ignore, packed as a·n+b with a<b: mesh
	 * neighbours, sewn pairs, and everything one ring around a sewn pair —
	 * repulsion there would fight the seam that is meant to hold them together.
	 */
	readonly excluded: Set<number>
	readonly cellHead: Int32Array
	readonly cellNext: Int32Array
}

export function stateOf(mesh: ClothMesh): ClothState {
	const count = mesh.positions.length / 3
	const excluded = new Set<number>()
	const neighbours = new Map<number, number[]>()

	const exclude = (a: number, b: number) => {
		if (a === b) return

		excluded.add(Math.min(a, b) * count + Math.max(a, b))
	}

	for (const edge of mesh.edges) {
		exclude(edge.a, edge.b)

		const heldA = neighbours.get(edge.a) ?? []
		const heldB = neighbours.get(edge.b) ?? []

		heldA.push(edge.b)
		heldB.push(edge.a)
		neighbours.set(edge.a, heldA)
		neighbours.set(edge.b, heldB)
	}

	for (const bend of mesh.bends) exclude(bend.a, bend.b)

	for (const seam of mesh.seams) {
		exclude(seam.a, seam.b)

		for (const near of neighbours.get(seam.a) ?? []) exclude(near, seam.b)
		for (const near of neighbours.get(seam.b) ?? []) exclude(near, seam.a)
	}

	return {
		positions: new Float32Array(mesh.positions),
		previous: new Float32Array(mesh.positions),
		excluded,
		cellHead: new Int32Array(HASH_SIZE),
		cellNext: new Int32Array(count),
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

function cellOf(x: number, y: number, z: number): number {
	const ix = Math.floor(x / CLOTH_RADIUS)
	const iy = Math.floor(y / CLOTH_RADIUS)
	const iz = Math.floor(z / CLOTH_RADIUS)

	// Large primes scatter neighbouring cells across the table; the unsigned
	// shift keeps the index inside the array for negative coordinates.
	return (((ix * 92837111) ^ (iy * 689287499) ^ (iz * 283923481)) >>> 0) % HASH_SIZE
}

/**
 * Keeps cloth from passing through cloth.
 *
 * Every particle goes into a coarse spatial hash, then any two strangers that
 * end up closer than a cloth thickness push apart. Neighbours along the weave
 * and sewn partners are exempt, or the repulsion would fight the seams.
 */
function selfCollide(state: ClothState) {
	const { positions, excluded, cellHead, cellNext } = state
	const count = positions.length / 3

	cellHead.fill(-1)

	for (let index = 0; index < count; index += 1) {
		const cell = cellOf(
			positions[index * 3] ?? 0,
			positions[index * 3 + 1] ?? 0,
			positions[index * 3 + 2] ?? 0,
		)

		cellNext[index] = cellHead[cell] ?? -1
		cellHead[cell] = index
	}

	for (let index = 0; index < count; index += 1) {
		const px = positions[index * 3] ?? 0
		const py = positions[index * 3 + 1] ?? 0
		const pz = positions[index * 3 + 2] ?? 0

		for (let ox = -1; ox <= 1; ox += 1) {
			for (let oy = -1; oy <= 1; oy += 1) {
				for (let oz = -1; oz <= 1; oz += 1) {
					const cell = cellOf(
						px + ox * CLOTH_RADIUS,
						py + oy * CLOTH_RADIUS,
						pz + oz * CLOTH_RADIUS,
					)

					for (let other = cellHead[cell] ?? -1; other !== -1; other = cellNext[other] ?? -1) {
						if (other <= index) continue
						if (excluded.has(index * count + other)) continue

						const dx = (positions[other * 3] ?? 0) - px
						const dy = (positions[other * 3 + 1] ?? 0) - py
						const dz = (positions[other * 3 + 2] ?? 0) - pz
						const squared = dx * dx + dy * dy + dz * dz

						if (squared >= CLOTH_RADIUS * CLOTH_RADIUS || squared < 1e-9) continue

						const distance = Math.sqrt(squared)
						const push = ((CLOTH_RADIUS - distance) / distance) * 0.5

						positions[index * 3] = px - dx * push
						positions[index * 3 + 1] = py - dy * push
						positions[index * 3 + 2] = pz - dz * push
						positions[other * 3] = (positions[other * 3] ?? 0) + dx * push
						positions[other * 3 + 1] = (positions[other * 3 + 1] ?? 0) + dy * push
						positions[other * 3 + 2] = (positions[other * 3 + 2] ?? 0) + dz * push
					}
				}
			}
		}
	}
}

/**
 * Advances the cloth one frame.
 *
 * Seams close first and gravity waits its turn: zipping the garment shut
 * around the body while it is weightless, then letting it drop the last
 * centimetres onto the shoulders, is what tailors do with pins.
 */
export function step(
	mesh: ClothMesh,
	state: ClothState,
	capsules: readonly Capsule[],
	dt: number,
	settle: number,
	grab?: Grab,
) {
	const h = dt / SUBSTEPS
	const { positions, previous } = state
	const count = positions.length / 3
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

		// Cloth barely moves inside one substep, so colliding on every third one
		// buys back most of the cost without letting anything tunnel.
		if (sub % 3 === 0) selfCollide(state)

		for (let index = 0; index < count; index += 1) {
			for (const capsule of capsules) {
				pushOutOfCapsule(positions, index, capsule)
			}
		}

		if (grab !== undefined) {
			positions[grab.index * 3] = grab.x
			positions[grab.index * 3 + 1] = grab.y
			positions[grab.index * 3 + 2] = grab.z
			previous[grab.index * 3] = grab.x
			previous[grab.index * 3 + 1] = grab.y
			previous[grab.index * 3 + 2] = grab.z
		}
	}
}
