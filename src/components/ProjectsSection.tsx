import { ArrowUpRight } from 'lucide-react'

import { PROJECTS } from '../data'

export function ProjectsSection() {
	return (
		<section className="fade-in" aria-label="Projects">
			<div className="section-head">
				<h2 className="section-head-title">Projects</h2>
				<span className="section-head-meta">selected work</span>
			</div>

			<div className="project-list">
				{PROJECTS.map((project) => (
					<a
						key={project.name}
						href={project.link}
						target="_blank"
						rel="noopener noreferrer"
						className="project-item"
					>
						<div className="project-head">
							<span className="project-name">{project.name}</span>
							<ArrowUpRight size={14} className="project-link-icon" />
						</div>
						<p className="project-desc">{project.desc}</p>
						<div className="project-tags">
							{project.techs.map((tech) => (
								<span key={tech} className="tag">
									{tech}
								</span>
							))}
						</div>
					</a>
				))}
			</div>
		</section>
	)
}
