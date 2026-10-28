import { defineConfig } from 'vite-plus'

export default defineConfig({
	fmt: {
		ignorePatterns: ['dist/**'],
		useTabs: true,
		singleQuote: true,
		semi: false,
		printWidth: 80,
	},
	lint: {
		ignorePatterns: ['dist/**'],
		jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
		rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
		options: { typeAware: true, typeCheck: true },
	},
	server: { port: 5173, host: true },
	build: { outDir: 'dist', sourcemap: true },
})
