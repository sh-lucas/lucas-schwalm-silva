import React from 'react'

export function TechnologiesComponent() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="text-2xl font-semibold text-slate-800">Proficient</h2>
				<div className="flex flex-wrap gap-6 mt-4">
					<div className="flex items-center">
						<img
							className="w-10 mr-3"
							alt="golang"
							src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg"
						/>
						<span className="text-lg text-slate-800 font-medium">Go</span>
					</div>
					<div className="flex items-center">
						<img
							className="w-10 mr-3"
							alt="typescript"
							src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg"
						/>
						<span className="text-lg text-slate-800 font-medium">
							TypeScript
						</span>
					</div>
					<div className="flex items-center">
						<img
							className="w-10 mr-3"
							alt="c"
							src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/c/c-original.svg"
						/>
						<span className="text-lg text-slate-800 font-medium">C</span>
					</div>
				</div>
			</div>

			<div className="border-t border-zinc-300 my-2" />

			<div>
				<h2 className="text-2xl font-semibold text-slate-800">In progress</h2>
				<div className="flex flex-wrap gap-6 mt-4">
					<div className="flex items-center">
						<img
							className="w-10 mr-3"
							alt="react"
							src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg"
						/>
						<span className="text-lg text-slate-800 font-medium">React</span>
					</div>
					<div className="flex items-center">
						<img
							className="w-10 mr-3"
							alt="rust"
							src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg"
						/>
						<span className="text-lg text-slate-800 font-medium">Rust</span>
					</div>
				</div>
			</div>
		</div>
	)
}
