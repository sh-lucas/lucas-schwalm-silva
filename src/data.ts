/* ==========================================================================
   Content data — types, navigation and static content live here.
   ========================================================================== */

export interface SystemMetrics {
	cpu_percent: number
	cpu_usage: number
	disk_percent: number
	io_percent: number
	load_avg: number
	memory_percent: number
	uptime_percent: number
	avg_psi: number
}

export interface Experience {
	company: string
	role: string
	link: string
	highlights: string[]
	techs: string[]
}

export interface Project {
	name: string
	link: string
	techs: string[]
	desc: string
}

export const TABS = [
	{ id: 'monitor', label: 'Monitor', route: '/metrics' },
	{ id: 'experience', label: 'Experience', route: '/experience' },
	{ id: 'projects', label: 'Projects', route: '/projects' },
] as const

export type TabId = (typeof TABS)[number]['id']

export const EXPERIENCES: Experience[] = [
	{
		company: 'Roxcode',
		role: 'Full Stack Developer',
		link: 'https://roxcode.io/',
		highlights: [
			'Backend development and integrations for multiple projects, including Frigelar, Internacional Shopping, and Nectar Applications.',
			"Diverse use of NodeJS, Go, SQL and MongoDB for products that need from simplicity to distributed consistency.",
			'RAG pipelines, image processing, and text extraction with embedded AI (TFLite) and cloud AI (Vertex AI).',
		],
		techs: ['Microservices', 'Golang', 'NestJS', 'SQL', 'MongoDB'],
	},
	{
		company: 'Fascode',
		role: 'Development, DevOps & Consulting',
		link: 'https://www.fascode.com.br/',
		highlights: [
			'Development of internal core products as well as custom client solutions.',
			'Infrastructure architecture and maintenance across distributed projects.',
		],
		techs: ['Spring Boot', 'Podman', 'React', 'CI/CD'],
	},
	{
		company: 'Metria Sales',
		role: 'Freelance Full Stack Developer',
		link: 'https://metriasales.com/',
		highlights: [
			'Full-stack web and backend development for sales CRM.',
			'AI integrations, data processing, and classification pipelines.',
		],
		techs: ['Node.js', 'MySQL', 'React', 'CI/CD'],
	},
]

export const PROJECTS: Project[] = [
	{
		name: 'lucas-schwalm-silva',
		link: 'https://github.com/sh-lucas/lucas-schwalm-silva',
		techs: ['TypeScript', 'React'],
		desc: 'This very website. A portfolio and live server dashboard built with React and Vite.',
	},
	{
		name: 'Plinth',
		link: 'https://about.plinth.sh-lucas.dev',
		techs: ['Web API'],
		desc: 'A multi-tenant ledger for managing any quantity, built to be auditable, reliable, and extensively configurable.',
	},
	{
		name: 'checkup',
		link: 'https://github.com/sh-lucas/checkup',
		techs: ['Rust'],
		desc: 'Small system monitor and uptime calculator — the backend streaming live metrics to this very dashboard.',
	},
	{
		name: 'libsql-handler',
		link: 'https://github.com/sh-lucas/libsql-handler',
		techs: ['Go'],
		desc: 'A pure Go implementation of the libSQL Hrana protocol to query remote databases directly without needing sqld.',
	},
]

export const PRODUCTION_EXCUSES = [
	'The Garbage Collector decided to take an extended coffee break.',
	'A rogue loop in the Kubernetes Scheduler is currently questioning its life choices.',
	'The ssh key expired somehow and I did not notice.',
	'The Docker daemon has temporarily transitioned to a spiritual retreat.',
	'A cloud provider engineer tripped over a fiber cable.',
	'The CPU is just running a thermal workout to keep the server farm warm.',
	"It works on my machine. Have you checked if your hemisphere's gravity is reversed?",
	'A microservice entered a reactive existential crisis.',
	"A junior developer committed a 'temporary' testing endpoint to production.",
	'The database connection pool is currently social distancing.',
	'A cosmic ray hit the exact transistor hosting the index page.',
	'I forgot to renew the domain.',
	'The CI/CD pipeline decided to rebuild the Universe.',
	'A temporary log file currently weights 4.2TB.',
	'Someone ran a regex that is still backtracking from 1999.',
	'The server is actually online, just not publicly reachable right now.',
	"PHP's fault, actually.",
	'DNS propagation is currently traveling at the speed of continental drift.',
	'The immutable system configuration mutated itself out of existence (again).',
	'The background workers formed a union and went on strike.',
	'The SSL certificate expired exactly 3 seconds after the sysadmin went to sleep.',
	'We accidentally deployed the local mock database to us-east-1.',
	'The system ran out of file descriptors and dignity.',
	'A deadlock occurred between the main thread and the coffee machine.',
	'The load balancer is distributing pure chaos equally across all nodes.',
	'We hit the integer overflow limit on our cloud provider billing account.',
	'We removed the french documentation to save some space and it stopped working.',
	'We deleted an empty file named "temporary-log_v2(3).txt" and now the rollback is also broken.',
	'The scheduler entered a priority inversion loop and forgot how to count.',
	'We decided to turn it off to save some energy for tomorrow.',
	'You are absolutely right! ...',
]
