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
