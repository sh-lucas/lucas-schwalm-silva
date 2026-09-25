import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../src/App'
import { TABS } from '../src/data'

// Suppress harmless useLayoutEffect warning emitted by react-router-dom in node SSR
const originalWarn = console.warn
const originalError = console.error
console.warn = (...args: unknown[]) => {
	if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect')) return
	originalWarn(...args)
}
console.error = (...args: unknown[]) => {
	if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect')) return
	originalError(...args)
}

const DIST_DIR = path.resolve(process.cwd(), 'dist')
const INDEX_PATH = path.resolve(DIST_DIR, 'index.html')

if (!fs.existsSync(INDEX_PATH)) {
	console.error('dist/index.html not found! Run vite build first.')
	process.exit(1)
}

const template = fs.readFileSync(INDEX_PATH, 'utf-8')

function renderRoute(route: string): string {
	return ReactDOMServer.renderToString(
		React.createElement(
			MemoryRouter,
			{ initialEntries: [route] },
			React.createElement(App),
		),
	)
}

// 1. Render main entry (/metrics as default route)
const defaultHtml = renderRoute('/metrics')

// Inject into #container
const containerRegex = /<div id="container">[\s\S]*?<\/div>/
if (!containerRegex.test(template)) {
	console.error('Could not find <div id="container"> in dist/index.html')
	process.exit(1)
}

const updatedIndex = template.replace(
	containerRegex,
	`<div id="container">${defaultHtml}</div>`,
)

fs.writeFileSync(INDEX_PATH, updatedIndex, 'utf-8')
console.log('✓ Successfully prerendered dist/index.html (default: /metrics)')

// 2. Generate static route pages for Cloudflare Pages (instant deep-link loading)
for (const tab of TABS) {
	const routeName = tab.route.replace(/^\//, '')
	const routeDir = path.resolve(DIST_DIR, routeName)
	const routeHtml = renderRoute(tab.route)
	const routeContent = template.replace(
		containerRegex,
		`<div id="container">${routeHtml}</div>`,
	)

	fs.mkdirSync(routeDir, { recursive: true })
	fs.writeFileSync(path.resolve(routeDir, 'index.html'), routeContent, 'utf-8')
	console.log(
		`✓ Prerendered route: ${tab.route} -> dist/${routeName}/index.html`,
	)
}

console.log(
	'✨ Prerender complete: all pages now have full HTML on first paint!',
)
