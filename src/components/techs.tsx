import React from 'react'

export function TechnologiesComponent() {
	return (
		<>
			<h2 className="mt-2 text-lg font-semibold text-slate-800">Proeficient</h2>
			<div className="flex">
        <img
					className="w-8 mr-3"
					alt="golang"
					src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg"
				/>
				<img
					className="w-8 mr-3"
					alt="typescript"
					src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg"
				/>
			</div>
			<h2 className="mt-3 text-lg font-semibold text-slate-800">In progress</h2>
			<div className="flex">
				<img
					className="w-8 mr-3"
					alt="react"
					src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg"
				/>
        <img 
          className="w-8 mr-3"
					alt="mongodb"
          src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg" 
        />
        <img 
          className="w-8 mr-3"
					alt="rabbitmq"
          src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rabbitmq/rabbitmq-original.svg"
        />
           
			</div>
			<h2 className="mt-2 text-lg font-semibold text-slate-800">
				Previous Contacts
			</h2>
			<div className="flex">
				<img
					className="w-6 mr-3"
					alt="rust"
					src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg"
				/>
				<img
					className="w-8 mr-3 -mt-1"
					alt="java"
					src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg"
				/>
			</div>
		</>
	)
}
