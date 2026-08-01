import type { Draft } from "@/lib/drafting/draft"
import type { Design, Fabric, Measurements } from "@/lib/drafting/model"
import { LayoutView } from "./layout-view"
import { SilhouetteView } from "./silhouette-view"

interface SectionProps {
	id: string
	title: string
	lead?: string
	children: React.ReactNode
}

function Section(props: SectionProps) {
	return (
		<section
			id={props.id}
			className="scroll-mt-6 space-y-4 border-t border-border pt-8 first:border-0 first:pt-0"
		>
			<div className="space-y-1">
				<h2 className="text-base font-semibold tracking-wide">{props.title}</h2>
				{props.lead === undefined ? null : (
					<p className="text-sm text-muted-foreground">{props.lead}</p>
				)}
			</div>

			{props.children}
		</section>
	)
}

interface IssueListProps {
	issues: Draft["issues"]
}

function IssueList(props: IssueListProps) {
	if (props.issues.length === 0) {
		return (
			<p className="rounded border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
				{"検算に引っかかるところはありません。"}
			</p>
		)
	}

	return (
		<ul className="space-y-2">
			{props.issues.map((issue) => (
				<li
					key={issue.id}
					className={`flex gap-3 rounded-md border px-3 py-2 text-sm ${
						issue.level === "error" ? "border-destructive/40 bg-destructive/5" : "bg-muted/50"
					}`}
				>
					<span
						className={`shrink-0 font-medium ${issue.level === "error" ? "text-destructive" : "text-muted-foreground"}`}
					>
						{issue.issueClass}
					</span>
					<span>{issue.message}</span>
				</li>
			))}
		</ul>
	)
}

interface CutTableProps {
	cutSizes: Draft["cutSizes"]
	collarFinished: number
}

function CutTable(props: CutTableProps) {
	return (
		<table className="w-full border-collapse text-sm">
			<thead>
				<tr className="border-b text-left text-xs text-muted-foreground">
					<th className="py-2 font-medium">{"パーツ"}</th>
					<th className="py-2 text-right font-medium">{"幅"}</th>
					<th className="py-2 text-right font-medium">{"丈"}</th>
					<th className="py-2 text-right font-medium">{"枚数"}</th>
				</tr>
			</thead>
			<tbody>
				{props.cutSizes.map((size) => (
					<tr key={size.name} className="border-b border-border/60">
						<td className="py-2">
							{size.name}
							{size.onFold ? <span className="ml-1.5 text-xs text-fold">{"わ"}</span> : null}
						</td>
						<td className="py-2 text-right tabular-nums">{`${size.width.toFixed(1)}`}</td>
						<td className="py-2 text-right tabular-nums">{`${size.height.toFixed(1)}`}</td>
						<td className="py-2 text-right tabular-nums">{`${size.quantity}`}</td>
					</tr>
				))}
			</tbody>
		</table>
	)
}

interface DraftDocumentProps {
	result: Draft
	measurements: Measurements
	design: Design
	fabric: Fabric
}

export function DraftDocument(props: DraftDocumentProps) {
	return (
		<div className="mx-auto max-w-3xl space-y-10 p-6 pb-24">
			<Section id="kenzan" title="検算">
				<IssueList issues={props.result.issues} />
			</Section>

			<Section
				id="silhouette"
				title="シルエット"
				lead="出来上がりの輪郭を、身長170cmの図に重ねたもの。"
			>
				<SilhouetteView measurements={props.measurements} design={props.design} />
			</Section>

			<Section
				id="sunpou"
				title="裁ち切り寸法"
				lead={`縫い代込みの寸法です。掛襟の仕上がり幅は${props.result.fit.collarFinished.toFixed(1)}cm。`}
			>
				<CutTable
					cutSizes={props.result.cutSizes}
					collarFinished={props.result.fit.collarFinished}
				/>
			</Section>

			<Section
				id="zairyou"
				title="材料"
				lead={`生地代は ¥${props.result.cost.toLocaleString("ja-JP")}。`}
			>
				<table className="w-full border-collapse text-sm">
					<tbody>
						{props.result.materials.map((material) => (
							<tr key={material.id} className="border-b border-border/60">
								<td className="py-2 pr-3 font-medium">{material.name}</td>
								<td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
									{material.amount}
								</td>
								<td className="py-2 text-xs text-muted-foreground">{material.note}</td>
							</tr>
						))}
					</tbody>
				</table>
			</Section>

			<Section
				id="tachikata"
				title="裁ち方図"
				lead={`買う長さ ${(props.result.fabricNeeded / 100).toFixed(2)} m。`}
			>
				<LayoutView
					layout={props.result.layout}
					fabric={props.fabric}
					needed={props.result.fabricNeeded}
				/>
			</Section>

			<Section id="nuikata" title="縫い方" lead="意匠の選び方に合わせて手順が変わります。">
				<ol className="space-y-3">
					{props.result.steps.map((step, index) => (
						<li key={step.id} className="flex gap-3">
							<span className="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground">
								{index + 1}
							</span>
							<div className="space-y-0.5">
								<h3 className="text-sm font-medium">{step.title}</h3>
								<p className="text-sm text-muted-foreground">{step.detail}</p>
							</div>
						</li>
					))}
				</ol>
			</Section>
		</div>
	)
}
