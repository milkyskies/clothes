import { useHotkey } from "@tanstack/react-hotkeys"
import { MousePointer2, PenLine, Redo2, Square, Undo2 } from "lucide-react"
import { Button } from "@/features/shared/ui/button"
import { Separator } from "@/features/shared/ui/separator"
import { addRectanglePanel } from "@/lib/drafting/edit"
import { jinbeiTop } from "@/lib/drafting/templates/jinbei"
import { type Tool, useEditor } from "../use-editor"
import { EditorCanvas } from "./editor-canvas"
import { Inspector } from "./inspector"

const TOOLS: readonly { value: Tool; label: string; icon: typeof PenLine }[] = [
	{ value: "select", label: "えらぶ", icon: MousePointer2 },
	{ value: "pen", label: "ペン", icon: PenLine },
]

const SNAPS: readonly number[] = [0, 0.5, 1]

export function EditorPage() {
	const editor = useEditor(jinbeiTop())

	useHotkey("Mod+Z", () => editor.undo(), { ignoreInputs: true })
	useHotkey("Mod+Shift+Z", () => editor.redo(), { ignoreInputs: true })
	useHotkey("V", () => editor.setTool("select"), { ignoreInputs: true })
	useHotkey("P", () => editor.setTool("pen"), { ignoreInputs: true })

	function addRectangle() {
		const created = addRectanglePanel(editor.document, 4, 4, 30, 70)

		editor.apply(created.document)
		editor.select({ panelId: created.panelId })
		editor.setTool("select")
	}

	return (
		<div className="flex h-screen overflow-hidden">
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex items-center gap-3 border-b px-3 py-2">
					<div className="flex items-center gap-0.5">
						{TOOLS.map((entry) => (
							<Button
								key={entry.value}
								variant={editor.tool === entry.value ? "default" : "ghost"}
								size="icon"
								className="size-8"
								onClick={() => editor.setTool(entry.value)}
								title={entry.label}
							>
								<entry.icon className="size-4" />
							</Button>
						))}

						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							onClick={addRectangle}
							title="長方形を足す"
						>
							<Square className="size-4" />
						</Button>
					</div>

					<Separator orientation="vertical" className="h-6" />

					<div className="flex items-center gap-0.5">
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							disabled={!editor.canUndo}
							onClick={editor.undo}
							title="元に戻す"
						>
							<Undo2 className="size-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							disabled={!editor.canRedo}
							onClick={editor.redo}
							title="やり直す"
						>
							<Redo2 className="size-4" />
						</Button>
					</div>

					<Separator orientation="vertical" className="h-6" />

					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<span>{"スナップ"}</span>
						{SNAPS.map((value) => (
							<Button
								key={value}
								variant={editor.snap === value ? "default" : "outline"}
								size="sm"
								className="tnum h-7 px-2 text-xs"
								onClick={() => editor.setSnap(value)}
							>
								{value === 0 ? "なし" : `${value}cm`}
							</Button>
						))}
					</div>

					<span className="ml-auto text-sm">{editor.document.name}</span>
				</header>

				<div className="min-h-0 flex-1">
					<EditorCanvas editor={editor} />
				</div>
			</div>

			<aside className="w-72 shrink-0 border-l">
				<Inspector editor={editor} />
			</aside>
		</div>
	)
}
