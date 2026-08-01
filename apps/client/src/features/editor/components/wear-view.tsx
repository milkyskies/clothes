import { OrbitControls } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { useMemo, useRef, useState } from "react"
import { BufferAttribute, BufferGeometry, DoubleSide, Quaternion, Vector3 } from "three"
import { Button } from "@/features/shared/ui/button"
import type { Draft } from "@/lib/drafting/draft"
import { buildAvatar } from "@/lib/sim/avatar"
import { buildClothMesh, type ClothMesh } from "@/lib/sim/mesh"
import { type Capsule, type ClothState, stateOf, step } from "@/lib/sim/solver"
import type { Editor } from "../use-editor"

const UP = new Vector3(0, 1, 0)

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
}

function Cloth(props: ClothProps) {
	const elapsed = useRef(0)

	const geometry = useMemo(() => {
		const built = new BufferGeometry()

		built.setAttribute("position", new BufferAttribute(props.state.positions, 3))
		built.setIndex(new BufferAttribute(props.mesh.triangles, 1))
		built.computeVertexNormals()

		return built
	}, [props.mesh, props.state])

	useFrame((_, delta) => {
		if (!props.playing) return

		// Big tab-switch deltas are clamped so the first frame back cannot fling
		// the cloth; the simulation is only stable at frame-sized steps.
		elapsed.current += Math.min(delta, 1 / 30)

		step(props.mesh, props.state, props.capsules, Math.min(delta, 1 / 30), elapsed.current)

		const attribute = geometry.getAttribute("position")

		attribute.needsUpdate = true
		geometry.computeVertexNormals()
	})

	return (
		<mesh geometry={geometry}>
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

				<Cloth mesh={built.mesh} state={built.state} capsules={built.capsules} playing={playing} />

				<OrbitControls target={[0, 110, 0]} enablePan={false} minDistance={80} maxDistance={500} />
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
				{"ドラッグで回転、スクロールで寄れます。布は縫い方のとおりに垂れています。"}
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
