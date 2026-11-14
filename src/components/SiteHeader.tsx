export function SiteHeader() {
	return (
		<header className="site-header">
			<div className="header-top">
				<div className="avatar-wrapper no-print">
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
					<span className="header-role">Systems &amp; full-stack engineer</span>
				</div>
			</div>

			<p className="header-bio">
				Computer Engineering student at UERGS.
				<br />
				Full stack engineer at{' '}
				<a href="https://roxcode.io/" target="_blank" rel="noopener noreferrer">
					Roxcode
				</a>
				. <br />
				DevOps and Architect at{' '}
				<a
					href="https://fascode.com.br/"
					target="_blank"
					rel="noopener noreferrer"
				>
					Fascode
				</a>
				.
			</p>

			<p className="print-only header-contacts">
				<a href="https://sh-lucas.dev">sh-lucas.dev</a>
				<a href="mailto:lucas.schwalm.silva@gmail.com">
					lucas.schwalm.silva@gmail.com
				</a>
				<a href="https://github.com/sh-lucas">github.com/sh-lucas</a>
				<a href="https://www.linkedin.com/in/lucas-schwalm-silva/">
					linkedin.com/in/lucas-schwalm-silva
				</a>
			</p>

			<div className="social-links no-print">
				<a
					href="https://github.com/sh-lucas"
					target="_blank"
					rel="noopener noreferrer"
					className="social-btn ghost"
				>
					GitHub
				</a>
				<a
					href="https://www.linkedin.com/in/lucas-schwalm-silva/"
					target="_blank"
					rel="noopener noreferrer"
					className="social-btn ghost"
				>
					LinkedIn
				</a>
				<a
					href="mailto:lucas.schwalm.silva@gmail.com"
					className="social-btn primary"
				>
					Contact
				</a>
			</div>
		</header>
	)
}
