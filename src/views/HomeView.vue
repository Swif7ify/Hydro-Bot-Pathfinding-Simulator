<script setup>
import { ref, onMounted, computed } from "vue";
import { usePathFinder } from "@/composable/usePathFinder.js";

const mainCanvas = ref(null);
const miniMapCanvas = ref(null);
const miniMapFog = ref(null);

const controlPanelOpen = ref(false);
const activeDetection = ref(null);
const detectionAnimation = ref(false);

const {
	initializeThreeJS,

	patterns,
	currentPattern,
	modes,
	currentMode,
	togglePattern,
	toggleMode,

	poolSize,
	waterDepth,
	waterTurbidity,
	increasePoolSize,
	decreasePoolSize,
	resetSimulation,

	robotSpeed,
	divingSpeed,
	ballastLevel,
	currentDepth,
	maxDiveDepth,
	manualControl,
	emergencyDive,
	emergencySurface,

	getRobotPosition,

	sonarRadius,
	sonarNumRays,
	thermalRadius,
	thermalData,
	sonarData,

	heatDetected,
	heatTypes,
	numVictims,
	numDebris,
	spawnMoreVictims,
	spawnMoreDebris,
	victimsFound,
	areaSearched,
	missionStatus,

	batteryLevel,
	waterTemperature,
	oxygenLevel,

	cameraMode,
	toggleCameraMode,
	texturesEnabled,

	toggleVisionVisualization,

	detectedObjectsWithOverlays,
	getDetectedObjectsWithScreenPos,
} = usePathFinder(mainCanvas, miniMapCanvas, miniMapFog);

const batteryStatus = computed(() => {
	if (batteryLevel.value < 15) return "critical";
	if (batteryLevel.value < 30) return "low";
	return "normal";
});

const depthPercentage = computed(() => {
	return (currentDepth.value / maxDiveDepth.value) * 100;
});

let lastDetectionCount = 0;
setInterval(() => {
	if (
		thermalData.heatSources &&
		thermalData.heatSources.length > lastDetectionCount
	) {
		const latestDetection =
			thermalData.heatSources[thermalData.heatSources.length - 1];
		activeDetection.value = {
			name: latestDetection.type?.name || "Unknown Target",
			temp:
				latestDetection.type?.temp || latestDetection.temperature || 0,
		};
		detectionAnimation.value = true;
		setTimeout(() => {
			detectionAnimation.value = false;
		}, 3000);
		lastDetectionCount = thermalData.heatSources.length;
	}
}, 100);

onMounted(() => {
	window.addEventListener("keydown", (e) => {
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
	<div class="advanced-hud">
		<canvas ref="mainCanvas" class="main-viewport"></canvas>

		<div class="hud-overlay">
			<div class="crosshairs">
				<div class="crosshair-center"></div>
				<div class="crosshair-line crosshair-horizontal"></div>
				<div class="crosshair-line crosshair-vertical"></div>
				<div class="crosshair-circle"></div>
			</div>

			<div class="scan-line" :class="{ active: heatDetected }"></div>

			<div
				v-if="detectedObjectsWithOverlays.length > 0"
				class="target-lock-indicator"
			>
				<div class="lock-text">
					TARGET LOCK: {{ detectedObjectsWithOverlays.length }}
				</div>
				<div class="lock-bars">
					<div
						class="lock-bar"
						v-for="n in Math.min(
							detectedObjectsWithOverlays.length,
							5
						)"
						:key="n"
					></div>
				</div>
			</div>

			<div
				v-for="(obj, index) in detectedObjectsWithOverlays"
				:key="index"
				class="object-overlay"
				:style="{
					left: obj.screenPosition?.x + 'px',
					top: obj.screenPosition?.y + 'px',
				}"
				:class="{
					priority: obj.priority <= 2,
					survivor: obj.name?.includes('Survivor'),
					injured: obj.name?.includes('Injured'),
				}"
			>
				<div class="overlay-target">
					<div class="target-reticle"></div>
					<div class="target-corners"></div>
				</div>
				<div class="overlay-info">
					<div class="info-line name">{{ obj.name }}</div>
					<div class="info-line temp">{{ obj.temp }}°C</div>
					<div class="info-line distance">
						{{ obj.distance?.toFixed(1) }}m
					</div>
					<div v-if="obj.priority" class="info-line priority">
						P{{ obj.priority }}
					</div>
				</div>
				<div class="overlay-connector"></div>
			</div>

			<div class="status-cluster top-left">
				<div class="cluster-header">MISSION STATUS</div>
				<div class="status-item">
					<span class="label">MODE</span>
					<span class="value" :class="currentMode">{{
						currentMode.toUpperCase()
					}}</span>
				</div>
				<div class="status-item">
					<span class="label">PATTERN</span>
					<span class="value">{{
						currentPattern.replace("-", " ").toUpperCase()
					}}</span>
				</div>
				<div class="status-item">
					<span class="label">VICTIMS</span>
					<span class="value survivor">{{ victimsFound }}</span>
				</div>
				<div class="status-item">
					<span class="label">AREA</span>
					<span class="value">{{ Math.round(areaSearched) }}%</span>
				</div>
			</div>

			<div class="status-cluster top-right">
				<div class="cluster-header">SYSTEM STATUS</div>
				<div class="status-item">
					<span class="label">BATTERY</span>
					<span
						class="value"
						:class="{
							critical: batteryLevel < 15,
							low: batteryLevel < 30,
						}"
						>{{ Math.round(batteryLevel) }}%</span
					>
				</div>
				<div class="status-item">
					<span class="label">DEPTH</span>
					<span class="value">{{ currentDepth.toFixed(1) }}m</span>
				</div>
				<div class="status-item">
					<span class="label">TEMP</span>
					<span class="value">{{ waterTemperature }}°C</span>
				</div>
				<div class="status-item">
					<span class="label">O2</span>
					<span class="value">{{ oxygenLevel }}%</span>
				</div>
			</div>

			<div class="status-cluster bottom-left">
				<div class="cluster-header">SENSORS</div>
				<div class="status-item">
					<span class="label">THERMAL</span>
					<span class="value thermal">{{ thermalRadius }}m</span>
				</div>
				<div class="status-item">
					<span class="label">SONAR</span>
					<span class="value sonar">{{ sonarRadius }}m</span>
				</div>
				<div class="status-item">
					<span class="label">VISION</span>
					<span class="value vision">ACTIVE</span>
				</div>
				<div class="status-item" :class="{ active: heatDetected }">
					<span class="label">HEAT SIG</span>
					<span class="value">{{
						heatDetected ? "DETECTED" : "SCANNING"
					}}</span>
				</div>
			</div>

			<div class="status-cluster bottom-right">
				<div class="cluster-header">CONTROLS</div>
				<div class="control-group">
					<button @click="toggleMode" class="hud-btn">
						MODE: {{ currentMode.toUpperCase() }}
					</button>
					<button @click="togglePattern" class="hud-btn">
						PATTERN
					</button>
					<button @click="toggleCameraMode" class="hud-btn">
						{{ cameraMode.toUpperCase() }}
					</button>
					<button @click="toggleVisionVisualization" class="hud-btn">
						👁️ VISION
					</button>
				</div>
				<div class="environment-controls">
					<button @click="spawnMoreVictims" class="hud-btn spawn">
						SPAWN VICTIMS
					</button>
					<button @click="spawnMoreDebris" class="hud-btn spawn">
						SPAWN DEBRIS
					</button>
				</div>
				<div class="emergency-controls">
					<button @click="emergencyDive" class="hud-btn emergency">
						DIVE
					</button>
					<button @click="emergencySurface" class="hud-btn emergency">
						SURFACE
					</button>
					<button @click="resetSimulation" class="hud-btn reset">
						RESET
					</button>
				</div>
			</div>

			<div class="minimap-hud">
				<div class="minimap-header">TACTICAL</div>
				<canvas ref="miniMapCanvas" class="minimap"></canvas>
				<canvas ref="miniMapFog" class="minimap-fog"></canvas>
				<div class="minimap-coords">
					{{ getRobotPosition().x?.toFixed(1) || "0.0" }},{{
						getRobotPosition().z?.toFixed(1) || "0.0"
					}}
				</div>
			</div>

			<div class="camera-mode-hud">
				<span class="mode-text">{{ cameraMode.toUpperCase() }}</span>
				<span v-if="cameraMode === 'thermal'" class="thermal-indicator"
					>🔥</span
				>
			</div>

			<div v-if="currentMode === 'manual'" class="manual-hint">
				<div class="hint-text">MANUAL CONTROL ACTIVE</div>
				<div class="controls-text">WASD: Move | Q/E: Dive/Surface</div>
			</div>

			<div
				v-if="detectionAnimation && activeDetection"
				class="detection-alert"
			>
				<div class="alert-icon">⚠️</div>
				<div class="alert-text">
					<div class="alert-header">NEW TARGET ACQUIRED</div>
					<div class="alert-details">
						{{ activeDetection.name }} -
						{{ activeDetection.temp }}°C
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.advanced-hud {
	position: relative;
	width: 100vw;
	height: 100vh;
	overflow: hidden;
	background: #000;
	font-family: "Orbitron", "Courier New", monospace;
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
	color: #00d4ff;
}

.hud-overlay > * {
	pointer-events: auto;
}

.crosshairs {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 100px;
	height: 100px;
	pointer-events: none;
}

.crosshair-center {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 4px;
	height: 4px;
	background: #00d4ff;
	border-radius: 50%;
	box-shadow: 0 0 10px #00d4ff;
}

.crosshair-line {
	position: absolute;
	background: linear-gradient(90deg, transparent, #00d4ff, transparent);
}

.crosshair-horizontal {
	top: 50%;
	left: 20%;
	right: 20%;
	height: 1px;
	transform: translateY(-50%);
}

.crosshair-vertical {
	left: 50%;
	top: 20%;
	bottom: 20%;
	width: 1px;
	transform: translateX(-50%);
	background: linear-gradient(180deg, transparent, #00d4ff, transparent);
}

.crosshair-circle {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 60px;
	height: 60px;
	border: 1px solid rgba(0, 212, 255, 0.3);
	border-radius: 50%;
	animation: crosshairPulse 2s infinite;
}

@keyframes crosshairPulse {
	0%,
	100% {
		transform: translate(-50%, -50%) scale(1);
		opacity: 0.3;
	}
	50% {
		transform: translate(-50%, -50%) scale(1.2);
		opacity: 0.6;
	}
}

.scan-line {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	height: 2px;
	background: linear-gradient(90deg, transparent, #00d4ff, transparent);
	animation: scanDown 3s infinite linear;
	opacity: 0;
	pointer-events: none;
}

.scan-line.active {
	opacity: 0.7;
}

@keyframes scanDown {
	0% {
		top: 0;
	}
	100% {
		top: 100%;
	}
}

.target-lock-indicator {
	position: absolute;
	top: 20%;
	left: 50%;
	transform: translateX(-50%);
	text-align: center;
	background: rgba(255, 68, 68, 0.1);
	border: 1px solid rgba(255, 68, 68, 0.5);
	border-radius: 10px;
	padding: 10px 20px;
	animation: lockPulse 1s infinite;
}

.lock-text {
	color: #ff4444;
	font-size: 12px;
	font-weight: bold;
	text-transform: uppercase;
	letter-spacing: 2px;
	margin-bottom: 8px;
}

.lock-bars {
	display: flex;
	justify-content: center;
	gap: 3px;
}

.lock-bar {
	width: 20px;
	height: 4px;
	background: #ff4444;
	border-radius: 2px;
	animation: lockBarPulse 0.8s infinite;
}

.lock-bar:nth-child(2) {
	animation-delay: 0.1s;
}

.lock-bar:nth-child(3) {
	animation-delay: 0.2s;
}

.lock-bar:nth-child(4) {
	animation-delay: 0.3s;
}

.lock-bar:nth-child(5) {
	animation-delay: 0.4s;
}

@keyframes lockPulse {
	0%,
	100% {
		opacity: 0.7;
		transform: translateX(-50%) scale(1);
	}
	50% {
		opacity: 1;
		transform: translateX(-50%) scale(1.05);
	}
}

@keyframes lockBarPulse {
	0%,
	100% {
		opacity: 0.5;
		transform: scaleY(1);
	}
	50% {
		opacity: 1;
		transform: scaleY(1.5);
	}
}

.object-overlay {
	position: absolute;
	transform: translate(-50%, -50%);
	pointer-events: none;
	z-index: 10;
}

.overlay-target {
	position: relative;
	width: 40px;
	height: 40px;
}

.target-reticle {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 30px;
	height: 30px;
	border: 2px solid #00d4ff;
	border-radius: 50%;
	animation: targetPulse 1.5s infinite;
}

.target-corners {
	position: absolute;
	top: -5px;
	left: -5px;
	right: -5px;
	bottom: -5px;
}

.target-corners::before,
.target-corners::after {
	content: "";
	position: absolute;
	width: 10px;
	height: 10px;
	border: 2px solid #00d4ff;
}

.target-corners::before {
	top: 0;
	left: 0;
	border-right: none;
	border-bottom: none;
}

.target-corners::after {
	bottom: 0;
	right: 0;
	border-left: none;
	border-top: none;
}

.object-overlay.priority .target-reticle {
	border-color: #ff4444;
	animation: priorityPulse 0.8s infinite;
}

.object-overlay.survivor .target-reticle {
	border-color: #44ff44;
}

.object-overlay.injured .target-reticle {
	border-color: #ffaa00;
}

@keyframes targetPulse {
	0%,
	100% {
		transform: translate(-50%, -50%) scale(1);
		opacity: 1;
	}
	50% {
		transform: translate(-50%, -50%) scale(1.3);
		opacity: 0.7;
	}
}

@keyframes priorityPulse {
	0%,
	100% {
		transform: translate(-50%, -50%) scale(1);
		opacity: 1;
	}
	50% {
		transform: translate(-50%, -50%) scale(1.5);
		opacity: 0.9;
	}
}

.overlay-info {
	position: absolute;
	top: 50px;
	left: 50%;
	transform: translateX(-50%);
	background: rgba(0, 0, 0, 0.9);
	border: 1px solid #00d4ff;
	border-radius: 5px;
	padding: 8px 12px;
	min-width: 120px;
	font-size: 11px;
	text-align: center;
}

.info-line {
	margin: 2px 0;
	text-transform: uppercase;
	letter-spacing: 1px;
}

.info-line.name {
	color: #ffffff;
	font-weight: bold;
	font-size: 12px;
}

.info-line.temp {
	color: #ff6666;
	font-weight: bold;
}

.info-line.distance {
	color: #00d4ff;
}

.info-line.priority {
	color: #ff4444;
	background: rgba(255, 68, 68, 0.2);
	border-radius: 3px;
	padding: 1px 4px;
}

.overlay-connector {
	position: absolute;
	top: 20px;
	left: 50%;
	width: 1px;
	height: 30px;
	background: #00d4ff;
	opacity: 0.6;
}

.status-cluster {
	position: absolute;
	background: rgba(0, 0, 0, 0.9);
	border: 1px solid rgba(0, 212, 255, 0.3);
	border-radius: 10px;
	padding: 15px;
	min-width: 200px;
}

.status-cluster.top-left {
	top: 20px;
	left: 20px;
}

.status-cluster.top-right {
	top: 20px;
	right: 20px;
}

.status-cluster.bottom-left {
	bottom: 20px;
	left: 20px;
}

.status-cluster.bottom-right {
	bottom: 20px;
	right: 20px;
}

.cluster-header {
	color: #00d4ff;
	font-size: 12px;
	font-weight: bold;
	text-transform: uppercase;
	letter-spacing: 2px;
	margin-bottom: 10px;
	padding-bottom: 5px;
	border-bottom: 1px solid rgba(0, 212, 255, 0.2);
}

.status-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin: 8px 0;
	font-size: 11px;
}

.status-item .label {
	color: #888;
	text-transform: uppercase;
	letter-spacing: 1px;
}

.status-item .value {
	color: #00d4ff;
	font-weight: bold;
	text-transform: uppercase;
}

.status-item .value.critical {
	color: #ff4444;
	animation: criticalBlink 1s infinite;
}

.status-item .value.low {
	color: #ffaa00;
}

.status-item .value.survivor {
	color: #44ff44;
}

.status-item .value.thermal {
	color: #ff6666;
}

.status-item .value.sonar {
	color: #6666ff;
}

.status-item .value.vision {
	color: #ff6600;
}

.status-item.active {
	animation: statusPulse 1s infinite;
}

.status-item.active .value {
	color: #ff4444;
}

@keyframes criticalBlink {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.3;
	}
}

@keyframes statusPulse {
	0%,
	100% {
		background: transparent;
	}
	50% {
		background: rgba(255, 68, 68, 0.1);
	}
}

.control-group,
.environment-controls,
.emergency-controls {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 10px;
}

.hud-btn {
	background: rgba(0, 212, 255, 0.1);
	border: 1px solid rgba(0, 212, 255, 0.3);
	color: #00d4ff;
	padding: 8px 12px;
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: 1px;
	cursor: pointer;
	transition: all 0.3s ease;
	border-radius: 3px;
}

.hud-btn:hover {
	background: rgba(0, 212, 255, 0.2);
	transform: translateX(2px);
}

.hud-btn.spawn {
	border-color: rgba(68, 255, 68, 0.5);
	color: #44ff44;
}

.hud-btn.spawn:hover {
	background: rgba(68, 255, 68, 0.2);
}

.hud-btn.emergency {
	border-color: rgba(255, 170, 0, 0.5);
	color: #ffaa00;
}

.hud-btn.emergency:hover {
	background: rgba(255, 170, 0, 0.2);
}

.hud-btn.reset {
	border-color: rgba(255, 68, 68, 0.5);
	color: #ff4444;
}

.hud-btn.reset:hover {
	background: rgba(255, 68, 68, 0.2);
}

.minimap-hud {
	position: absolute;
	top: 50%;
	right: 20px;
	transform: translateY(-50%);
	width: 180px;
	background: rgba(0, 0, 0, 0.9);
	border: 1px solid rgba(0, 212, 255, 0.3);
	border-radius: 10px;
	padding: 10px;
}

.minimap-header {
	color: #00d4ff;
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: 1px;
	text-align: center;
	margin-bottom: 8px;
}

.minimap,
.minimap-fog {
	position: absolute;
	width: 100%;
	height: 120px;
	border: 1px solid rgba(0, 212, 255, 0.2);
	border-radius: 3px;
}

.minimap-coords {
	margin-top: 125px;
	text-align: center;
	font-size: 9px;
	color: #888;
}

.camera-mode-hud {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -250px);
	display: flex;
	align-items: center;
	gap: 10px;
	background: rgba(0, 0, 0, 0.8);
	padding: 8px 15px;
	border: 1px solid rgba(0, 212, 255, 0.3);
	border-radius: 15px;
}

.mode-text {
	color: #00d4ff;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 1px;
}

.thermal-indicator {
	animation: thermalPulse 1s infinite;
}

@keyframes thermalPulse {
	0%,
	100% {
		opacity: 0.7;
	}
	50% {
		opacity: 1;
	}
}

.manual-hint {
	position: absolute;
	bottom: 50%;
	left: 50%;
	transform: translate(-50%, 100px);
	text-align: center;
	background: rgba(0, 0, 0, 0.9);
	border: 1px solid rgba(255, 170, 0, 0.5);
	border-radius: 10px;
	padding: 10px 20px;
}

.hint-text {
	color: #ffaa00;
	font-size: 12px;
	font-weight: bold;
	text-transform: uppercase;
	letter-spacing: 2px;
	margin-bottom: 5px;
}

.controls-text {
	color: #888;
	font-size: 10px;
	text-transform: uppercase;
}

.detection-alert {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -150px);
	display: flex;
	align-items: center;
	gap: 15px;
	background: rgba(255, 68, 68, 0.1);
	border: 1px solid rgba(255, 68, 68, 0.5);
	border-radius: 10px;
	padding: 15px 25px;
	animation: alertSlideIn 0.5s ease-out;
}

@keyframes alertSlideIn {
	0% {
		opacity: 0;
		transform: translate(-50%, -200px) scale(0.8);
	}
	100% {
		opacity: 1;
		transform: translate(-50%, -150px) scale(1);
	}
}

.alert-icon {
	font-size: 24px;
	animation: alertPulse 1s infinite;
}

@keyframes alertPulse {
	0%,
	100% {
		transform: scale(1);
	}
	50% {
		transform: scale(1.2);
	}
}

.alert-text {
	color: #ffffff;
}

.alert-header {
	font-size: 12px;
	font-weight: bold;
	text-transform: uppercase;
	letter-spacing: 2px;
	color: #ff6666;
	margin-bottom: 5px;
}

.alert-details {
	font-size: 14px;
	color: #ffffff;
}

@media (max-width: 1200px) {
	.status-cluster {
		min-width: 160px;
		padding: 12px;
	}

	.cluster-header {
		font-size: 11px;
	}

	.status-item {
		font-size: 10px;
	}

	.minimap-hud {
		width: 140px;
	}
}

@media (max-width: 768px) {
	.status-cluster.top-left,
	.status-cluster.top-right {
		top: 10px;
	}

	.status-cluster.bottom-left,
	.status-cluster.bottom-right {
		bottom: 10px;
	}

	.status-cluster {
		min-width: 140px;
		padding: 10px;
	}

	.crosshairs {
		width: 80px;
		height: 80px;
	}

	.crosshair-circle {
		width: 50px;
		height: 50px;
	}

	.detection-alert {
		padding: 12px 20px;
	}
}

.status-cluster,
.object-overlay .overlay-info,
.detection-alert,
.manual-hint,
.camera-mode-hud,
.minimap-hud {
	box-shadow: 0 0 20px rgba(0, 212, 255, 0.1);
}

.status-cluster:hover,
.hud-btn:hover {
	box-shadow: 0 0 30px rgba(0, 212, 255, 0.2);
}

.advanced-hud::before {
	content: "";
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: radial-gradient(
		circle at 50% 50%,
		rgba(0, 212, 255, 0.05) 0%,
		transparent 70%
	);
	pointer-events: none;
	z-index: 0;
	animation: hudGlow 4s infinite;
}

@keyframes hudGlow {
	0%,
	100% {
		opacity: 0.3;
	}
	50% {
		opacity: 0.6;
	}
}
</style>
