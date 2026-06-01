import type React from 'react'

interface BlockyLinkProps {
	children: React.ReactNode
	href: string
}

export function BlockyLink({ children, href }: BlockyLinkProps) {
	return (
		<a
			target="__blank"
			className="px-2 py-1 inline-flex items-center w-fit justify-center hover:bg-slate-800 hover:text-slate-200 transition border-2 border-slate-900 rounded-md not-italic font-medium"
			href={href}
		>
			🔗 {children}
		</a>
	)
}
