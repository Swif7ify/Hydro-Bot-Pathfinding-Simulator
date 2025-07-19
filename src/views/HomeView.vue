<template>
	<div class="seasick-gui">
		<!-- Main Display Area -->
		<div class="main-display" :class="{ 'screen-shake': screenShake }">
			<!-- Fullscreen Camera Canvas -->
			<canvas ref="mainCanvas" id="mainCanvas"></canvas>

			<!-- GUI Overlays -->
			<div class="gui-overlays">
				<!-- Left Info Panel -->
				<div class="left-info-panel">
					<div class="coordinates-display">
						<div class="coord-item">
							<div class="coord-label">LATITUDE</div>
							<div class="coord-value">{{ latitude }}</div>
						</div>
						<div class="coord-item">
							<div class="coord-label">LONGITUDE</div>
							<div class="coord-value">{{ longitude }}</div>
						</div>
					</div>
				</div>

				<!-- Collision Detection Panel -->
				<div class="collision-panel">
					<div class="panel-header">
						<div class="panel-title">AUV STATUS</div>
						<div
							class="collision-indicator"
							:class="{ 'collision-active': collisionActive }"
						>
							{{ collisionActive ? "IMPACT" : "CLEAR" }}
						</div>
					</div>

					<!-- AUV Damage Visualization -->
					<div class="auv-damage-display">
						<div class="auv-schematic">
							<!-- AUV Body sections -->
							<div
								class="auv-section front"
								:class="{ damaged: damageStatus.front }"
							>
								<span class="section-label">FRONT</span>
							</div>
							<div
								class="auv-section left"
								:class="{ damaged: damageStatus.left }"
							>
								<span class="section-label">PORT</span>
							</div>
							<div
								class="auv-section right"
								:class="{ damaged: damageStatus.right }"
							>
								<span class="section-label">STAR</span>
							</div>
							<div
								class="auv-section back"
								:class="{ damaged: damageStatus.back }"
							>
								<span class="section-label">REAR</span>
							</div>
						</div>
					</div>

					<!-- Recent Collision Log -->
					<div class="collision-log">
						<div class="log-header">RECENT IMPACTS</div>
						<div class="log-entries">
							<div
								v-for="(collision, index) in recentCollisions"
								:key="index"
								class="log-entry"
								:class="{ fresh: collision.fresh }"
							>
								<span class="collision-time">{{
									collision.time
								}}</span>
								<span class="collision-type">{{
									collision.type
								}}</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Camera Crosshairs and Info -->
				<div class="viewport-overlay">
					<div class="crosshairs">
						<div class="crosshair-center"></div>
						<div class="crosshair-line crosshair-horizontal"></div>
						<div class="crosshair-line crosshair-vertical"></div>
						<div class="crosshair-circle"></div>
					</div>
					<div class="camera-mode-display">
						<div class="camera-mode-label">
							{{ cameraMode.toUpperCase() }} CAMERA
						</div>
						<div class="camera-mode-hint">
							Press F to switch modes
						</div>
					</div>
				</div>

				<!-- Right Status Panel -->
				<div class="right-status-panel">
					<div class="status-display">
						<div class="status-header">SYSTEM STATUS</div>
						<div class="status-items">
							<div class="status-row">
								<span class="status-indicator green"></span>
								<span class="status-text">POWER</span>
								<span class="status-value"
									>{{ Math.round(batteryLevel) }}%</span
								>
							</div>
							<div class="status-row">
								<span class="status-indicator green"></span>
								<span class="status-text">COMMS</span>
								<span class="status-value">ONLINE</span>
							</div>
							<div class="status-row">
								<span
									class="status-indicator"
									:class="
										cameraMode === 'sonar'
											? 'green'
											: 'orange'
									"
								></span>
								<span class="status-text">SONAR</span>
								<span class="status-value">{{
									cameraMode === "sonar"
										? "ACTIVE"
										: "STANDBY"
								}}</span>
							</div>
							<div class="status-row">
								<span
									class="status-indicator"
									:class="
										cameraMode === 'optical'
											? 'orange'
											: 'gray'
									"
								></span>
								<span class="status-text">OPTICS</span>
								<span class="status-value">{{
									cameraMode === "optical"
										? "ACTIVE"
										: "STANDBY"
								}}</span>
							</div>
						</div>
					</div>

					<div class="environmental-display">
						<div class="env-header">ENVIRONMENT</div>
						<div class="env-items">
							<div class="env-row">
								<span class="env-label">TEMP:</span>
								<span class="env-value"
									>{{ waterTemperature }}°C</span
								>
							</div>
							<div class="env-row">
								<span class="env-label">PRESSURE:</span>
								<span class="env-value"
									>{{ pressure }} BAR</span
								>
							</div>
							<div class="env-row">
								<span class="env-label">VISIBILITY:</span>
								<span class="env-value">{{
									getVisibilityStatus()
								}}</span>
							</div>
						</div>
					</div>

					<div class="search-rescue-display">
						<div class="sar-header">SEARCH & RESCUE</div>
						<div class="sar-items">
							<div class="sar-row">
								<span class="sar-label">FOUND:</span>
								<span class="sar-value"
									>{{ searchProgress.found }}/{{
										searchProgress.total
									}}</span
								>
							</div>
							<div class="sar-row" v-if="nearestTarget">
								<span class="sar-label">NEAREST:</span>
								<span class="sar-value"
									>{{ nearestTarget.distance }}m</span
								>
							</div>
							<div class="sar-row">
								<span class="sar-label">STATUS:</span>
								<span
									class="sar-value"
									:class="searchStatusClass"
									>{{ searchStatus }}</span
								>
							</div>
						</div>
					</div>
				</div>

				<!-- Top Right: Green WiFi Status Icon -->
				<div class="wifi-status-icon">
					<svg
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
						<g
							id="SVGRepo_tracerCarrier"
							stroke-linecap="round"
							stroke-linejoin="round"
						></g>
						<g id="SVGRepo_iconCarrier">
							<path
								d="M0 7L1.17157 5.82843C2.98259 4.01741 5.43884 3 8 3C10.5612 3 13.0174 4.01742 14.8284 5.82843L16 7L14.5858 8.41421L13.4142 7.24264C11.9783 5.8067 10.0307 5 8 5C5.96928 5 4.02173 5.8067 2.58579 7.24264L1.41421 8.41421L0 7Z"
								fill="#00ff88"
							></path>
							<path
								d="M4.24264 11.2426L2.82843 9.82843L4 8.65685C5.06086 7.59599 6.49971 7 8 7C9.50029 7 10.9391 7.59599 12 8.65686L13.1716 9.82843L11.7574 11.2426L10.5858 10.0711C9.89999 9.38527 8.96986 9 8 9C7.03014 9 6.1 9.38527 5.41421 10.0711L4.24264 11.2426Z"
								fill="#00ff88"
							></path>
							<path
								d="M8 15L5.65685 12.6569L6.82842 11.4853C7.13914 11.1746 7.56057 11 8 11C8.43942 11 8.86085 11.1746 9.17157 11.4853L10.3431 12.6569L8 15Z"
								fill="#00ff88"
							></path>
						</g>
					</svg>
				</div>
			</div>
		</div>

		<!-- Bottom Control Panel -->
		<div class="bottom-panel">
			<!-- Left: Speed Gauge -->
			<div class="gauge-section">
				<div class="gauge main-gauge">
					<div class="gauge-face">
						<div class="gauge-scale">
							<div
								class="scale-mark"
								v-for="n in 12"
								:key="n"
								:style="{
									transform:
										'rotate(' + (n * 30 - 90) + 'deg)',
								}"
							></div>
						</div>
						<div
							class="gauge-needle"
							:style="{
								transform:
									'rotate(' +
									(Math.min(robotSpeed * 20, 240) - 90) +
									'deg)',
							}"
						></div>
					</div>
					<div class="gauge-label">{{ robotSpeed.toFixed(1) }}</div>
					<div class="gauge-unit">KNOTS</div>
				</div>
			</div>

			<!-- Center: Depth Display with Battery and Temperature -->
			<div class="depth-section">
				<div class="depth-display-main">
					<div class="depth-circle">
						<div class="depth-value-large">{{ currentDepth }}</div>
						<div class="depth-unit-large">METERS</div>
					</div>
					<div class="depth-label-main">DEPTH</div>
				</div>

				<!-- Additional Info -->
				<div class="depth-info">
					<div class="info-item">
						<div class="info-label">BAT</div>
						<div class="info-value">
							{{ Math.round(batteryLevel) }}%
						</div>
					</div>
					<div class="info-item">
						<div class="info-label">TEMP</div>
						<div class="info-value">{{ waterTemperature }}°C</div>
					</div>
				</div>
			</div>

			<!-- Right: Compass -->
			<div class="compass-section">
				<div class="compass-display">
					<div class="compass-circle">
						<div class="compass-face">
							<!-- Cardinal directions -->
							<div class="compass-direction north">N</div>
							<div class="compass-direction east">E</div>
							<div class="compass-direction south">S</div>
							<div class="compass-direction west">W</div>

							<!-- Degree markings -->
							<div class="degree-marks">
								<div
									v-for="n in 36"
									:key="n"
									class="degree-mark"
									:style="{
										transform: 'rotate(' + n * 10 + 'deg)',
									}"
								></div>
							</div>

							<!-- Compass needle -->
							<div
								class="compass-needle"
								:style="{
									transform:
										'rotate(' + compassHeading + 'deg)',
								}"
							>
								<div class="needle-north"></div>
								<div class="needle-south"></div>
							</div>
						</div>
					</div>
				</div>
				<div class="compass-title">COMPASS</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { AUVLogic } from "../composable/auvLogic.js";

// GUI state
const currentTime = ref(new Date().toLocaleTimeString());
const latitude = ref("0.000000");
const longitude = ref("0.000000");
const currentDepth = ref("0.0");
const batteryLevel = ref(85);
const robotSpeed = ref(0.0);
const waterTemperature = ref(24);
const pressure = ref(1.2);
const sweepAngle = ref(0);
const compassHeading = ref(0);
const cameraMode = ref("optical");

// Search and rescue state
const searchProgress = ref({ found: 0, total: 0 });
const nearestTarget = ref(null);
const searchStatus = ref("SEARCHING");
const searchStatusClass = ref("searching");

// Collision detection state
const collisionActive = ref(false);
const damageStatus = ref({
	front: false,
	left: false,
	right: false,
	back: false,
});
const recentCollisions = ref([]);
const screenShake = ref(false);

// AUV Logic instance
let auvLogic = null;
const mainCanvas = ref(null);

// Animation for sonar sweep
let sweepInterval = null;
let timeInterval = null;
let updateInterval = null;

// Update time display
const updateTime = () => {
	currentTime.value = new Date().toLocaleTimeString();
};

// Animate sonar sweep
const animateSweep = () => {
	sweepAngle.value = (sweepAngle.value + 2) % 360;
};

// Update GUI values from AUV
const updateGUIFromAUV = () => {
	if (auvLogic) {
		const position = auvLogic.getPosition();
		const speed = auvLogic.getSpeed();
		const depth = auvLogic.getDepth();
		const heading = auvLogic.getHeading();
		const rotation = auvLogic.getRotation();

		// Update position (convert to lat/lng format)
		latitude.value = (40.7128 + position.x * 0.0001).toFixed(6); // Start from NYC coordinates
		longitude.value = (-74.006 + position.z * 0.0001).toFixed(6);

		// Update depth
		currentDepth.value = depth.toFixed(1);

		// Update speed
		robotSpeed.value = speed;

		// Update compass heading using raw rotation to avoid interpolation issues
		// Convert Z rotation to compass heading (0° = North, 90° = East, etc.)
		let rotationDegrees = (rotation.z * 180) / Math.PI;
		// Normalize to 0-360 range and adjust for compass orientation
		compassHeading.value = (360 - rotationDegrees) % 360;

		// Update camera mode
		cameraMode.value = auvLogic.getCameraMode();

		// Update environmental data based on depth and conditions
		waterTemperature.value = Math.max(4, 24 - Math.floor(depth * 2)); // Temp decreases with depth
		pressure.value = (1 + depth * 0.1).toFixed(1); // Pressure increases with depth

		// Battery decreases slowly over time
		if (speed > 0) {
			batteryLevel.value = Math.max(0, batteryLevel.value - 0.01);
		}

		// Update search and rescue data
		searchProgress.value = auvLogic.getSearchProgress();
		nearestTarget.value = auvLogic.getNearestTarget();

		// Update collision data
		const collisionData = auvLogic.getCollisionData();
		if (collisionData) {
			collisionActive.value = collisionData.active;
			damageStatus.value = collisionData.damageStatus;

			// Add new collisions to log
			if (collisionData.newCollision) {
				addCollisionToLog(collisionData.newCollision);
				triggerScreenShake();
			}
		}

		// Update search status
		if (
			searchProgress.value.found === searchProgress.value.total &&
			searchProgress.value.total > 0
		) {
			searchStatus.value = "COMPLETE";
			searchStatusClass.value = "complete";
		} else if (searchProgress.value.found > 0) {
			searchStatus.value = "IN PROGRESS";
			searchStatusClass.value = "in-progress";
		} else {
			searchStatus.value = "SEARCHING";
			searchStatusClass.value = "searching";
		}
	}
};

// Get visibility status based on camera mode and depth
const getVisibilityStatus = () => {
	if (!auvLogic) return "UNKNOWN";

	const depth = parseFloat(currentDepth.value);
	const mode = cameraMode.value;

	if (mode === "sonar") {
		return depth < 5 ? "EXCELLENT" : "GOOD";
	} else {
		// Optical camera - visibility decreases with depth
		if (depth < 2) return "EXCELLENT";
		if (depth < 5) return "GOOD";
		if (depth < 8) return "POOR";
		return "LIMITED";
	}
};

// Add collision to log
const addCollisionToLog = (collision) => {
	const now = new Date();
	const timeStr = now.toLocaleTimeString().slice(0, 8);

	const newCollision = {
		time: timeStr,
		type: collision.type.toUpperCase(),
		direction: collision.direction,
		fresh: true,
	};

	recentCollisions.value.unshift(newCollision);

	// Keep only last 5 collisions
	if (recentCollisions.value.length > 5) {
		recentCollisions.value.pop();
	}

	// Remove fresh status after 3 seconds
	setTimeout(() => {
		newCollision.fresh = false;
	}, 3000);
};

// Trigger screen shake effect
const triggerScreenShake = () => {
	screenShake.value = true;
	setTimeout(() => {
		screenShake.value = false;
	}, 500);
};

onMounted(() => {
	// Wait for next tick to ensure canvas is properly mounted
	setTimeout(() => {
		// Initialize AUV logic with the canvas
		if (mainCanvas.value) {
			try {
				auvLogic = new AUVLogic(mainCanvas.value);
				console.log("AUV Logic initialized successfully");
			} catch (error) {
				console.error("Error initializing AUV Logic:", error);
			}
		} else {
			console.error("Canvas not found");
		}
	}, 100);

	// Start intervals
	timeInterval = setInterval(updateTime, 1000);
	sweepInterval = setInterval(animateSweep, 50);
	updateInterval = setInterval(updateGUIFromAUV, 100);

	updateTime();
});

onUnmounted(() => {
	if (timeInterval) clearInterval(timeInterval);
	if (sweepInterval) clearInterval(sweepInterval);
	if (updateInterval) clearInterval(updateInterval);
});
</script>

<style scoped src="../assets/home.css"></style>
