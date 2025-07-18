<template>
	<div class="seasick-gui">
		<!-- Main Display Area -->
		<div class="main-display">
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

				<!-- Camera Crosshairs and Info -->
				<div class="viewport-overlay">
					<div class="crosshairs">
						<div class="crosshair-center"></div>
						<div class="crosshair-line crosshair-horizontal"></div>
						<div class="crosshair-line crosshair-vertical"></div>
						<div class="crosshair-circle"></div>
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
									>{{ batteryLevel }}%</span
								>
							</div>
							<div class="status-row">
								<span class="status-indicator green"></span>
								<span class="status-text">COMMS</span>
								<span class="status-value">ONLINE</span>
							</div>
							<div class="status-row">
								<span class="status-indicator green"></span>
								<span class="status-text">SONAR</span>
								<span class="status-value">ACTIVE</span>
							</div>
							<div class="status-row">
								<span class="status-indicator orange"></span>
								<span class="status-text">THERMAL</span>
								<span class="status-value">SCAN</span>
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
								<span class="env-value">GOOD</span>
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
			<!-- Left: Gauges -->
			<div class="gauge-section">
				<div class="gauge small-gauge">
					<div class="gauge-face">
						<div class="gauge-needle"></div>
					</div>
					<div class="gauge-label">{{ batteryLevel }}</div>
					<div class="gauge-unit">BAT</div>
				</div>

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
						<div class="gauge-needle"></div>
					</div>
					<div class="gauge-label">{{ robotSpeed.toFixed(1) }}</div>
					<div class="gauge-unit">KNOTS</div>
				</div>

				<div class="gauge small-gauge">
					<div class="gauge-face">
						<div class="gauge-needle"></div>
					</div>
					<div class="gauge-label">{{ waterTemperature }}</div>
					<div class="gauge-unit">°C</div>
				</div>
			</div>

			<!-- Center: Depth Display -->
			<div class="depth-section">
				<div class="depth-display-main">
					<div class="depth-circle">
						<div class="depth-value-large">{{ currentDepth }}</div>
						<div class="depth-unit-large">METERS</div>
					</div>
					<div class="depth-label-main">DEPTH</div>
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
								:style="{ transform: 'rotate(45deg)' }"
							>
								<div class="needle-north"></div>
								<div class="needle-south"></div>
							</div>

							<!-- Center dot -->
							<div class="compass-center"></div>
						</div>
					</div>
					<div class="compass-heading">
						<span class="heading-value">045°</span>
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
const robotSpeed = ref(1.2);
const waterTemperature = ref(24);
const pressure = ref(1.2);
const sweepAngle = ref(0);

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

		// Update position (convert to lat/lng format)
		latitude.value = (position.x * 0.00001).toFixed(6);
		longitude.value = (position.z * 0.00001).toFixed(6);

		// Update depth
		currentDepth.value = depth.toFixed(1);

		// Update speed
		robotSpeed.value = speed;
	}
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
