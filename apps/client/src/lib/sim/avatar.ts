import type { BodyReference } from "@/lib/drafting/draft"
import type { Capsule } from "./solver"

/**
 * A mannequin in centimetres, built from the draft's own body figures.
 *
 * Capsules are all the collision the cloth needs, and a T-pose matches the
 * flat layout — the sleeves already point straight out — so the garment starts
 * where it ends up instead of having to travel.
 */
export function buildAvatar(body: BodyReference): readonly Capsule[] {
	const shoulderY = body.height * 0.82
	const chestRadius = body.chest / (2 * Math.PI)
	const halfShoulder = body.shoulderWidth / 2
	const hipY = body.height * 0.5

	const torso: Capsule = {
		ax: 0,
		ay: shoulderY - 6,
		az: 0,
		bx: 0,
		by: hipY,
		bz: 0,
		radius: chestRadius,
	}

	const shoulders: Capsule = {
		ax: -halfShoulder + 4,
		ay: shoulderY - 2,
		az: 0,
		bx: halfShoulder - 4,
		by: shoulderY - 2,
		bz: 0,
		radius: 5.5,
	}

	const neck: Capsule = {
		ax: 0,
		ay: shoulderY - 2,
		az: 0,
		bx: 0,
		by: shoulderY + 8,
		bz: 0,
		radius: 5.5,
	}

	const head: Capsule = {
		ax: 0,
		ay: shoulderY + 16,
		az: 0,
		bx: 0,
		by: shoulderY + 24,
		bz: 0,
		radius: 10,
	}

	const arms: Capsule[] = [-1, 1].map((side) => ({
		ax: side * (halfShoulder - 3),
		ay: shoulderY - 3,
		az: 0,
		bx: side * (halfShoulder - 3 + body.armLength),
		by: shoulderY - 3,
		bz: 0,
		radius: 4.5,
	}))

	const legs: Capsule[] = [-1, 1].map((side) => ({
		ax: side * 9,
		ay: hipY,
		az: 0,
		bx: side * 10,
		by: 5,
		bz: 0,
		radius: 7.5,
	}))

	return [torso, shoulders, neck, head, ...arms, ...legs]
}
