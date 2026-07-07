import React from 'react'

export function ProjectsComponent() {
	return (
		<>
			<h2 className="text-indigo-950 text-2xl font-semibold">
				Personal Projects
			</h2>
			<Project
				link="https://github.com/sh-lucas/teapot"
				name="Teapot"
				techs="Go, WebSockets, HTML"
				desc="See your Docker container's console output live on a clean web page."
			/>
			<Project
				link="https://github.com/sh-lucas/libsql-handler"
				name="libsql-handler"
				techs="Go"
				desc="A simple libsql hrana protocol implementation to ease access to remote databases without the need for running sqld."
			/>
			<Project
				link="https://github.com/sh-lucas/goproxy"
				name="GoProxy"
				techs="Go, YAML"
				desc="Simple reverse proxy. Redirect requests from prefixes to the hosts configured via YAML."
			/>
		</>
	)
}

export interface ProjectProps {
	link: string
	name: string
	techs: string
	desc: string
}

export function Project({ link, name, techs, desc }: ProjectProps) {
	return (
		<div className="mt-8">
			<div className="flex flex-col md:flex-row md:items-center">
				<a
					className="text-lg text-slate-800 font-semibold underline"
					href={link}
				>
					{name}
				</a>
				{/* <BlockyLink href={link}>{name}</BlockyLink>{' '} */}
				<div className="my-1.5 md:ml-3 font-semibold text-slate-600 text-sm">
					{techs}
				</div>
			</div>
			{desc}
		</div>
	)
}
