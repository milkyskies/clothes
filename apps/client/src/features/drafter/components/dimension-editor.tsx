import { useEffect, useRef, useState } from "react"

export interface EditorTarget {
	readonly label: string
	readonly value: number
	readonly min: number
	readonly max: number
	readonly step: number
	readonly clientX: number
	readonly clientY: number
	readonly onCommit: (next: number) => void
}

interface DimensionEditorProps {
	target: EditorTarget
	onDismiss: () => void
}

/**
 * Rendered outside the SVG and positioned over it.
 *
 * Inside a foreignObject the browser's own input styling is scaled by the canvas
 * transform, which turns spinners and padding into enormous shapes; as a plain
 * DOM sibling the control keeps its normal size at any zoom.
 */
export function DimensionEditor(props: DimensionEditorProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [text, setText] = useState(String(props.target.value))

	useEffect(() => {
		inputRef.current?.select()
	}, [])

	function commit() {
		const parsed = Number(text)

		if (Number.isFinite(parsed)) {
			props.target.onCommit(Math.min(props.target.max, Math.max(props.target.min, parsed)))
		}

		props.onDismiss()
	}

	return (
		<div
			className="fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-md border bg-background px-2 py-1 shadow-md"
			style={{ left: props.target.clientX, top: props.target.clientY }}
		>
			<span className="text-xs text-muted-foreground">{props.target.label}</span>

			<input
				ref={inputRef}
				type="number"
				inputMode="decimal"
				value={text}
				step={props.target.step}
				min={props.target.min}
				max={props.target.max}
				onChange={(event) => setText(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === "Enter") commit()
					if (event.key === "Escape") props.onDismiss()
				}}
				className="tnum w-14 border-0 bg-transparent p-0 text-right text-sm font-medium text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
			/>

			<span className="text-xs text-muted-foreground">{"cm"}</span>
		</div>
	)
}
