import { useHotkey } from "@tanstack/react-hotkeys"
import { Redo2, Undo2 } from "lucide-react"
import { Button } from "@/features/shared/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/features/shared/ui/tabs"
import { useDraftHistory } from "../use-draft-history"
import { useDraftState } from "../use-draft-state"
import { ControlRail } from "./control-rail"
import { DraftDocument } from "./draft-document"
import { PatternCanvas } from "./pattern-canvas"

export function DrafterPage() {
	const state = useDraftState()
	const history = useDraftHistory(state.search, state.replaceAll)

	useHotkey("Mod+Z", () => history.undo(), { ignoreInputs: true })
	useHotkey("Mod+Shift+Z", () => history.redo(), { ignoreInputs: true })
	useHotkey("Mod+Y", () => history.redo(), { ignoreInputs: true })

	const errors = state.result.issues.filter((issue) => issue.level === "error").length

	return (
		<div className="flex h-screen overflow-hidden">
			<aside className="w-72 shrink-0 border-r">
				<ControlRail state={state} />
			</aside>

			<Tabs defaultValue="seizu" className="flex min-w-0 flex-1 flex-col gap-0">
				<div className="flex items-center justify-between gap-4 border-b px-3 py-2">
					<div className="flex items-center gap-3">
						<TabsList className="h-8">
							<TabsTrigger value="seizu" className="text-xs">
								{"製図"}
							</TabsTrigger>
							<TabsTrigger value="shorui" className="text-xs">
								{"寸法・材料・縫い方"}
							</TabsTrigger>
						</TabsList>

						<div className="flex items-center gap-0.5">
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								disabled={!history.canUndo}
								onClick={history.undo}
								title="元に戻す（⌘Z）"
							>
								<Undo2 className="size-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								disabled={!history.canRedo}
								onClick={history.redo}
								title="やり直す（⇧⌘Z）"
							>
								<Redo2 className="size-3.5" />
							</Button>
						</div>
					</div>

					<div className="flex items-center gap-4 text-xs text-muted-foreground">
						<span className="tnum">{`買う長さ ${(state.result.fabricNeeded / 100).toFixed(2)} m`}</span>
						<span className="tnum">{`¥${state.result.cost.toLocaleString("ja-JP")}`}</span>
						<span className={errors > 0 ? "text-destructive" : ""}>
							{errors > 0 ? `${errors}件の不整合` : "検算OK"}
						</span>
					</div>
				</div>

				<TabsContent value="seizu" className="min-h-0 flex-1">
					<PatternCanvas state={state} />
				</TabsContent>

				<TabsContent value="shorui" className="min-h-0 flex-1 overflow-y-auto">
					<DraftDocument
						result={state.result}
						measurements={state.measurements}
						design={state.design}
						fabric={state.fabric}
					/>
				</TabsContent>
			</Tabs>
		</div>
	)
}
