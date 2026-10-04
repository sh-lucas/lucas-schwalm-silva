import { loadEnv } from 'vite'
import { setupCafe } from '../server/cafe'

setupCafe({ ...loadEnv('development', process.cwd(), ''), ...process.env })
	.then(() =>
		console.log('Coffee counter domains and templates are ready in Plinth.'),
	)
	.catch((error) => {
		console.error(error.message)
		process.exitCode = 1
	})
