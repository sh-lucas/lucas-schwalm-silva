import { EXPERIENCES } from '../data'

export function ExperienceSection() {
	return (
		<section className="fade-in" aria-label="Experience">
			<div className="section-head">
				<span className="section-head-index">01</span>
				<h2 className="section-head-title">Experience</h2>
			</div>

			<div className="experience-list">
				{EXPERIENCES.map((exp) => (
					<article key={exp.company} className="experience-item">
						<div className="experience-header">
							<h3 className="experience-role">{exp.role}</h3>
							<a
								href={exp.link}
								target="_blank"
								rel="noopener noreferrer"
								className="experience-company"
							>
								@ {exp.company}
							</a>
						</div>

						<ul className="experience-highlights">
							{exp.highlights.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>

						<div className="experience-tags">
							{exp.techs.map((tech) => (
								<span key={tech} className="tag">
									{tech}
								</span>
							))}
						</div>
					</article>
				))}
			</div>
		</section>
	)
}
