import { Input } from "@/features/shared/ui/input"
import { Label } from "@/features/shared/ui/label"
import { Separator } from "@/features/shared/ui/separator"
import { edgeLength } from "@/lib/drafting/assembly"
import { findPanel, findVertex } from "@/lib/drafting/document"
import { edgeBow, moveVertex, setEdgeBow, updatePanel } from "@/lib/drafting/edit"
import type { Editor } from "../use-editor"

interface FieldProps {
	label: string
	children: React.ReactNode
}

function Field(props: FieldProps) {
	return (
		<Label className="flex items-center justify-between gap-3 text-sm font-normal">
			<span className="text-muted-foreground">{props.label}</span>
			{props.children}
		</Label>
	)
}

interface NumberFieldProps {
	value: number
	step?: number
	onChange: (next: number) => void
}

function NumberField(props: NumberFieldProps) {
	return (
		<Input
			type="number"
			step={props.step ?? 0.5}
			value={props.value}
			onChange={(event) => {
				const parsed = Number(event.target.value)

				if (Number.isFinite(parsed)) props.onChange(parsed)
			}}
			className="tnum h-7 w-24 text-right text-sm"
		/>
	)
}

interface InspectorProps {
	editor: Editor
}

/**
 * Values only. Every verb — round, sharpen, split, duplicate, delete, mark as
 * わ — lives on the object's own right-click menu, so acting on something does
 * not mean crossing the window to find a button.
 */
export function Inspector(props: InspectorProps) {
	const { document, selection } = props.editor
	const panel = selection.panelId === undefined ? undefined : findPanel(document, selection.panelId)

	const vertex =
		panel === undefined || selection.vertexId === undefined
			? undefined
			: findVertex(panel, selection.vertexId)

	const edgeVertexId = selection.edgeVertexId

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			<section className="space-y-2 p-4">
				<h2 className="text-xs font-medium text-muted-foreground">{"パーツ"}</h2>

				{document.panels.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						{"ペンか長方形でパーツを描いてください。"}
					</p>
				) : null}

				<ul className="space-y-0.5">
					{document.panels.map((entry) => (
						<li key={entry.id}>
							<button
								type="button"
								onClick={() => props.editor.select({ panelId: entry.id })}
								className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition-colors ${
									entry.id === selection.panelId ? "bg-accent" : "hover:bg-muted"
								}`}
							>
								<span>{entry.name}</span>
								<span className="tnum text-xs text-muted-foreground">{`${entry.quantity}枚`}</span>
							</button>
						</li>
					))}
				</ul>
			</section>

			{panel === undefined ? null : (
				<>
					<Separator />

					<section className="space-y-3 p-4">
						<h2 className="text-xs font-medium text-muted-foreground">
							{vertex !== undefined ? "点" : edgeVertexId !== undefined ? "辺" : "パーツ"}
						</h2>

						{vertex !== undefined ? (
							<>
								<Field label="よこ">
									<NumberField
										value={vertex.x}
										onChange={(next) =>
											props.editor.apply(moveVertex(document, panel.id, vertex.id, next, vertex.y))
										}
									/>
								</Field>

								<Field label="たて">
									<NumberField
										value={vertex.y}
										onChange={(next) =>
											props.editor.apply(moveVertex(document, panel.id, vertex.id, vertex.x, next))
										}
									/>
								</Field>
							</>
						) : null}

						{vertex === undefined && edgeVertexId !== undefined ? (
							<>
								<Field label="長さ">
									<span className="tnum text-sm">
										{`${edgeLength(document, { panelId: panel.id, vertexId: edgeVertexId }).toFixed(1)} cm`}
									</span>
								</Field>

								<Field label="ふくらみ">
									<NumberField
										value={edgeBow(panel, edgeVertexId)}
										step={0.1}
										onChange={(next) =>
											props.editor.apply(setEdgeBow(document, panel.id, edgeVertexId, next))
										}
									/>
								</Field>

								{panel.foldEdge === edgeVertexId ? (
									<p className="text-xs text-fold">{"この辺は わ（折り山）です。"}</p>
								) : null}
							</>
						) : null}

						{vertex === undefined && edgeVertexId === undefined ? (
							<>
								<Field label="名前">
									<Input
										value={panel.name}
										onChange={(event) =>
											props.editor.apply(
												updatePanel(document, panel.id, { name: event.target.value }),
											)
										}
										className="h-7 w-32 text-sm"
									/>
								</Field>

								<Field label="枚数">
									<NumberField
										value={panel.quantity}
										step={1}
										onChange={(next) =>
											props.editor.apply(
												updatePanel(document, panel.id, {
													quantity: Math.max(1, Math.round(next)),
												}),
											)
										}
									/>
								</Field>
							</>
						) : null}

						<p className="pt-1 text-xs text-muted-foreground">
							{"右クリックでできることが出ます。"}
						</p>
					</section>
				</>
			)}
		</div>
	)
}
