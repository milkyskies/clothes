import type { ClothMesh } from "./mesh"

/**
 * Small-steps XPBD: many tiny substeps with one constraint pass each settle
 * stiff cloth far better than one big step iterated, for the same cost.
 */
const SUBSTEPS = 15
const GRAVITY = -981
/**
 * The material has two phases, because dressing and wearing want opposite
 * things. While the garment is being zipped and dropped it is kept soft and
 * heavily damped — the stiff version transmits the asymmetric collar and tie
 * pulls garment-wide and the whole thing slides off a shoulder. Once it hangs,
 * it stiffens into woven cotton: extra stretch passes, real bending body,
 * grip against the skin, and lighter air so it swings like cloth.
 */
const DRESSED_AT = 3
const DAMPING_DRESSING = 0.985
const DAMPING_WORN = 0.995
const BEND_DRESSING = 0.05
const BEND_WORN = 0.16
const FRICTION_WORN = 0.35
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
	/**
	 * The same constraints the mesh carries, flattened into typed arrays. The
	 * solver walks these tens of thousands of times a second, and plain object
	 * property loads are what the first profile showed it drowning in.
	 */
	readonly edgePairs: Int32Array
	readonly edgeRests: Float32Array
	readonly bendPairs: Int32Array
	readonly bendRests: Float32Array
	readonly seamPairs: Int32Array
	readonly tiePairs: Int32Array
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

	// A piece stitched onto a face lies on that face by design; the stitch and
	// the cloth thickness resolve their contact, and repulsion would blow the
	// pair apart instead.
	for (const pair of mesh.stacked) {
		const first = mesh.panelIds.indexOf(pair.a)
		const second = mesh.panelIds.indexOf(pair.b)

		if (first < 0 || second < 0) continue

		for (let a = 0; a < count; a += 1) {
			if (mesh.panelOf[a] !== first) continue

			for (let b = 0; b < count; b += 1) {
				if (mesh.panelOf[b] === second) exclude(a, b)
			}
		}
	}

	for (const joined of [mesh.seams, mesh.ties]) {
		for (const seam of joined) {
			exclude(seam.a, seam.b)

			for (const near of neighbours.get(seam.a) ?? []) exclude(near, seam.b)
			for (const near of neighbours.get(seam.b) ?? []) exclude(near, seam.a)
		}
	}

	const edgePairs = new Int32Array(mesh.edges.length * 2)
	const edgeRests = new Float32Array(mesh.edges.length)
	const bendPairs = new Int32Array(mesh.bends.length * 2)
	const bendRests = new Float32Array(mesh.bends.length)
	const seamPairs = new Int32Array(mesh.seams.length * 2)
	const tiePairs = new Int32Array(mesh.ties.length * 2)

	mesh.edges.forEach((edge, index) => {
		edgePairs[index * 2] = edge.a
		edgePairs[index * 2 + 1] = edge.b
		edgeRests[index] = edge.rest
	})
	mesh.bends.forEach((bend, index) => {
		bendPairs[index * 2] = bend.a
		bendPairs[index * 2 + 1] = bend.b
		bendRests[index] = bend.rest
	})
	mesh.seams.forEach((seam, index) => {
		seamPairs[index * 2] = seam.a
		seamPairs[index * 2 + 1] = seam.b
	})
	mesh.ties.forEach((tie, index) => {
		tiePairs[index * 2] = tie.a
		tiePairs[index * 2 + 1] = tie.b
	})

	return {
		positions: new Float32Array(mesh.positions),
		previous: new Float32Array(mesh.positions),
		excluded,
		cellHead: new Int32Array(HASH_SIZE),
		cellNext: new Int32Array(count),
		tiePairs,
		edgePairs,
		edgeRests,
		bendPairs,
		bendRests,
		seamPairs,
	}
}

/** One Gauss-Seidel sweep over a flattened pair list. */
function projectPairs(
	positions: Float32Array,
	pairs: Int32Array,
	rests: Float32Array | undefined,
	strength: number,
) {
	const total = pairs.length / 2

	for (let index = 0; index < total; index += 1) {
		const a = (pairs[index * 2] ?? 0) * 3
		const b = (pairs[index * 2 + 1] ?? 0) * 3
		const rest = rests === undefined ? 0 : (rests[index] ?? 0)

		const ax = positions[a] ?? 0
		const ay = positions[a + 1] ?? 0
		const az = positions[a + 2] ?? 0
		const bx = positions[b] ?? 0
		const by = positions[b + 1] ?? 0
		const bz = positions[b + 2] ?? 0

		const dx = bx - ax
		const dy = by - ay
		const dz = bz - az
		const length = Math.sqrt(dx * dx + dy * dy + dz * dz)

		if (length < 1e-6) continue

		const move = ((length - rest) / length) * 0.5 * strength

		positions[a] = ax + dx * move
		positions[a + 1] = ay + dy * move
		positions[a + 2] = az + dz * move
		positions[b] = bx - dx * move
		positions[b + 1] = by - dy * move
		positions[b + 2] = bz - dz * move
	}
}

function pushOutOfCapsule(
	positions: Float32Array,
	previous: Float32Array,
	index: number,
	capsule: Capsule,
	friction: number,
) {
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
	const wanted = capsule.radius + CLEARANCE
	const squaredDistance = dx * dx + dy * dy + dz * dz

	// Nearly every particle is clear of every capsule, so the square-root only
	// runs for the handful actually touching.
	if (squaredDistance >= wanted * wanted || squaredDistance < 1e-9) return

	const distance = Math.sqrt(squaredDistance)

	const push = (wanted - distance) / distance

	positions[index * 3] = px + dx * push
	positions[index * 3 + 1] = py + dy * push
	positions[index * 3 + 2] = pz + dz * push

	// Contact rubs off speed: dragging the trail point toward the present is
	// friction under a Verlet integrator, and it is what lets cloth sit on a
	// shoulder instead of skating off it.
	previous[index * 3] =
		(previous[index * 3] ?? 0) +
		((positions[index * 3] ?? 0) - (previous[index * 3] ?? 0)) * friction
	previous[index * 3 + 1] =
		(previous[index * 3 + 1] ?? 0) +
		((positions[index * 3 + 1] ?? 0) - (previous[index * 3 + 1] ?? 0)) * friction
	previous[index * 3 + 2] =
		(previous[index * 3 + 2] ?? 0) +
		((positions[index * 3 + 2] ?? 0) - (previous[index * 3 + 2] ?? 0)) * friction
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
	// A box test decides whether the segment projection is worth doing at all;
	// most particle-capsule pairs fail it.
	const boxes = capsules.map((capsule) => {
		const reach = capsule.radius + CLEARANCE

		return {
			minX: Math.min(capsule.ax, capsule.bx) - reach,
			maxX: Math.max(capsule.ax, capsule.bx) + reach,
			minY: Math.min(capsule.ay, capsule.by) - reach,
			maxY: Math.max(capsule.ay, capsule.by) + reach,
			minZ: Math.min(capsule.az, capsule.bz) - reach,
			maxZ: Math.max(capsule.az, capsule.bz) + reach,
		}
	})
	const h = dt / SUBSTEPS
	const { positions, previous } = state
	const count = positions.length / 3
	const seamStrength = Math.min(1, 0.3 + settle) * 0.9
	const gravity = GRAVITY * Math.max(0, Math.min(1, settle - 0.7))

	// Knots are tied once the garment hangs, gently: a person dresses, then
	// reaches for the 紐.
	const tieStrength = Math.max(0, Math.min(1, (settle - 1.8) / 1.5)) * 0.35

	const worn = Math.max(0, Math.min(1, settle - DRESSED_AT))
	const damping = DAMPING_DRESSING + (DAMPING_WORN - DAMPING_DRESSING) * worn
	const bend = BEND_DRESSING + (BEND_WORN - BEND_DRESSING) * worn
	const friction = FRICTION_WORN * worn
	const stretchPasses = worn > 0.5 ? 2 : 1

	for (let sub = 0; sub < SUBSTEPS; sub += 1) {
		for (let index = 0; index < count; index += 1) {
			const x = positions[index * 3] ?? 0
			const y = positions[index * 3 + 1] ?? 0
			const z = positions[index * 3 + 2] ?? 0
			const vx = (x - (previous[index * 3] ?? x)) * damping
			const vy = (y - (previous[index * 3 + 1] ?? y)) * damping
			const vz = (z - (previous[index * 3 + 2] ?? z)) * damping

			previous[index * 3] = x
			previous[index * 3 + 1] = y
			previous[index * 3 + 2] = z

			positions[index * 3] = x + vx
			positions[index * 3 + 1] = y + vy + gravity * h * h
			positions[index * 3 + 2] = z + vz
		}

		for (let pass = 0; pass < stretchPasses; pass += 1) {
			projectPairs(positions, state.edgePairs, state.edgeRests, 1)
		}

		projectPairs(positions, state.bendPairs, state.bendRests, bend)
		projectPairs(positions, state.seamPairs, undefined, seamStrength)
		projectPairs(positions, state.tiePairs, undefined, tieStrength)

		// Cloth barely moves inside one substep, so colliding on every third one
		// buys back most of the cost without letting anything tunnel.
		if (sub % 3 === 0) selfCollide(state)

		for (let index = 0; index < count; index += 1) {
			const px = positions[index * 3] ?? 0
			const py = positions[index * 3 + 1] ?? 0
			const pz = positions[index * 3 + 2] ?? 0

			for (let held = 0; held < capsules.length; held += 1) {
				const box = boxes[held]
				const capsule = capsules[held]

				if (box === undefined || capsule === undefined) continue
				if (px < box.minX || px > box.maxX) continue
				if (py < box.minY || py > box.maxY) continue
				if (pz < box.minZ || pz > box.maxZ) continue

				pushOutOfCapsule(positions, previous, index, capsule, friction)
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
