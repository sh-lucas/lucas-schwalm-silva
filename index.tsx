import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './src/App'

const container = document.getElementById('container')
if (!container) throw new Error('#container not found!')

ReactDOM.createRoot(container).render(
	<React.StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</React.StrictMode>,
)

// Hide the loading screen once styles, fonts and the first render are done
const loader = document.getElementById('loader')
const pageLoaded = new Promise((resolve) =>
	document.readyState === 'complete'
		? resolve(null)
		: window.addEventListener('load', resolve, { once: true }),
)
void pageLoaded
	.then(() => document.fonts.ready)
	.then(() => {
		loader?.classList.add('done')
		loader?.addEventListener('transitionend', () => loader.remove())
	})
