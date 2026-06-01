import type React from 'react'
import { useState } from 'react'
import { ProjectsComponent } from './projects'
import { TechnologiesComponent } from './techs'

type TabType = 'Formal Experience' | 'Techs' | 'Personal Projects'

export function Selector() {
	const [open, setOpen] = useState<TabType>('Formal Experience')

	const blocks: Record<TabType, React.ReactNode> = {
		'Formal Experience': <FormalExperience />,
		Techs: <Techs />,
		'Personal Projects': <PersonalProjects />,
	}

	const errorMsg = 'Sorry, this should not be happening =('

	return (
		<section className="m-2 p-2">
			<div className="flex">
				<SectionHeader setter={setOpen} getter={open}>
					Formal Experience
				</SectionHeader>

				<SectionHeader setter={setOpen} getter={open}>
					Techs
				</SectionHeader>

				<SectionHeader setter={setOpen} getter={open}>
					Personal Projects
				</SectionHeader>
			</div>

			<div className="mx-2 my-4">
				{/* Pretty confusing, but I promise it makes sense =p */}
				{blocks[open] || errorMsg}
			</div>
		</section>
	)
}

interface SectionHeaderProps {
	children: TabType
	setter: (tab: TabType) => void
	getter: TabType
}

function SectionHeader({ children, setter, getter }: SectionHeaderProps) {
	const underlined = getter === children ? 'underline' : ' '

	return (
		<button
			// problem of react, just too many things all at once
			className={`mr-2 p-2 text-lg text-indigo-950 font-semibold hover:underline transition ${underlined}`}
			type="button"
			onClick={() => {
				setter(children)
			}}
		>
			{children}
		</button>
	)
}

function FormalExperience() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="text-2xl font-semibold text-slate-800">
					🚀 Full stack engineer
				</h2>
				<p className="my-1">
					<span className="text-indigo-950 font-semibold">Roxcode</span> <br />
					Brazil (Remote)
				</p>
				<p>
					<span className="text-slate-800 font-semibold">2024/09</span> -{' '}
					<span className="text-slate-800 font-semibold">Present</span>
				</p>
			</div>

			<div className="border-t border-zinc-300 my-4" />

			<div>
				<h2 className="text-2xl font-semibold text-slate-800">
					⚙️ Engenharia de Computação 💻
				</h2>
				<p className="my-1">
					<span className="text-indigo-950 font-semibold">UERGS</span> -
					Universidade Estadual do Rio Grande do Sul <br />
					Guaíba - RS | Brazil
				</p>
				<p>
					<span className="text-slate-800 font-semibold">2023/2</span> -{' '}
					<span className="text-slate-800 font-semibold">2027/2</span>{' '}
					(expected)
				</p>
			</div>
		</div>
	)
}

function Techs() {
	return <TechnologiesComponent />
}

function PersonalProjects() {
	return <ProjectsComponent />
}
