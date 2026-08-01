import { type ComponentType, useEffect, useRef } from "react"

export interface MenuItem {
	readonly label: string
	readonly icon: ComponentType<{ className?: string }>
	readonly onSelect: () => void
	readonly danger?: boolean
}

export interface MenuTarget {
	readonly clientX: number
	readonly clientY: number
	readonly title: string
	readonly items: readonly MenuItem[]
}

interface ContextMenuProps {
	target: MenuTarget
	onDismiss: () => void
}

/**
 * Positioned at the pointer rather than anchored to a trigger, because the
 * things it acts on are SVG shapes inside a transformed canvas and their layout
 * box bears no relation to where they appear.
 */
export function ContextMenu(props: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const dismiss = (event: Event) => {
			if (event.target instanceof Node && menuRef.current?.contains(event.target) === true) return

			props.onDismiss()
		}

		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") props.onDismiss()
		}

		window.addEventListener("pointerdown", dismiss, true)
		window.addEventListener("keydown", onKey)

		return () => {
			window.removeEventListener("pointerdown", dismiss, true)
			window.removeEventListener("keydown", onKey)
		}
	}, [props.onDismiss])

	return (
		<div
			ref={menuRef}
			className="fixed z-50 min-w-40 overflow-hidden rounded-md border bg-popover py-1 shadow-md"
			style={{ left: props.target.clientX, top: props.target.clientY }}
		>
			<p className="px-3 pt-1 pb-1.5 text-xs text-muted-foreground">{props.target.title}</p>

			{props.target.items.map((item) => (
				<button
					key={item.label}
					type="button"
					onClick={() => {
						item.onSelect()
						props.onDismiss()
					}}
					className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
						item.danger === true ? "text-destructive" : ""
					}`}
				>
					<item.icon className="size-4 shrink-0 opacity-70" />
					{item.label}
				</button>
			))}
		</div>
	)
}
