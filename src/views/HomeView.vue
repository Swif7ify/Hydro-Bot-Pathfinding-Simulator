<script setup>
import { ref, onMounted, computed } from "vue";
import { usePathFinder } from "@/composable/usePathFinder.js";

// Canvas refs
const mainCanvas = ref(null);
const miniMapCanvas = ref(null);
const miniMapFog = ref(null);

// UI State
const controlPanelOpen = ref(false);
const activeDetection = ref(null);
const detectionAnimation = ref(false);

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

	// Robot position
	getRobotPosition,

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

// Computed properties for UI
const batteryStatus = computed(() => {
	if (batteryLevel.value < 15) return "critical";
	if (batteryLevel.value < 30) return "low";
	return "normal";
});

const depthPercentage = computed(() => {
	return (currentDepth.value / maxDiveDepth.value) * 100;
});

// Watch for new detections
let lastDetectionCount = 0;
setInterval(() => {
	if (detectedHeatTypes.value.length > lastDetectionCount) {
		// New detection!
		activeDetection.value =
			detectedHeatTypes.value[detectedHeatTypes.value.length - 1];
		detectionAnimation.value = true;
		setTimeout(() => {
			detectionAnimation.value = false;
		}, 3000);
		lastDetectionCount = detectedHeatTypes.value.length;
	}
}, 100);

// Keyboard controls for manual mode
onMounted(() => {
	// Set up keyboard controls
	window.addEventListener("keydown", (e) => {
		// Toggle control panel with Tab
		if (e.key === "Tab") {
			e.preventDefault();
			controlPanelOpen.value = !controlPanelOpen.value;
		}

		if (currentMode.value === "manual") {
			switch (e.key.toLowerCase()) {
				case "w":
					manualControl.value.forward = true;
					break;
				case "s":
					manualControl.value.backward = true;
					break;
				case "a":
					manualControl.value.left = true;
					break;
				case "d":
					manualControl.value.right = true;
					break;
				case "q":
					manualControl.value.dive = true;
					break;
				case "e":
					manualControl.value.surface = true;
					break;
			}
		}
	});

	window.addEventListener("keyup", (e) => {
		if (currentMode.value === "manual") {
			switch (e.key.toLowerCase()) {
				case "w":
					manualControl.value.forward = false;
					break;
				case "s":
					manualControl.value.backward = false;
					break;
				case "a":
					manualControl.value.left = false;
					break;
				case "d":
					manualControl.value.right = false;
					break;
				case "q":
					manualControl.value.dive = false;
					break;
				case "e":
					manualControl.value.surface = false;
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
	<div class="hydrobot-hud">
		<!-- Main 3D Viewport (Full Screen) -->
		<canvas ref="mainCanvas" class="main-viewport"></canvas>

		<!-- HUD Overlay -->
		<div class="hud-overlay">
			<!-- Top Bar -->
			<div class="top-bar">
				<div class="mission-status">
					<div class="status-text">{{ missionStatus }}</div>
					<div class="status-indicators">
						<span class="indicator"
							>VICTIMS: {{ victimsFound }}</span
						>
						<span class="indicator"
							>AREA: {{ Math.round(areaSearched) }}%</span
						>
						<span
							class="indicator"
							:class="{ active: heatDetected }"
						>
							{{ heatDetected ? "HEAT DETECTED" : "SCANNING" }}
						</span>
					</div>
				</div>
			</div>

			<!-- Control Panel Toggle -->
			<button
				@click="controlPanelOpen = !controlPanelOpen"
				class="control-toggle"
				:class="{ open: controlPanelOpen }"
			>
				<span>{{ controlPanelOpen ? "◀" : "▶" }}</span>
				<span class="toggle-text">CONTROLS</span>
			</button>

			<!-- Control Panel (Slide-out) -->
			<div class="control-panel" :class="{ open: controlPanelOpen }">
				<div class="panel-header">
					<h3>HYDROBOT CONTROL</h3>
				</div>

				<!-- Quick Actions -->
				<div class="quick-actions">
					<button
						@click="toggleMode"
						class="action-btn"
						:class="currentMode"
					>
						{{ currentMode.toUpperCase() }}
					</button>
					<button @click="togglePattern" class="action-btn pattern">
						{{ currentPattern.replace("-", " ").toUpperCase() }}
					</button>
					<button @click="toggleCameraMode" class="action-btn camera">
						{{ cameraMode.toUpperCase() }}
					</button>
				</div>

				<!-- Robot Status -->
				<div class="status-section">
					<h4>SYSTEM STATUS</h4>

					<div class="status-item">
						<label>BATTERY</label>
						<div class="status-bar-container">
							<div class="status-bar" :class="batteryStatus">
								<div
									class="status-fill"
									:style="{ width: batteryLevel + '%' }"
								></div>
							</div>
							<span class="status-value"
								>{{ Math.round(batteryLevel) }}%</span
							>
						</div>
					</div>

					<div class="status-item">
						<label>DEPTH</label>
						<div class="status-bar-container">
							<div class="status-bar">
								<div
									class="status-fill depth"
									:style="{ width: depthPercentage + '%' }"
								></div>
							</div>
							<span class="status-value"
								>{{ currentDepth.toFixed(1) }}m</span
							>
						</div>
					</div>

					<div class="status-item">
						<label>BALLAST</label>
						<div class="status-bar-container">
							<div class="status-bar">
								<div
									class="status-fill ballast"
									:style="{ width: ballastLevel * 100 + '%' }"
								></div>
							</div>
							<span class="status-value"
								>{{ Math.round(ballastLevel * 100) }}%</span
							>
						</div>
					</div>

					<div class="status-grid">
						<div class="status-cell">
							<label>WATER TEMP</label>
							<span>{{ waterTemperature }}°C</span>
						</div>
						<div class="status-cell">
							<label>O2 LEVEL</label>
							<span>{{ oxygenLevel }}%</span>
						</div>
					</div>
				</div>

				<!-- Environment Controls -->
				<div class="control-section">
					<h4>ENVIRONMENT</h4>

					<div class="control-row">
						<label>Pool Size</label>
						<div class="control-buttons">
							<button @click="decreasePoolSize" class="ctrl-btn">
								-
							</button>
							<span class="value">{{ poolSize }}m</span>
							<button @click="increasePoolSize" class="ctrl-btn">
								+
							</button>
						</div>
					</div>

					<div class="control-row">
						<label>Turbidity</label>
						<input
							type="range"
							v-model="waterTurbidity"
							min="0"
							max="1"
							step="0.1"
							class="slider"
						/>
						<span class="value"
							>{{ Math.round(waterTurbidity * 100) }}%</span
						>
					</div>

					<div class="control-row">
						<label>Victims</label>
						<div class="control-buttons">
							<button
								@click="
									numVictims = Math.max(1, numVictims - 1)
								"
								class="ctrl-btn"
							>
								-
							</button>
							<span class="value">{{ numVictims }}</span>
							<button @click="spawnMoreVictims" class="ctrl-btn">
								SPAWN
							</button>
						</div>
					</div>

					<div class="control-row">
						<label>Debris</label>
						<div class="control-buttons">
							<button
								@click="numDebris = Math.max(0, numDebris - 1)"
								class="ctrl-btn"
							>
								-
							</button>
							<span class="value">{{ numDebris }}</span>
							<button @click="spawnMoreDebris" class="ctrl-btn">
								SPAWN
							</button>
						</div>
					</div>
				</div>

				<!-- Emergency Controls -->
				<div class="emergency-section">
					<h4>EMERGENCY</h4>
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
						RESET SYSTEM
					</button>
				</div>

				<!-- Manual Controls (when in manual mode) -->
				<div v-if="currentMode === 'manual'" class="manual-section">
					<h4>MANUAL CONTROL</h4>
					<div class="control-hint">
						Use WASD to move, Q/E to dive/surface
					</div>
				</div>
			</div>

			<!-- Minimap (Top Right) -->
			<div class="minimap-container">
				<div class="minimap-header">TACTICAL MAP</div>
				<div class="minimap-wrapper">
					<canvas ref="miniMapCanvas" class="minimap"></canvas>
					<canvas ref="miniMapFog" class="minimap-fog"></canvas>
				</div>
				<div class="minimap-coords">
					<span
						>X:
						{{ getRobotPosition().x?.toFixed(1) || "0.0" }}</span
					>
					<span
						>Z:
						{{ getRobotPosition().z?.toFixed(1) || "0.0" }}</span
					>
				</div>
			</div>

			<!-- Heat Signature Detection Panel (Bottom) -->
			<div
				class="detection-panel"
				:class="{ active: detectedHeatTypes.length > 0 }"
			>
				<!-- Active Detection Alert -->
				<div
					v-if="detectionAnimation && activeDetection"
					class="detection-alert"
				>
					<div class="alert-header">NEW HEAT SIGNATURE DETECTED</div>
					<div class="alert-content">
						<div class="detection-type">
							{{ activeDetection.name }}
						</div>
						<div class="detection-temp">
							{{ activeDetection.temp }}°C
						</div>
					</div>
				</div>

				<!-- Detection List -->
				<div class="detections-container">
					<div class="detections-header">
						<span class="header-text">HEAT SIGNATURES</span>
						<span class="header-count">{{
							detectedHeatTypes.length
						}}</span>
					</div>

					<div class="detections-grid">
						<div
							v-for="(detection, index) in detectedHeatTypes"
							:key="detection.name"
							class="detection-card"
							:class="{ priority: detection.priority <= 2 }"
						>
							<div class="detection-index">#{{ index + 1 }}</div>
							<div
								class="detection-indicator"
								:style="{
									backgroundColor: `#${detection.color
										.toString(16)
										.padStart(6, '0')}`,
								}"
							></div>
							<div class="detection-data">
								<div class="detection-name">
									{{ detection.name }}
								</div>
								<div class="detection-info">
									<span class="temp-reading"
										>{{ detection.temp }}°C</span
									>
									<span
										v-if="detection.priority"
										class="priority-level"
									>
										P{{ detection.priority }}
									</span>
								</div>
								<div class="detection-desc">
									{{ detection.description }}
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Sensor Status -->
				<div class="sensor-status">
					<div class="sensor-item">
						<span class="sensor-label">THERMAL</span>
						<span class="sensor-value">{{ thermalRadius }}m</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">SONAR</span>
						<span class="sensor-value">{{ sonarRadius }}m</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">MAX DEPTH</span>
						<span class="sensor-value">{{ maxDiveDepth }}m</span>
					</div>
				</div>
			</div>

			<!-- Camera Mode Indicator -->
			<div class="camera-indicator">
				<span class="camera-mode"
					>{{ cameraMode.toUpperCase() }} MODE</span
				>
				<span v-if="cameraMode === 'thermal'" class="thermal-active"
					>🔥 THERMAL ACTIVE</span
				>
			</div>

			<!-- Depth Indicator (Right Side) -->
			<div class="depth-indicator">
				<div class="depth-label">DEPTH</div>
				<div class="depth-meter">
					<div class="depth-scale">
						<span>0m</span>
						<span>{{ maxDiveDepth / 2 }}m</span>
						<span>{{ maxDiveDepth }}m</span>
					</div>
					<div class="depth-bar">
						<div
							class="depth-marker"
							:style="{ top: depthPercentage + '%' }"
						></div>
					</div>
				</div>
				<div class="depth-value">{{ currentDepth.toFixed(1) }}m</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.hydrobot-hud {
	position: relative;
	width: 100vw;
	height: 100vh;
	overflow: hidden;
	background: #000;
}

.main-viewport {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
}

.hud-overlay {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	z-index: 2;
}

.hud-overlay > * {
	pointer-events: auto;
}

/* Top Bar */
.top-bar {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent);
	padding: 20px;
	display: flex;
	justify-content: center;
}

.mission-status {
	text-align: center;
}

.status-text {
	font-size: 24px;
	font-weight: bold;
	color: #00ffff;
	text-transform: uppercase;
	letter-spacing: 2px;
	margin-bottom: 10px;
	text-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
}

.status-indicators {
	display: flex;
	gap: 30px;
	justify-content: center;
}

.indicator {
	color: #fff;
	font-size: 14px;
	padding: 5px 15px;
	background: rgba(0, 255, 255, 0.1);
	border: 1px solid rgba(0, 255, 255, 0.3);
	border-radius: 20px;
	text-transform: uppercase;
	letter-spacing: 1px;
}

.indicator.active {
	background: rgba(255, 0, 0, 0.2);
	border-color: rgba(255, 0, 0, 0.5);
	color: #ff6666;
	animation: pulse 1s infinite;
}

/* Control Panel Toggle */
.control-toggle {
	position: absolute;
	left: 0;
	top: 50%;
	transform: translateY(-50%);
	background: rgba(0, 255, 255, 0.1);
	border: 1px solid rgba(0, 255, 255, 0.3);
	border-left: none;
	border-radius: 0 10px 10px 0;
	padding: 20px 10px;
	color: #00ffff;
	cursor: pointer;
	transition: all 0.3s ease;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;
}

.control-toggle:hover {
	background: rgba(0, 255, 255, 0.2);
	padding-right: 15px;
}

.control-toggle.open {
	transform: translateY(-50%) translateX(350px);
}

.toggle-text {
	writing-mode: vertical-rl;
	text-orientation: mixed;
	font-size: 12px;
	letter-spacing: 2px;
	text-transform: uppercase;
}

/* Control Panel */
.control-panel {
	position: absolute;
	left: -350px;
	top: 0;
	bottom: 0;
	width: 350px;
	background: rgba(0, 0, 0, 0.9);
	border-right: 1px solid rgba(0, 255, 255, 0.3);
	padding: 20px;
	overflow-y: auto;
	transition: left 0.3s ease;
	height: 100dvh;
}

.control-panel.open {
	left: 0;
}

.panel-header h3 {
	color: #00ffff;
	font-size: 20px;
	margin: 0 0 20px 0;
	text-align: center;
	text-transform: uppercase;
	letter-spacing: 2px;
}

.quick-actions {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-bottom: 30px;
}

.action-btn {
	background: rgba(0, 255, 255, 0.1);
	border: 1px solid rgba(0, 255, 255, 0.3);
	color: #00ffff;
	padding: 12px;
	text-transform: uppercase;
	letter-spacing: 1px;
	cursor: pointer;
	transition: all 0.3s ease;
}

.action-btn:hover {
	background: rgba(0, 255, 255, 0.2);
	transform: translateX(5px);
}

.action-btn.manual {
	border-color: #ffc107;
	color: #ffc107;
}

.action-btn.rescue-mode {
	border-color: #ff4444;
	color: #ff4444;
}

.action-btn.deep-search {
	border-color: #aa66ff;
	color: #aa66ff;
}

/* Status Section */
.status-section,
.control-section,
.emergency-section,
.manual-section {
	margin-bottom: 30px;
}

.status-section h4,
.control-section h4,
.emergency-section h4,
.manual-section h4 {
	color: #00ffff;
	font-size: 14px;
	margin: 0 0 15px 0;
	text-transform: uppercase;
	letter-spacing: 2px;
	padding-bottom: 10px;
	border-bottom: 1px solid rgba(0, 255, 255, 0.2);
}

.status-item {
	margin-bottom: 15px;
}

.status-item label {
	display: block;
	color: #888;
	font-size: 12px;
	margin-bottom: 5px;
	text-transform: uppercase;
}

.status-bar-container {
	display: flex;
	align-items: center;
	gap: 10px;
}

.status-bar {
	flex: 1;
	height: 8px;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 4px;
	overflow: hidden;
	position: relative;
}

.status-fill {
	height: 100%;
	background: #00ffff;
	transition: width 0.3s ease;
}

.status-bar.critical .status-fill {
	background: #ff4444;
}

.status-bar.low .status-fill {
	background: #ffc107;
}

.status-fill.depth {
	background: #4488ff;
}

.status-fill.ballast {
	background: #aa66ff;
}

.status-value {
	color: #fff;
	font-size: 14px;
	min-width: 50px;
	text-align: right;
}

.status-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 15px;
	margin-top: 15px;
}

.status-cell {
	background: rgba(0, 255, 255, 0.05);
	border: 1px solid rgba(0, 255, 255, 0.2);
	padding: 10px;
	border-radius: 5px;
}

.status-cell label {
	color: #888;
	font-size: 11px;
}

.status-cell span {
	color: #00ffff;
	font-size: 18px;
	font-weight: bold;
}

/* Control Section */
.control-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 15px;
}

.control-row label {
	color: #888;
	font-size: 12px;
	text-transform: uppercase;
}

.control-buttons {
	display: flex;
	align-items: center;
	gap: 10px;
}

.ctrl-btn {
	background: rgba(0, 255, 255, 0.1);
	border: 1px solid rgba(0, 255, 255, 0.3);
	color: #00ffff;
	width: 30px;
	height: 30px;
	cursor: pointer;
	transition: all 0.2s ease;
}

.ctrl-btn:hover {
	background: rgba(0, 255, 255, 0.2);
}

.value {
	color: #fff;
	min-width: 50px;
	text-align: center;
}

.slider {
	width: 120px;
	height: 4px;
	background: rgba(255, 255, 255, 0.1);
	outline: none;
	cursor: pointer;
}

/* Emergency Section */
.emergency-btn {
	width: 100%;
	padding: 12px;
	margin-bottom: 10px;
	border: 1px solid;
	background: transparent;
	color: #fff;
	text-transform: uppercase;
	letter-spacing: 1px;
	cursor: pointer;
	transition: all 0.3s ease;
}

.emergency-btn.dive {
	border-color: #4488ff;
	color: #4488ff;
}

.emergency-btn.dive:hover {
	background: rgba(68, 136, 255, 0.2);
}

.emergency-btn.surface {
	border-color: #44ff44;
	color: #44ff44;
}

.emergency-btn.surface:hover {
	background: rgba(68, 255, 68, 0.2);
}

.emergency-btn.reset {
	border-color: #ff4444;
	color: #ff4444;
}

.emergency-btn.reset:hover {
	background: rgba(255, 68, 68, 0.2);
}

/* Manual Section */
.control-hint {
	color: #888;
	font-size: 12px;
	text-align: center;
	padding: 10px;
	background: rgba(255, 255, 255, 0.05);
	border-radius: 5px;
}

/* Minimap */
.minimap-container {
	position: absolute;
	top: 20px;
	right: 20px;
	width: 250px;
	background: rgba(0, 0, 0, 0.8);
	border: 1px solid rgba(0, 255, 255, 0.3);
	border-radius: 10px;
	padding: 10px;
}

.minimap-header {
	color: #00ffff;
	font-size: 12px;
	text-transform: uppercase;
	letter-spacing: 2px;
	text-align: center;
	margin-bottom: 10px;
}

.minimap-wrapper {
	position: relative;
	width: 100%;
	height: 200px;
	border: 1px solid rgba(0, 255, 255, 0.2);
	border-radius: 5px;
	overflow: hidden;
}

.minimap,
.minimap-fog {
	position: absolute;
	width: 100%;
	height: 100%;
}

.minimap-coords {
	display: flex;
	justify-content: space-around;
	margin-top: 10px;
	color: #888;
	font-size: 11px;
}

/* Detection Panel */
.detection-panel {
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 90%;
	max-width: 1200px;
	background: rgba(0, 0, 0, 0.8);
	border: 1px solid rgba(0, 255, 255, 0.3);
	border-bottom: none;
	border-radius: 20px 20px 0 0;
	padding: 20px;
	transition: all 0.3s ease;
}

.detection-panel.active {
	background: rgba(0, 0, 0, 0.9);
	border-color: rgba(255, 0, 0, 0.3);
}

.detection-alert {
	position: absolute;
	top: -80px;
	left: 50%;
	transform: translateX(-50%);
	background: rgba(255, 0, 0, 0.1);
	border: 1px solid rgba(255, 0, 0, 0.5);
	padding: 15px 30px;
	border-radius: 10px;
	animation: alertPulse 3s ease-out;
}

@keyframes alertPulse {
	0% {
		opacity: 0;
		transform: translateX(-50%) translateY(20px);
	}
	20% {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}
	80% {
		opacity: 1;
	}
	100% {
		opacity: 0;
	}
}

.alert-header {
	color: #ff6666;
	font-size: 12px;
	text-transform: uppercase;
	letter-spacing: 2px;
	margin-bottom: 5px;
}

.alert-content {
	display: flex;
	gap: 20px;
	align-items: center;
}

.detection-type {
	color: #fff;
	font-size: 16px;
	font-weight: bold;
}

.detection-temp {
	color: #ff9999;
	font-size: 20px;
}

.detections-container {
	margin-bottom: 15px;
}

.detections-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 15px;
}

.header-text {
	color: #00ffff;
	font-size: 14px;
	text-transform: uppercase;
	letter-spacing: 2px;
}

.header-count {
	background: rgba(0, 255, 255, 0.2);
	padding: 5px 15px;
	border-radius: 20px;
	color: #00ffff;
	font-weight: bold;
}

.detections-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
	gap: 15px;
	max-height: 150px;
	overflow-y: auto;
}

.detection-card {
	background: rgba(0, 255, 255, 0.05);
	border: 1px solid rgba(0, 255, 255, 0.2);
	border-radius: 10px;
	padding: 15px;
	display: flex;
	gap: 15px;
	align-items: center;
	transition: all 0.3s ease;
}

.detection-card.priority {
	background: rgba(255, 0, 0, 0.1);
	border-color: rgba(255, 0, 0, 0.3);
}

.detection-card:hover {
	transform: translateY(-2px);
	box-shadow: 0 5px 20px rgba(0, 255, 255, 0.2);
}

.detection-index {
	color: #888;
	font-size: 10px;
	text-transform: uppercase;
}

.detection-indicator {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	border: 2px solid rgba(255, 255, 255, 0.3);
	flex-shrink: 0;
}

.detection-data {
	flex: 1;
}

.detection-name {
	color: #fff;
	font-size: 14px;
	font-weight: bold;
	margin-bottom: 5px;
}

.detection-info {
	display: flex;
	gap: 15px;
	align-items: center;
	margin-bottom: 5px;
}

.temp-reading {
	color: #ff9999;
	font-size: 16px;
	font-weight: bold;
}

.priority-level {
	background: rgba(255, 0, 0, 0.2);
	color: #ff6666;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 11px;
	text-transform: uppercase;
}

.detection-desc {
	color: #888;
	font-size: 11px;
	line-height: 1.4;
}

/* Sensor Status */
.sensor-status {
	display: flex;
	justify-content: center;
	gap: 30px;
	padding-top: 15px;
	border-top: 1px solid rgba(0, 255, 255, 0.2);
}

.sensor-item {
	display: flex;
	align-items: center;
	gap: 10px;
}

.sensor-label {
	color: #888;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 1px;
}

.sensor-value {
	color: #00ffff;
	font-size: 14px;
	font-weight: bold;
}

/* Camera Indicator */
.camera-indicator {
	position: absolute;
	top: 100px;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	align-items: center;
	gap: 15px;
	background: rgba(0, 0, 0, 0.8);
	padding: 10px 20px;
	border: 1px solid rgba(0, 255, 255, 0.3);
	border-radius: 20px;
}

.camera-mode {
	color: #00ffff;
	font-size: 12px;
	text-transform: uppercase;
	letter-spacing: 2px;
}

.thermal-active {
	color: #ff6600;
	animation: pulse 1.5s infinite;
}

/* Depth Indicator */
.depth-indicator {
	position: absolute;
	right: 20px;
	top: 50%;
	transform: translateY(-50%);
	background: rgba(0, 0, 0, 0.8);
	border: 1px solid rgba(0, 255, 255, 0.3);
	border-radius: 10px;
	padding: 20px;
}

.depth-label {
	color: #00ffff;
	font-size: 12px;
	text-transform: uppercase;
	letter-spacing: 2px;
	text-align: center;
	margin-bottom: 10px;
}

.depth-meter {
	display: flex;
	gap: 10px;
	align-items: center;
}

.depth-scale {
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	height: 200px;
	color: #888;
	font-size: 10px;
}

.depth-bar {
	width: 10px;
	height: 200px;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 5px;
	position: relative;
	overflow: hidden;
}

.depth-marker {
	position: absolute;
	left: -5px;
	width: 20px;
	height: 4px;
	background: #00ffff;
	border-radius: 2px;
	transition: top 0.3s ease;
	box-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
}

.depth-value {
	color: #00ffff;
	font-size: 18px;
	font-weight: bold;
	text-align: center;
	margin-top: 10px;
}

/* Animations */
@keyframes pulse {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.5;
	}
}

/* Scrollbar Styling */
.control-panel::-webkit-scrollbar,
.detections-grid::-webkit-scrollbar {
	width: 8px;
}

.control-panel::-webkit-scrollbar-track,
.detections-grid::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.05);
}

.control-panel::-webkit-scrollbar-thumb,
.detections-grid::-webkit-scrollbar-thumb {
	background: rgba(0, 255, 255, 0.3);
	border-radius: 4px;
}

.control-panel::-webkit-scrollbar-thumb:hover,
.detections-grid::-webkit-scrollbar-thumb:hover {
	background: rgba(0, 255, 255, 0.5);
}

/* Responsive adjustments */
@media (max-width: 1200px) {
	.detection-panel {
		width: 95%;
	}

	.detections-grid {
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	}
}

@media (max-width: 768px) {
	.control-panel {
		width: 280px;
	}

	.control-panel.open {
		left: 0;
	}

	.control-toggle.open {
		transform: translateY(-50%) translateX(280px);
	}

	.minimap-container {
		width: 180px;
	}

	.minimap-wrapper {
		height: 150px;
	}

	.detection-panel {
		padding: 15px;
	}

	.detections-grid {
		grid-template-columns: 1fr;
		max-height: 120px;
	}

	.depth-indicator {
		display: none;
	}
}

/* High-tech border effects */
/* .control-panel,
.minimap-container,
.detection-panel,
.depth-indicator {
	position: relative;
} */

.control-panel::before,
.minimap-container::before,
.detection-panel::before,
.depth-indicator::before {
	content: "";
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	border-radius: inherit;
	padding: 1px;
	background: linear-gradient(
		45deg,
		transparent,
		rgba(0, 255, 255, 0.5),
		transparent
	);
	-webkit-mask: linear-gradient(#fff 0 0) content-box,
		linear-gradient(#fff 0 0);
	-webkit-mask-composite: destination-out;
	mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
	mask-composite: exclude;
	opacity: 0;
	transition: opacity 0.3s ease;
	z-index: -1;
}

.control-panel:hover::before,
.minimap-container:hover::before,
.detection-panel:hover::before,
.depth-indicator:hover::before {
	opacity: 1;
}

/* Focus states for accessibility */
button:focus,
input:focus {
	outline: 2px solid rgba(0, 255, 255, 0.5);
	outline-offset: 2px;
}

/* Loading states */
.loading {
	opacity: 0.5;
	pointer-events: none;
}

.loading::after {
	content: "";
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 40px;
	height: 40px;
	border: 3px solid transparent;
	border-top-color: #00ffff;
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to {
		transform: translate(-50%, -50%) rotate(360deg);
	}
}
</style>
