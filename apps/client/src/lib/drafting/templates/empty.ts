import type { Document } from "../document"

export function emptyDocument(): Document {
	return {
		id: "untitled",
		name: "名前のない型",
		panels: [],
		seams: [],
		stitches: [],
		annotations: [],
		body: { chest: 96, height: 170, shoulderWidth: 46, armLength: 58 },
		defaultAllowance: 1.5,
	}
}
