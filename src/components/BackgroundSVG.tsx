/**
 * BackgroundSVG - Stylized, performant dark marble stain SVG background (First Version).
 * Uses organic marble stain paths, vein flows, and pure SVG fractal noise texture.
 */
export function BackgroundSVG() {
	return (
		<div className="svg-bg-container" aria-hidden="true">
			<svg
				className="svg-bg-element"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 1440 900"
				preserveAspectRatio="xMidYMid slice"
				role="img"
				aria-label="Dark marble background texture"
			>
				<defs>
					{/* Marble fractal noise texture filter */}
					<filter
						id="marble-grain"
						x="0%"
						y="0%"
						width="100%"
						height="100%"
						filterUnits="objectBoundingBox"
					>
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.018 0.009"
							numOctaves="4"
							seed="35"
							result="noise"
						/>
						<feColorMatrix
							type="matrix"
							values="
								0 0 0 0 0.05
								0 0 0 0 0.10
								0 0 0 0 0.20
								0 0 0 0.08 0"
							result="coloredNoise"
						/>
						<feComposite operator="in" in2="SourceGraphic" />
					</filter>

					{/* Subtle displacement for organic edge deformation */}
					<filter id="organic-distortion">
						<feTurbulence
							type="turbulence"
							baseFrequency="0.006 0.012"
							numOctaves="3"
							seed="88"
							result="distortionNoise"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="distortionNoise"
							scale="35"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
					</filter>

					{/* Elegant Navy Marble Stain Gradients */}
					<linearGradient id="stain-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#0b1730" stopOpacity="0.9" />
						<stop offset="45%" stopColor="#14284d" stopOpacity="0.75" />
						<stop offset="85%" stopColor="#0a1224" stopOpacity="0.95" />
					</linearGradient>

					<linearGradient
						id="stain-grad-2"
						x1="100%"
						y1="10%"
						x2="10%"
						y2="90%"
					>
						<stop offset="0%" stopColor="#16305a" stopOpacity="0.65" />
						<stop offset="50%" stopColor="#0e1f3d" stopOpacity="0.8" />
						<stop offset="100%" stopColor="#122547" stopOpacity="0.4" />
					</linearGradient>

					<radialGradient id="stain-grad-3" cx="70%" cy="30%" r="65%">
						<stop offset="0%" stopColor="#1e3e70" stopOpacity="0.45" />
						<stop offset="50%" stopColor="#102344" stopOpacity="0.3" />
						<stop offset="100%" stopColor="#080e1b" stopOpacity="0" />
					</radialGradient>

					<linearGradient id="vein-grad" x1="0%" y1="0%" x2="100%" y2="80%">
						<stop offset="0%" stopColor="#305a96" stopOpacity="0.35" />
						<stop offset="50%" stopColor="#477ac2" stopOpacity="0.25" />
						<stop offset="100%" stopColor="#1b3666" stopOpacity="0.05" />
					</linearGradient>

					<linearGradient
						id="gold-accent-vein"
						x1="100%"
						y1="0%"
						x2="0%"
						y2="100%"
					>
						<stop offset="0%" stopColor="#688cb8" stopOpacity="0.2" />
						<stop offset="40%" stopColor="#3d689e" stopOpacity="0.15" />
						<stop offset="100%" stopColor="#142647" stopOpacity="0.02" />
					</linearGradient>
				</defs>

				{/* 1. Deep Navy Base Background */}
				<rect width="100%" height="100%" fill="#080e1a" />

				{/* 2. Organic Marble Stain Layers ("Manchas") with distortion filter */}
				<g filter="url(#organic-distortion)">
					{/* Major diagonal marble stain flow */}
					<path
						d="M -120 -80 
						   C 220 80, 480 -120, 850 140 
						   C 1180 370, 920 620, 1380 720 
						   C 1620 780, 1680 580, 1750 980 
						   L 1750 -120 Z"
						fill="url(#stain-grad-1)"
					/>

					{/* Counter marble stain mass (bottom-left to top-center) */}
					<path
						d="M -150 420 
						   C 280 380, 360 780, 720 650 
						   C 1080 520, 1150 920, 1580 820 
						   C 1720 790, 1780 1020, 1780 1100 
						   L -150 1100 Z"
						fill="url(#stain-grad-2)"
						style={{ mixBlendMode: 'screen' }}
					/>

					{/* Secondary mineral stain patch */}
					<path
						d="M 650 -100 
						   C 820 150, 1250 80, 1450 350 
						   C 1620 580, 1320 820, 1680 1020 
						   L 1780 -100 Z"
						fill="url(#stain-grad-3)"
						style={{ mixBlendMode: 'lighten' }}
					/>
				</g>

				{/* 3. Intricate Marble Vein Lines (Veias de mármore) */}
				<g opacity="0.85">
					<path
						d="M -50 120 
						   Q 180 220, 340 160 
						   T 720 380 
						   T 1120 480 
						   T 1520 860"
						fill="none"
						stroke="url(#vein-grad)"
						strokeWidth="2.5"
						strokeLinecap="round"
					/>
					{/* Branching vein 1 */}
					<path
						d="M 340 160 Q 460 310, 680 320 T 940 580"
						fill="none"
						stroke="url(#vein-grad)"
						strokeWidth="1.2"
						strokeDasharray="400 5"
					/>

					{/* Secondary vein network across right side */}
					<path
						d="M 850 -50 
						   Q 1020 180, 1240 280 
						   T 1390 620 
						   T 1650 820"
						fill="none"
						stroke="url(#gold-accent-vein)"
						strokeWidth="2"
					/>
					{/* Fine hairline marble cracks/veins */}
					<path
						d="M 1240 280 Q 1400 390, 1580 340"
						fill="none"
						stroke="url(#gold-accent-vein)"
						strokeWidth="1"
					/>

					{/* Lower left vein structure */}
					<path
						d="M -20 680 
						   Q 220 620, 480 780 
						   T 890 850 
						   T 1320 1020"
						fill="none"
						stroke="url(#vein-grad)"
						strokeWidth="1.8"
					/>
				</g>

				{/* 4. Fine Marble Mineral Grain Overlay */}
				<rect
					width="100%"
					height="100%"
					filter="url(#marble-grain)"
					style={{ mixBlendMode: 'overlay', opacity: 0.7 }}
				/>

				{/* 5. Soft Ambient Vignette for Reading Comfort */}
				<radialGradient id="vignette" cx="50%" cy="50%" r="70%">
					<stop offset="40%" stopColor="#000000" stopOpacity="0" />
					<stop offset="100%" stopColor="#04070e" stopOpacity="0.65" />
				</radialGradient>
				<rect
					width="100%"
					height="100%"
					fill="url(#vignette)"
					pointerEvents="none"
				/>
			</svg>
		</div>
	)
}
