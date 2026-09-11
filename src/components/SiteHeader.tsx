import { Github, Linkedin, Mail } from 'lucide-react'

function calculateAge(): number {
	const birthDate = new Date('2005-02-02')
	const now = new Date()
	let age = now.getFullYear() - birthDate.getFullYear()
	if (now.getMonth() < 1 || (now.getMonth() === 1 && now.getDate() < 2)) {
		age--
	}
	return age
}

export function SiteHeader() {
	return (
		<header className="site-header">
			<div className="header-top">
				<div className="avatar-wrapper">
					<img
						src="https://avatars.githubusercontent.com/u/57202598?s=400&u=07d28aa77c08dcef79364a50831a494c1b16fecf&v=4"
						alt="Lucas Schwalm Silva"
						className="avatar-img"
						width={72}
						height={72}
					/>
				</div>

				<div className="header-id">
					<h1 className="header-name">Lucas Schwalm Silva</h1>
					<span className="header-role">Systems &amp; Full-Stack Engineer</span>
				</div>
			</div>

			<p className="header-bio">
				{calculateAge()} y/o Computer Engineering student at UERGS, building
				software that fits. Currently developing at{' '}
				<a href="https://roxcode.io/" target="_blank" rel="noopener noreferrer">
					Roxcode
				</a>
				.
			</p>

			<div className="social-links">
				<a
					href="https://github.com/sh-lucas"
					target="_blank"
					rel="noopener noreferrer"
					className="social-btn ghost"
				>
					<Github size={15} /> GitHub
				</a>
				<a
					href="https://www.linkedin.com/in/lucas-schwalm-silva/"
					target="_blank"
					rel="noopener noreferrer"
					className="social-btn ghost"
				>
					<Linkedin size={15} /> LinkedIn
				</a>
				<a
					href="mailto:lucas.schwalm.silva@gmail.com"
					className="social-btn primary"
				>
					<Mail size={15} /> Contact
				</a>
			</div>
		</header>
	)
}
