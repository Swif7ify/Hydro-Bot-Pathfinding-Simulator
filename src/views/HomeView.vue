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

	poolSize,
	waterDepth,
	waterTurbidity,
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
	numVictims,
	numDebris,
	victimsFound,
	areaSearched,
	missionStatus,

	batteryLevel,
	waterTemperature,
	oxygenLevel,

	cameraMode,
	toggleCameraMode,
	texturesEnabled,

	getDetectedObjectsWithScreenPos,
	checkTargetCollection,
} = usePathFinder(mainCanvas, miniMapCanvas, miniMapFog);

// Create missing reactive properties for the template
const currentMode = ref("manual");
const detectedObjectsWithOverlays = computed(() => {
	return getDetectedObjectsWithScreenPos() || [];
});
const targetMessage = ref("");
const targetInSight = ref(false);

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
				case " ": // Space key for target acquisition
					e.preventDefault();
					checkTargetCollection();
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
					<span class="value">MANUAL</span>
				</div>
				<div class="status-item">
					<span class="label">VICTIMS</span>
					<span class="value survivor">{{ victimsFound }}</span>
				</div>
				<div class="status-item">
					<span class="label">STATUS</span>
					<span class="value">{{ missionStatus }}</span>
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
					<button @click="toggleCameraMode" class="hud-btn">
						{{ cameraMode.toUpperCase() }}
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
				<div class="controls-text">
					WASD: Move | Q/E: Dive/Surface | SPACE: Acquire Target
				</div>
			</div>

			<!-- Target in Sight Alert -->
			<div v-if="targetMessage" class="target-sight-alert">
				<div class="target-icon">🎯</div>
				<div class="target-text">{{ targetMessage }}</div>
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

<style scoped src="../assets/home.css"></style>
