<script setup>
import { ref, onMounted } from "vue";
import { usePathFinder } from "@/composable/usePathFinder.js";

// Canvas refs
const mainCanvas = ref(null);
const miniMapCanvas = ref(null);
const miniMapFog = ref(null);

// Initialize the HYDROBOT system
const {
	// Initialization
	initializeThreeJS,

	// Patterns and modes
	patterns,
	currentPattern,
	modes,
	currentMode,
	togglePattern,
	toggleMode,

	// Environment controls
	poolSize,
	waterDepth,
	waterTurbidity,
	increasePoolSize,
	decreasePoolSize,
	resetSimulation,

	// Robot controls
	robotSpeed,
	divingSpeed,
	ballastLevel,
	currentDepth,
	maxDiveDepth,
	manualControl,
	emergencyDive,
	emergencySurface,

	// Sensors
	sonarRadius,
	sonarNumRays,
	thermalRadius,
	thermalData,
	sonarData,

	// Detection and mission
	heatDetected,
	detectedHeatTypes,
	heatTypes,
	numVictims,
	numDebris,
	spawnMoreVictims,
	spawnMoreDebris,
	victimsFound,
	areaSearched,
	missionStatus,

	// Status
	batteryLevel,
	waterTemperature,
	oxygenLevel,

	// Display
	cameraMode,
	toggleCameraMode,
	texturesEnabled,
} = usePathFinder(mainCanvas, miniMapCanvas, miniMapFog);

// Keyboard controls for manual mode
onMounted(() => {
	// Set up keyboard controls
	window.addEventListener("keydown", (e) => {
		if (currentMode.value === "manual") {
			switch (e.key.toLowerCase()) {
				case "w":
					manualControl.forward = true;
					break;
				case "s":
					manualControl.backward = true;
					break;
				case "a":
					manualControl.left = true;
					break;
				case "d":
					manualControl.right = true;
					break;
				case "q":
					manualControl.dive = true;
					break;
				case "e":
					manualControl.surface = true;
					break;
			}
		}
	});

	window.addEventListener("keyup", (e) => {
		if (currentMode.value === "manual") {
			switch (e.key.toLowerCase()) {
				case "w":
					manualControl.forward = false;
					break;
				case "s":
					manualControl.backward = false;
					break;
				case "a":
					manualControl.left = false;
					break;
				case "d":
					manualControl.right = false;
					break;
				case "q":
					manualControl.dive = false;
					break;
				case "e":
					manualControl.surface = false;
					break;
			}
		}
	});

	// Ensure Three.js initialization after DOM is ready
	setTimeout(() => {
		if (mainCanvas.value && miniMapCanvas.value && miniMapFog.value) {
			console.log("Canvas elements ready, initializing Three.js...");
			initializeThreeJS();
		} else {
			console.warn("Canvas elements not ready yet");
		}
	}, 200);
});
</script>

<template>
	<div class="hydrobot-simulation">
		<!-- Header -->
		<header class="simulation-header">
			<h1 class="title">🌊 HYDROBOT Flood Rescue Simulation</h1>
			<p class="subtitle">
				Real-Time Thermal Detection & Underwater Search Robot
			</p>
		</header>

		<!-- Main Layout -->
		<div class="simulation-layout">
			<!-- Control Panel -->
			<div class="control-panel">
				<div class="panel-section">
					<h3>🤖 Robot Control</h3>

					<!-- Mode Selection -->
					<div class="control-group">
						<label>Operation Mode:</label>
						<button
							@click="toggleMode"
							class="mode-btn"
							:class="currentMode"
						>
							{{ currentMode.toUpperCase() }}
						</button>
					</div>

					<!-- Search Pattern -->
					<div class="control-group">
						<label>Search Pattern:</label>
						<button @click="togglePattern" class="pattern-btn">
							{{ currentPattern.replace("-", " ").toUpperCase() }}
						</button>
					</div>

					<!-- Camera Mode -->
					<div class="control-group">
						<label>Camera View:</label>
						<button @click="toggleCameraMode" class="camera-btn">
							{{ cameraMode.toUpperCase() }}
						</button>
					</div>
				</div>

				<!-- Environment Controls -->
				<div class="panel-section">
					<h3>🌊 Environment</h3>

					<div class="control-group">
						<label>Pool Size: {{ poolSize }}m</label>
						<div class="btn-group">
							<button @click="decreasePoolSize" class="btn-small">
								-
							</button>
							<button @click="increasePoolSize" class="btn-small">
								+
							</button>
						</div>
					</div>

					<div class="control-group">
						<label
							>Water Turbidity:
							{{ Math.round(waterTurbidity * 100) }}%</label
						>
						<input
							type="range"
							v-model="waterTurbidity"
							min="0"
							max="1"
							step="0.1"
							class="slider"
						/>
					</div>

					<div class="control-group">
						<label>Victims: {{ numVictims }}</label>
						<div class="btn-group">
							<button
								@click="
									numVictims = Math.max(1, numVictims - 1)
								"
								class="btn-small"
							>
								-
							</button>
							<button @click="spawnMoreVictims" class="btn-small">
								Respawn
							</button>
							<button @click="numVictims++" class="btn-small">
								+
							</button>
						</div>
					</div>

					<div class="control-group">
						<label>Debris: {{ numDebris }}</label>
						<div class="btn-group">
							<button
								@click="numDebris = Math.max(0, numDebris - 1)"
								class="btn-small"
							>
								-
							</button>
							<button @click="spawnMoreDebris" class="btn-small">
								Respawn
							</button>
							<button @click="numDebris++" class="btn-small">
								+
							</button>
						</div>
					</div>
				</div>

				<!-- Robot Status -->
				<div class="panel-section">
					<h3>📊 Robot Status</h3>

					<div class="status-item">
						<span>Battery:</span>
						<div class="status-bar">
							<div
								class="status-fill battery"
								:style="{ width: batteryLevel + '%' }"
								:class="{
									low: batteryLevel < 30,
									critical: batteryLevel < 15,
								}"
							></div>
							<span class="status-text"
								>{{ Math.round(batteryLevel) }}%</span
							>
						</div>
					</div>

					<div class="status-item">
						<span>Depth:</span>
						<div class="status-bar">
							<div
								class="status-fill depth"
								:style="{
									width:
										(currentDepth / maxDiveDepth) * 100 +
										'%',
								}"
							></div>
							<span class="status-text"
								>{{ currentDepth.toFixed(1) }}m</span
							>
						</div>
					</div>

					<div class="status-item">
						<span>Ballast:</span>
						<div class="status-bar">
							<div
								class="status-fill ballast"
								:style="{ width: ballastLevel * 100 + '%' }"
							></div>
							<span class="status-text"
								>{{ Math.round(ballastLevel * 100) }}%</span
							>
						</div>
					</div>

					<div class="status-item">
						<span>Water Temp:</span>
						<span class="status-value"
							>{{ waterTemperature }}°C</span
						>
					</div>
				</div>

				<!-- Emergency Controls -->
				<div class="panel-section emergency">
					<h3>🚨 Emergency Controls</h3>
					<button @click="emergencyDive" class="emergency-btn dive">
						EMERGENCY DIVE
					</button>
					<button
						@click="emergencySurface"
						class="emergency-btn surface"
					>
						EMERGENCY SURFACE
					</button>
					<button
						@click="resetSimulation"
						class="emergency-btn reset"
					>
						RESET SIMULATION
					</button>
				</div>

				<!-- Manual Controls -->
				<div
					v-if="currentMode === 'manual'"
					class="panel-section manual-controls"
				>
					<h3>🎮 Manual Controls</h3>
					<div class="control-instructions">
						<p>
							<strong>WASD:</strong> Move Forward/Back/Left/Right
						</p>
						<p><strong>Q/E:</strong> Dive/Surface</p>
					</div>

					<div class="manual-buttons">
						<div class="movement-grid">
							<button
								@mousedown="manualControl.forward = true"
								@mouseup="manualControl.forward = false"
								class="move-btn"
							>
								↑
							</button>
							<div class="middle-row">
								<button
									@mousedown="manualControl.left = true"
									@mouseup="manualControl.left = false"
									class="move-btn"
								>
									←
								</button>
								<button
									@mousedown="manualControl.right = true"
									@mouseup="manualControl.right = false"
									class="move-btn"
								>
									→
								</button>
							</div>
							<button
								@mousedown="manualControl.backward = true"
								@mouseup="manualControl.backward = false"
								class="move-btn"
							>
								↓
							</button>
						</div>
						<div class="depth-controls">
							<button
								@mousedown="manualControl.dive = true"
								@mouseup="manualControl.dive = false"
								class="depth-btn dive"
							>
								DIVE
							</button>
							<button
								@mousedown="manualControl.surface = true"
								@mouseup="manualControl.surface = false"
								class="depth-btn surface"
							>
								SURFACE
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Main Display Area -->
			<div class="display-area">
				<!-- Mission Status -->
				<div class="mission-status">
					<div class="status-header">
						<h2>{{ missionStatus }}</h2>
						<div class="mission-stats">
							<span class="stat"
								>Victims Found: {{ victimsFound }}</span
							>
							<span class="stat"
								>Area Searched:
								{{ Math.round(areaSearched) }}%</span
							>
							<span
								class="stat"
								:class="{ 'heat-detected': heatDetected }"
							>
								Heat Detection:
								{{ heatDetected ? "ACTIVE" : "SCANNING" }}
							</span>
						</div>
					</div>
				</div>

				<!-- Main 3D View -->
				<div class="main-viewport">
					<canvas ref="mainCanvas" class="main-canvas"></canvas>
					<div class="viewport-overlay">
						<div class="camera-info">
							<span>{{ cameraMode.toUpperCase() }} VIEW</span>
							<div
								v-if="cameraMode === 'thermal'"
								class="thermal-overlay"
							>
								<span class="thermal-indicator"
									>🌡️ THERMAL ACTIVE</span
								>
							</div>
						</div>
					</div>
				</div>

				<!-- Minimap and Detection Info -->
				<div class="info-panel">
					<div class="minimap-container">
						<h4>Minimap</h4>
						<div class="minimap-wrapper">
							<canvas
								ref="miniMapCanvas"
								class="minimap"
							></canvas>
							<canvas
								ref="miniMapFog"
								class="minimap-fog"
							></canvas>
						</div>
					</div>

					<!-- Heat Detection Panel -->
					<div class="detection-panel">
						<h4>Heat Signatures Detected</h4>
						<div
							v-if="detectedHeatTypes.length === 0"
							class="no-detections"
						>
							No heat signatures detected yet...
						</div>
						<div v-else class="detections-list">
							<div
								v-for="detection in detectedHeatTypes"
								:key="detection.name"
								class="detection-item"
								:class="{ priority: detection.priority }"
							>
								<div
									class="detection-color"
									:style="{
										backgroundColor: `#${detection.color
											.toString(16)
											.padStart(6, '0')}`,
									}"
								></div>
								<div class="detection-info">
									<strong>{{ detection.name }}</strong>
									<p>{{ detection.description }}</p>
									<span class="temp"
										>{{ detection.temp }}°C</span
									>
									<span
										v-if="detection.priority"
										class="priority-badge"
										>Priority {{ detection.priority }}</span
									>
								</div>
							</div>
						</div>
					</div>

					<!-- Sensor Data -->
					<div class="sensor-panel">
						<h4>Sensor Data</h4>
						<div class="sensor-info">
							<div class="sensor-item">
								<span>Thermal Range:</span>
								<span>{{ thermalRadius }}m</span>
							</div>
							<div class="sensor-item">
								<span>Sonar Range:</span>
								<span>{{ sonarRadius }}m</span>
							</div>
							<div class="sensor-item">
								<span>Sonar Rays:</span>
								<span>{{ sonarNumRays }}</span>
							</div>
							<div class="sensor-item">
								<span>Max Dive Depth:</span>
								<span>{{ maxDiveDepth }}m</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.hydrobot-simulation {
	min-height: 100vh;
	background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
	color: white;
	font-family: "Arial", sans-serif;
}

.simulation-header {
	text-align: center;
	padding: 20px;
	background: rgba(0, 0, 0, 0.3);
	border-bottom: 2px solid #00ccff;
}

.title {
	font-size: 2.5rem;
	margin: 0;
	text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.subtitle {
	font-size: 1.1rem;
	margin: 10px 0 0 0;
	color: #b3d9ff;
}

.simulation-layout {
	display: flex;
	gap: 20px;
	padding: 20px;
	height: calc(100vh - 140px);
}

.control-panel {
	width: 350px;
	background: rgba(0, 0, 0, 0.4);
	border-radius: 10px;
	padding: 20px;
	overflow-y: auto;
	border: 1px solid #00ccff;
}

.panel-section {
	margin-bottom: 25px;
	padding-bottom: 20px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.panel-section h3 {
	margin: 0 0 15px 0;
	color: #00ccff;
	font-size: 1.2rem;
}

.control-group {
	margin-bottom: 15px;
}

.control-group label {
	display: block;
	margin-bottom: 5px;
	font-weight: bold;
}

.mode-btn,
.pattern-btn,
.camera-btn {
	width: 100%;
	padding: 10px;
	border: none;
	border-radius: 5px;
	font-weight: bold;
	cursor: pointer;
	transition: all 0.3s ease;
}

.mode-btn {
	background: #28a745;
	color: white;
}

.mode-btn.manual {
	background: #ffc107;
	color: black;
}

.mode-btn.rescue-mode {
	background: #dc3545;
	color: white;
}

.mode-btn.deep-search {
	background: #6f42c1;
	color: white;
}

.pattern-btn {
	background: #17a2b8;
	color: white;
}

.camera-btn {
	background: #fd7e14;
	color: white;
}

.btn-group {
	display: flex;
	gap: 5px;
}

.btn-small {
	padding: 8px 12px;
	border: none;
	border-radius: 4px;
	background: #6c757d;
	color: white;
	cursor: pointer;
	font-weight: bold;
}

.btn-small:hover {
	background: #5a6268;
}

.slider {
	width: 100%;
	margin: 5px 0;
}

.status-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 10px;
}

.status-bar {
	position: relative;
	width: 60%;
	height: 20px;
	background: rgba(255, 255, 255, 0.2);
	border-radius: 10px;
	overflow: hidden;
}

.status-fill {
	height: 100%;
	transition: width 0.3s ease;
	border-radius: 10px;
}

.status-fill.battery {
	background: #28a745;
}

.status-fill.battery.low {
	background: #ffc107;
}

.status-fill.battery.critical {
	background: #dc3545;
}

.status-fill.depth {
	background: #17a2b8;
}

.status-fill.ballast {
	background: #6f42c1;
}

.status-text {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	font-size: 0.8rem;
	font-weight: bold;
	color: white;
	text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.status-value {
	font-weight: bold;
	color: #00ccff;
}

.emergency {
	border: 2px solid #dc3545;
	border-radius: 8px;
	padding: 15px;
	background: rgba(220, 53, 69, 0.1);
}

.emergency-btn {
	width: 100%;
	padding: 12px;
	margin-bottom: 10px;
	border: none;
	border-radius: 5px;
	font-weight: bold;
	cursor: pointer;
	transition: all 0.3s ease;
}

.emergency-btn.dive {
	background: #007bff;
	color: white;
}

.emergency-btn.surface {
	background: #28a745;
	color: white;
}

.emergency-btn.reset {
	background: #dc3545;
	color: white;
}

.emergency-btn:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.manual-controls {
	border: 2px solid #ffc107;
	border-radius: 8px;
	padding: 15px;
	background: rgba(255, 193, 7, 0.1);
}

.control-instructions {
	margin-bottom: 15px;
	font-size: 0.9rem;
}

.control-instructions p {
	margin: 5px 0;
	color: #b3d9ff;
}

.movement-grid {
	display: grid;
	grid-template-rows: 1fr 1fr 1fr;
	gap: 5px;
	margin-bottom: 10px;
}

.middle-row {
	display: flex;
	justify-content: space-between;
}

.move-btn {
	padding: 15px;
	border: none;
	border-radius: 5px;
	background: #6c757d;
	color: white;
	font-size: 1.2rem;
	cursor: pointer;
	user-select: none;
}

.move-btn:active {
	background: #5a6268;
	transform: scale(0.95);
}

.depth-controls {
	display: flex;
	gap: 10px;
}

.depth-btn {
	flex: 1;
	padding: 12px;
	border: none;
	border-radius: 5px;
	font-weight: bold;
	cursor: pointer;
	user-select: none;
}

.depth-btn.dive {
	background: #007bff;
	color: white;
}

.depth-btn.surface {
	background: #28a745;
	color: white;
}

.depth-btn:active {
	transform: scale(0.95);
}

.display-area {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.mission-status {
	background: rgba(0, 0, 0, 0.4);
	border-radius: 10px;
	padding: 20px;
	border: 1px solid #00ccff;
}

.status-header h2 {
	margin: 0 0 10px 0;
	color: #00ccff;
	font-size: 1.5rem;
}

.mission-stats {
	display: flex;
	gap: 30px;
	flex-wrap: wrap;
}

.stat {
	font-weight: bold;
	padding: 5px 10px;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 5px;
}

.stat.heat-detected {
	background: rgba(255, 0, 0, 0.3);
	color: #ff6666;
	animation: pulse 2s infinite;
}

@keyframes pulse {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.6;
	}
}

.main-viewport {
	position: relative;
	flex: 1;
	background: rgba(0, 0, 0, 0.4);
	border-radius: 10px;
	overflow: hidden;
	border: 1px solid #00ccff;
}

.main-canvas {
	width: 100%;
	height: 100%;
	display: block;
}

.viewport-overlay {
	position: absolute;
	top: 10px;
	left: 10px;
	background: rgba(0, 0, 0, 0.7);
	padding: 10px;
	border-radius: 5px;
	border: 1px solid #00ccff;
}

.camera-info {
	color: #00ccff;
	font-weight: bold;
}

.thermal-overlay {
	margin-top: 5px;
}

.thermal-indicator {
	color: #ff6600;
	animation: pulse 1.5s infinite;
}

.info-panel {
	display: flex;
	gap: 20px;
	height: 300px;
}

.minimap-container,
.detection-panel,
.sensor-panel {
	flex: 1;
	background: rgba(0, 0, 0, 0.4);
	border-radius: 10px;
	padding: 15px;
	border: 1px solid #00ccff;
}

.minimap-container h4,
.detection-panel h4,
.sensor-panel h4 {
	margin: 0 0 15px 0;
	color: #00ccff;
}

.minimap-wrapper {
	position: relative;
	width: 100%;
	height: 200px;
}

.minimap,
.minimap-fog {
	position: absolute;
	width: 100%;
	height: 100%;
	border-radius: 5px;
}

.minimap-fog {
	pointer-events: none;
}

.no-detections {
	color: #999;
	font-style: italic;
	text-align: center;
	padding: 20px;
}

.detections-list {
	max-height: 200px;
	overflow-y: auto;
}

.detection-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px;
	margin-bottom: 10px;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 5px;
	border-left: 4px solid transparent;
}

.detection-item.priority {
	border-left-color: #ff0000;
	background: rgba(255, 0, 0, 0.1);
}

.detection-color {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	border: 2px solid white;
}

.detection-info {
	flex: 1;
}

.detection-info strong {
	display: block;
	color: #00ccff;
}

.detection-info p {
	margin: 5px 0;
	font-size: 0.9rem;
	color: #b3d9ff;
}

.temp {
	font-weight: bold;
	color: #ff6600;
}

.priority-badge {
	background: #dc3545;
	color: white;
	padding: 2px 6px;
	border-radius: 3px;
	font-size: 0.8rem;
	font-weight: bold;
	margin-left: 10px;
}

.sensor-info {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.sensor-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 5px;
}

.sensor-item span:last-child {
	font-weight: bold;
	color: #00ccff;
}

/* Responsive design */
@media (max-width: 1200px) {
	.simulation-layout {
		flex-direction: column;
	}

	.control-panel {
		width: 100%;
	}

	.info-panel {
		flex-direction: column;
		height: auto;
	}
}
</style>
