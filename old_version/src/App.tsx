import React from 'react'
import { BlockyLink } from './components/blockyLink.tsx'
import { Selector } from './components/selector.tsx'

export function App() {
	const FEB = 1
	const today = new Date()
	let age = today.getFullYear() - new Date('2005-02-02').getFullYear()

	if (
		today.getMonth() < FEB ||
		(today.getMonth() === FEB && today.getDate() < 2)
	)
		age--

	return (
		<div className="w-screen min-h-lvh flex items-center justify-center overflow-x-hidden text-slate-950 font-mono font-medium bg-zinc-200 p-4">
			<div className="container m-4 min-h-lvh lg:w-3/6 mt-20 sm:mt-16">
				{/* heading title */}
				<header>
					<h1 className="text-indigo-950 font-semibold text-6xl">
						<span className="inline-block">Hello,&nbsp;</span>
						<span className="inline-block">I am&nbsp;</span>
						<span className="inline-block">
							<span className="underline">Lucas</span>!
						</span>
					</h1>
				</header>

				{/* main photo, description and links */}
				<main className="my-12 flex flex-col sm:flex-row">
					<img
						height={208}
						width={208}
						className="w-52 ml-6 rounded-full border-indigo-950 border-4"
						src="https://avatars.githubusercontent.com/u/57202598?s=400&u=07d28aa77c08dcef79364a50831a494c1b16fecf&v=4"
						alt="My profile"
					/>
					<div className="m-4 md:ml-6 h-2/6">
						<p className="text-slate-900">
							I am a {age} years old student, looking for experience and self
							development.
						</p>
						<p className="text-slate-900 mt-3">
							Currently coding production-ready bugs at Roxcode.
						</p>
						<address className="mt-12">
							<div className="flex flex-col md:flex-row">
								<div className="mr-2">
									<BlockyLink href="https://github.com/sh-lucas">
										Github
									</BlockyLink>
								</div>
								<div className="mr-2 mt-2 md:mt-0">
									<BlockyLink href="https://www.linkedin.com/in/lucas-schwalm-silva/">
										LinkedIn
									</BlockyLink>
								</div>
							</div>
						</address>
					</div>
				</main>

				{/* section selesctor with technologies and stuff */}
				<Selector />

				{/* footer link */}
				<footer className="leading-7 p-px">
					<a
						className="fixed bottom-4 right-4 md:bottom-6 md:right-6 px-3 py-1.5 inline-flex items-center gap-2 hover:bg-slate-800 hover:text-slate-200 transition border-2 border-slate-900 rounded-md font-medium bg-zinc-200/90 backdrop-blur-sm z-50 text-indigo-950 shadow-sm"
						href="mailto:lucas.schwalm.silva@gmail.com"
					>
						✉️ lucas.schwalm.silva@gmail.com
					</a>
				</footer>
			</div>
		</div>
	)
}
