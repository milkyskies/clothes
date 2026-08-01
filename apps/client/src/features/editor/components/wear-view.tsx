import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { BufferAttribute, BufferGeometry, DoubleSide, Plane, Quaternion, Vector3 } from "three"
import { Button } from "@/features/shared/ui/button"
import type { Draft } from "@/lib/drafting/draft"
import { buildAvatar } from "@/lib/sim/avatar"
import { buildClothMesh, type ClothMesh } from "@/lib/sim/mesh"
import { type Capsule, type ClothState, type Grab, stateOf, step } from "@/lib/sim/solver"
import type { Editor } from "../use-editor"

const UP = new Vector3(0, 1, 0)
const TARGET = new Vector3(0, 110, 0)

interface CameraRigProps {
	holding: boolean
}

/**
 * Orbit built for a Mac trackpad: two-finger scroll turns the mannequin the
 * way it pans the flat views, pinch zooms, and a plain drag on empty space
 * rotates too. Grabbing cloth suspends all of it so a tug never spins the room.
 */
function CameraRig(props: CameraRigProps) {
	const three = useThree()
	const orbit = useRef({ azimuth: 0, polar: 1.25, distance: 250 })
	const dragging = useRef(false)
	const holding = useRef(props.holding)

	holding.current = props.holding

	useEffect(() => {
		const element = three.gl.domElement

		const onPointerDown = () => {
			dragging.current = true
		}

		const onPointerUp = () => {
			dragging.current = false
		}

		const onPointerMove = (event: PointerEvent) => {
			if (!dragging.current || holding.current) return

			orbit.current.azimuth -= event.movementX * 0.006
			orbit.current.polar = clampPolar(orbit.current.polar - event.movementY * 0.006)
		}

		const onWheel = (event: WheelEvent) => {
			event.preventDefault()

			if (event.ctrlKey) {
				orbit.current.distance = Math.min(
					500,
					Math.max(80, orbit.current.distance * Math.exp(event.deltaY * 0.01)),
				)

				return
			}

			orbit.current.azimuth -= event.deltaX * 0.005
			orbit.current.polar = clampPolar(orbit.current.polar - event.deltaY * 0.005)
		}

		element.addEventListener("pointerdown", onPointerDown)
		window.addEventListener("pointerup", onPointerUp)
		element.addEventListener("pointermove", onPointerMove)
		element.addEventListener("wheel", onWheel, { passive: false })

		return () => {
			element.removeEventListener("pointerdown", onPointerDown)
			window.removeEventListener("pointerup", onPointerUp)
			element.removeEventListener("pointermove", onPointerMove)
			element.removeEventListener("wheel", onWheel)
		}
	}, [three.gl.domElement])

	useFrame(() => {
		const { azimuth, polar, distance } = orbit.current

		three.camera.position.set(
			TARGET.x + distance * Math.sin(polar) * Math.sin(azimuth),
			TARGET.y + distance * Math.cos(polar),
			TARGET.z + distance * Math.sin(polar) * Math.cos(azimuth),
		)
		three.camera.lookAt(TARGET)
	})

	return null
}

function clampPolar(polar: number): number {
	return Math.min(Math.PI - 0.25, Math.max(0.25, polar))
}

interface CapsuleShapeProps {
	capsule: Capsule
}

function CapsuleShape(props: CapsuleShapeProps) {
	const { capsule } = props
	const direction = new Vector3(
		capsule.bx - capsule.ax,
		capsule.by - capsule.ay,
		capsule.bz - capsule.az,
	)
	const length = direction.length()
	const middle = new Vector3(
		(capsule.ax + capsule.bx) / 2,
		(capsule.ay + capsule.by) / 2,
		(capsule.az + capsule.bz) / 2,
	)
	const rotation = new Quaternion().setFromUnitVectors(
		UP,
		length < 1e-6 ? UP : direction.normalize(),
	)

	return (
		<mesh position={middle} quaternion={rotation}>
			<capsuleGeometry args={[capsule.radius, length, 6, 14]} />
			<meshStandardMaterial color="#c9c4bd" roughness={0.9} />
		</mesh>
	)
}

interface ClothProps {
	mesh: ClothMesh
	state: ClothState
	capsules: readonly Capsule[]
	playing: boolean
	onGrabChange: (held: boolean) => void
}

/**
 * The cloth, steppable and grabbable.
 *
 * Dressing is done with hands, so dragging on the fabric pins the nearest
 * particle to the pointer on a camera-facing plane while the rest of the cloth
 * keeps simulating around it — a tug, not a teleport.
 */
function Cloth(props: ClothProps) {
	const elapsed = useRef(0)
	const grab = useRef<{ index: number; plane: Plane } | undefined>(undefined)
	const target = useRef<Grab | undefined>(undefined)

	const geometry = useMemo(() => {
		const built = new BufferGeometry()

		built.setAttribute("position", new BufferAttribute(props.state.positions, 3))
		built.setIndex(new BufferAttribute(props.mesh.triangles, 1))
		built.computeVertexNormals()

		return built
	}, [props.mesh, props.state])

	useEffect(() => {
		const release = () => {
			grab.current = undefined
			target.current = undefined
			props.onGrabChange(false)
		}

		window.addEventListener("pointerup", release)

		return () => window.removeEventListener("pointerup", release)
	}, [props.onGrabChange])

	function pickUp(event: ThreeEvent<PointerEvent>) {
		event.stopPropagation()

		const { positions } = props.state

		let nearest = 0
		let best = Number.POSITIVE_INFINITY

		for (let index = 0; index < positions.length / 3; index += 1) {
			const dx = (positions[index * 3] ?? 0) - event.point.x
			const dy = (positions[index * 3 + 1] ?? 0) - event.point.y
			const dz = (positions[index * 3 + 2] ?? 0) - event.point.z
			const squared = dx * dx + dy * dy + dz * dz

			if (squared < best) {
				best = squared
				nearest = index
			}
		}

		const plane = new Plane()

		event.ray.direction.normalize()
		plane.setFromNormalAndCoplanarPoint(event.ray.direction.clone().negate(), event.point)

		grab.current = { index: nearest, plane }
		target.current = { index: nearest, x: event.point.x, y: event.point.y, z: event.point.z }
		props.onGrabChange(true)
	}

	useFrame((scene, delta) => {
		const held = grab.current

		if (held !== undefined) {
			scene.raycaster.setFromCamera(scene.pointer, scene.camera)

			const hit = new Vector3()

			if (scene.raycaster.ray.intersectPlane(held.plane, hit) !== null) {
				target.current = { index: held.index, x: hit.x, y: hit.y, z: hit.z }
			}
		}

		if (!props.playing && target.current === undefined) return

		// Big tab-switch deltas are clamped so the first frame back cannot fling
		// the cloth; the simulation is only stable at frame-sized steps.
		elapsed.current += Math.min(delta, 1 / 30)

		step(
			props.mesh,
			props.state,
			props.capsules,
			Math.min(delta, 1 / 30),
			elapsed.current,
			target.current,
		)

		const attribute = geometry.getAttribute("position")

		attribute.needsUpdate = true
		geometry.computeVertexNormals()
	})

	return (
		<mesh geometry={geometry} onPointerDown={pickUp}>
			<meshStandardMaterial color="#3b4a86" roughness={0.85} side={DoubleSide} />
		</mesh>
	)
}

interface WearViewProps {
	editor: Editor
}

/**
 * The garment worn: the same panels and seams handed to a cloth simulation and
 * draped over a mannequin built from the draft's own body figures.
 *
 * The flat views answer whether the pieces go together; this one answers what
 * they hang like once they have.
 */
export default function WearView(props: WearViewProps) {
	const [attempt, setAttempt] = useState(0)
	const [playing, setPlaying] = useState(true)
	const [holding, setHolding] = useState(false)

	const draft = props.editor.draft
	const built = useMemo(() => buildScene(draft, attempt), [draft, attempt])

	return (
		<div className="relative h-full w-full select-none bg-background">
			<Canvas camera={{ position: [0, 150, 240], fov: 40 }}>
				<ambientLight intensity={0.7} />
				<directionalLight position={[120, 260, 180]} intensity={1.4} />
				<directionalLight position={[-140, 120, -120]} intensity={0.4} />

				{built.capsules.map((capsule) => (
					<CapsuleShape
						key={`${capsule.ax},${capsule.ay},${capsule.bx},${capsule.by},${capsule.radius}`}
						capsule={capsule}
					/>
				))}

				<Cloth
					mesh={built.mesh}
					state={built.state}
					capsules={built.capsules}
					playing={playing}
					onGrabChange={setHolding}
				/>

				<CameraRig holding={holding} />
			</Canvas>

			<div className="absolute top-3 left-3 flex items-center gap-1">
				<Button
					variant="outline"
					size="sm"
					className="h-7 bg-background/90 text-xs"
					onClick={() => setPlaying((held) => !held)}
				>
					{playing ? "とめる" : "うごかす"}
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="h-7 bg-background/90 text-xs"
					onClick={() => {
						setAttempt((count) => count + 1)
						setPlaying(true)
					}}
				>
					{"着なおす"}
				</Button>
			</div>

			<p className="pointer-events-none absolute bottom-3 left-3 text-xs text-muted-foreground">
				{"布をつかんで引けます。2本指スクロールで回転、ピンチで寄れます。"}
			</p>
		</div>
	)
}

function buildScene(draft: Draft, attempt: number) {
	const shoulderY = draft.body.height * 0.82
	const mesh = buildClothMesh(draft, shoulderY)

	// The attempt number only exists to make 着なおす rebuild a fresh state.
	return { mesh, state: stateOf(mesh), capsules: buildAvatar(draft.body), attempt }
}
