import type { Vertex } from "./measure"
import type { Path } from "./path"

export function pathToSvg(path: Path): string {
	const commands = [`M ${path.start.x} ${path.start.y}`]

	for (const segment of path.segments) {
		if (segment.kind === "line") {
			commands.push(`L ${segment.to.x} ${segment.to.y}`)
			continue
		}

		commands.push(
			`C ${segment.c1.x} ${segment.c1.y} ${segment.c2.x} ${segment.c2.y} ${segment.to.x} ${segment.to.y}`,
		)
	}

	commands.push("Z")

	return commands.join(" ")
}

export function verticesToSvg(vertices: readonly Vertex[]): string {
	if (vertices.length === 0) return ""

	const [first, ...rest] = vertices

	if (first === undefined) return ""

	const commands = [`M ${first.point.x} ${first.point.y}`]

	for (const vertex of rest) {
		commands.push(`L ${vertex.point.x} ${vertex.point.y}`)
	}

	commands.push("Z")

	return commands.join(" ")
}
