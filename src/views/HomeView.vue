<template>
	<div class="scene-container">
		<canvas ref="mainCanvas" id="mainCanvas"></canvas>

		<!-- Thermal colour-grade overlay (left half in SPLIT, full in THERMAL) -->
		<div
			class="thermal-tint"
			:class="{
				'tint-full': viewMode === 'thermal',
				'tint-left': viewMode === 'split',
				'tint-off': viewMode === 'camera',
			}"
		></div>
		<!-- Split-screen centre divider -->
		<div v-if="viewMode === 'split'" class="split-divider"></div>

		<!-- ── TOP LEFT ─ Mode selector ──────────────────────────────── -->
		<div class="hud top-left">
			<button
				class="mode-btn"
				:class="{ active: viewMode === 'thermal' }"
				@click="setMode('thermal')"
				title="Thermal"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M12 2v10m0 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
					<line x1="8" y1="6" x2="5" y2="6" />
					<line x1="8" y1="10" x2="5" y2="10" />
				</svg>
			</button>
			<button
				class="mode-btn"
				:class="{ active: viewMode === 'camera' }"
				@click="setMode('camera')"
				title="Camera"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="3" />
					<circle cx="12" cy="12" r="8" stroke-dasharray="4 2" />
					<circle cx="12" cy="12" r="1" fill="currentColor" />
				</svg>
			</button>
			<button
				class="mode-btn split-btn"
				:class="{ active: viewMode === 'split' }"
				@click="setMode('split')"
				title="Split"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<rect x="2" y="4" width="9" height="16" rx="1" />
					<rect x="13" y="4" width="9" height="16" rx="1" />
				</svg>
				<span>SPLIT</span>
			</button>
		</div>

		<!-- ── TOP CENTRE ─ Link status ──────────────────────────────── -->
		<div class="hud top-center">
			<div class="status-pill">
				<span class="link-dot" :class="{ linked: connected }"></span>
				<span class="lbl">LINK</span>
				<span class="sep">|</span>
				<svg class="ico" viewBox="0 0 24 24" fill="currentColor">
					<path d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				<span class="lbl">{{ stats.ping }}ms</span>
				<span class="sep">|</span>
				<svg class="ico" viewBox="0 0 24 24" fill="currentColor">
					<rect
						x="2"
						y="16"
						width="3"
						height="6"
						rx="1"
						:opacity="stats.bars >= 1 ? 1 : 0.25"
					/>
					<rect
						x="7"
						y="11"
						width="3"
						height="11"
						rx="1"
						:opacity="stats.bars >= 2 ? 1 : 0.25"
					/>
					<rect
						x="12"
						y="6"
						width="3"
						height="16"
						rx="1"
						:opacity="stats.bars >= 3 ? 1 : 0.25"
					/>
					<rect
						x="17"
						y="2"
						width="3"
						height="20"
						rx="1"
						:opacity="stats.bars >= 4 ? 1 : 0.25"
					/>
				</svg>
				<span class="lbl">{{ stats.signalLabel }}</span>
			</div>
		</div>

		<!-- ── TOP RIGHT ─ Controller selector ───────────────────────── -->
		<div class="hud top-right">
			<button class="icon-btn" :class="{ active: true }" title="Wireless">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M5 12.55A11 11 0 0 1 19 12.55" />
					<path d="M1.42 9A16 16 0 0 1 22.58 9" />
					<path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
					<circle cx="12" cy="20" r="1" fill="currentColor" />
				</svg>
			</button>
			<button class="icon-btn active" title="Signal">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M1.42 9a16 16 0 0 1 21.16 0" />
					<path d="M5 12.55a11 11 0 0 1 14 0" />
					<path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
					<circle cx="12" cy="20" r="1" fill="currentColor" />
				</svg>
			</button>
			<button
				class="icon-btn"
				title="Controller"
				@click="cycleController"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<rect x="2" y="6" width="20" height="12" rx="4" />
					<circle cx="7" cy="12" r="1.5" fill="currentColor" />
					<path d="M11 10h2m-1-1v2" />
					<circle cx="17" cy="12" r="0.5" fill="currentColor" />
					<circle cx="15" cy="10" r="0.5" fill="currentColor" />
				</svg>
			</button>
		</div>

		<!-- ── BOTTOM CENTRE ─ CPU temp ──────────────────────────────── -->
		<div class="hud bottom-center">
			<div class="temp-pill" :class="{ hot: stats.cpuTemp > 70 }">
				<svg
					class="ico"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<rect x="4" y="4" width="16" height="16" rx="2" />
					<rect x="9" y="9" width="6" height="6" rx="1" />
					<line x1="9" y1="1" x2="9" y2="4" />
					<line x1="15" y1="1" x2="15" y2="4" />
					<line x1="9" y1="20" x2="9" y2="23" />
					<line x1="15" y1="20" x2="15" y2="23" />
					<line x1="20" y1="9" x2="23" y2="9" />
					<line x1="20" y1="15" x2="23" y2="15" />
					<line x1="1" y1="9" x2="4" y2="9" />
					<line x1="1" y1="15" x2="4" y2="15" />
				</svg>
				<span class="temp-val">{{ stats.cpuTemp }}°C</span>
			</div>
		</div>

		<!-- ── BOTTOM LEFT ─ D-pad ───────────────────────────────────── -->
		<div class="hud bottom-left">
			<div class="dpad">
				<button
					class="dp dp-up"
					@pointerdown.prevent="dpad('w', true)"
					@pointerup="dpad('w', false)"
					@pointerleave="dpad('w', false)"
				>
					<svg viewBox="0 0 24 24">
						<path d="M12 5l-8 8h16z" fill="currentColor" />
					</svg>
				</button>
				<button
					class="dp dp-left"
					@pointerdown.prevent="dpad('a', true)"
					@pointerup="dpad('a', false)"
					@pointerleave="dpad('a', false)"
				>
					<svg viewBox="0 0 24 24">
						<path d="M5 12l8-8v16z" fill="currentColor" />
					</svg>
				</button>
				<div class="dp-center"></div>
				<button
					class="dp dp-right"
					@pointerdown.prevent="dpad('d', true)"
					@pointerup="dpad('d', false)"
					@pointerleave="dpad('d', false)"
				>
					<svg viewBox="0 0 24 24">
						<path d="M19 12l-8 8V4z" fill="currentColor" />
					</svg>
				</button>
				<button
					class="dp dp-down"
					@pointerdown.prevent="dpad('s', true)"
					@pointerup="dpad('s', false)"
					@pointerleave="dpad('s', false)"
				>
					<svg viewBox="0 0 24 24">
						<path d="M12 19l8-8H4z" fill="currentColor" />
					</svg>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { AUVLogic } from "../composable/auvLogic.js";

const mainCanvas = ref(null);
let auvLogic = null;
let statsInterval = null;

const viewMode = ref("split");
const connected = ref(true);
const stats = reactive({
	ping: 16,
	cpuTemp: 58.0,
	signalLabel: "STRONG",
	bars: 3,
});

function setMode(mode) {
	viewMode.value = mode;
	auvLogic?.setMode(mode);
}

function dpad(key, pressed) {
	auvLogic?.dpadInput(key, pressed);
}

function cycleController() {
	/* future: keyboard / gamepad switch */
}

onMounted(() => {
	setTimeout(() => {
		if (mainCanvas.value) {
			try {
				auvLogic = new AUVLogic(mainCanvas.value);
				// Sync default mode
				auvLogic.setMode(viewMode.value);
			} catch (e) {
				console.error("Sim init error:", e);
			}
		}
		// Poll stats from simulation every 400 ms
		statsInterval = setInterval(() => {
			if (!auvLogic) return;
			const s = auvLogic.getStats();
			stats.ping = s.ping;
			stats.cpuTemp = s.cpuTemp;
			stats.signalLabel = s.signalLabel;
			stats.bars = s.bars;
		}, 400);
	}, 100);
});

onUnmounted(() => {
	clearInterval(statsInterval);
	auvLogic?.dispose();
});
</script>

<style scoped src="../assets/home.css"></style>

<style scoped>
/* ── HUD base ────────────────────────────────────────────────── */
.hud {
	position: absolute;
	z-index: 10;
	pointer-events: none;
	user-select: none;
}
.hud button,
.hud .dpad {
	pointer-events: all;
}

/* ── Positions ───────────────────────────────────────────────── */
.top-left {
	top: 18px;
	left: 18px;
	display: flex;
	gap: 6px;
	align-items: center;
}
.top-center {
	top: 18px;
	left: 50%;
	transform: translateX(-50%);
}
.top-right {
	top: 14px;
	right: 14px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	align-items: center;
}
.bottom-center {
	bottom: 22px;
	left: 50%;
	transform: translateX(-50%);
}
.bottom-left {
	bottom: 20px;
	left: 20px;
}

/* ── Mode buttons (top-left) ─────────────────────────────────── */
.mode-btn {
	display: flex;
	align-items: center;
	gap: 5px;
	background: rgba(20, 22, 28, 0.72);
	border: 1.5px solid rgba(255, 255, 255, 0.18);
	border-radius: 999px;
	color: rgba(255, 255, 255, 0.65);
	padding: 6px 12px;
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.05em;
	cursor: pointer;
	backdrop-filter: blur(8px);
	transition:
		background 0.15s,
		color 0.15s,
		border-color 0.15s;
}
.mode-btn svg {
	width: 16px;
	height: 16px;
}
.mode-btn:hover {
	background: rgba(40, 44, 54, 0.9);
	color: #fff;
}
.mode-btn.active {
	background: rgba(28, 168, 82, 0.22);
	border-color: #1ca852;
	color: #2edb72;
}
.split-btn {
	padding: 6px 14px;
}

/* ── Status pill (top-center) ────────────────────────────────── */
.status-pill {
	display: flex;
	align-items: center;
	gap: 7px;
	background: rgba(20, 22, 28, 0.72);
	border: 1.5px solid rgba(255, 255, 255, 0.18);
	border-radius: 999px;
	padding: 7px 18px;
	backdrop-filter: blur(8px);
	color: #2edb72;
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.06em;
	white-space: nowrap;
}
.link-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: #666;
	transition: background 0.3s;
}
.link-dot.linked {
	background: #2edb72;
	box-shadow: 0 0 6px #2edb72;
}
.ico {
	width: 14px;
	height: 14px;
}
.sep {
	color: rgba(255, 255, 255, 0.25);
	font-weight: 300;
}
.lbl {
	color: #fff;
}

/* ── Icon buttons (top-right) ────────────────────────────────── */
.icon-btn {
	width: 42px;
	height: 42px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(20, 22, 28, 0.72);
	border: 1.5px solid rgba(255, 255, 255, 0.18);
	border-radius: 12px;
	color: rgba(255, 255, 255, 0.6);
	cursor: pointer;
	backdrop-filter: blur(8px);
	transition:
		background 0.15s,
		color 0.15s;
}
.icon-btn svg {
	width: 20px;
	height: 20px;
}
.icon-btn.active {
	background: rgba(28, 168, 82, 0.22);
	border-color: #1ca852;
	color: #2edb72;
}
.icon-btn:hover {
	background: rgba(40, 44, 54, 0.9);
	color: #fff;
}

/* ── Temp pill (bottom-center) ───────────────────────────────── */
.temp-pill {
	display: flex;
	align-items: center;
	gap: 8px;
	background: rgba(20, 22, 28, 0.72);
	border: 1.5px solid rgba(255, 255, 255, 0.18);
	border-radius: 999px;
	padding: 6px 18px;
	backdrop-filter: blur(8px);
	color: #fff;
	font-size: 13px;
	font-weight: 700;
	white-space: nowrap;
}
.temp-pill .ico {
	width: 18px;
	height: 18px;
	color: #f97316;
}
.temp-pill.hot .ico {
	color: #ef4444;
}
.temp-val {
	color: #f97316;
}
.temp-pill.hot .temp-val {
	color: #ef4444;
	animation: pulse 0.8s ease infinite alternate;
}
@keyframes pulse {
	from {
		opacity: 1;
	}
	to {
		opacity: 0.6;
	}
}

/* ── D-pad (bottom-left) ─────────────────────────────────────── */
.dpad {
	width: 128px;
	height: 128px;
	background: rgba(12, 14, 20, 0.8);
	border-radius: 50%;
	border: 1.5px solid rgba(255, 255, 255, 0.12);
	backdrop-filter: blur(10px);
	position: relative;
}
.dp {
	position: absolute;
	width: 38px;
	height: 38px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	color: rgba(255, 255, 255, 0.6);
	cursor: pointer;
	border-radius: 6px;
	transition:
		color 0.1s,
		background 0.1s;
}
.dp svg {
	width: 18px;
	height: 18px;
}
.dp:active,
.dp:hover {
	color: #fff;
	background: rgba(255, 255, 255, 0.1);
}
.dp-up {
	top: 8px;
	left: 50%;
	transform: translateX(-50%);
}
.dp-down {
	bottom: 8px;
	left: 50%;
	transform: translateX(-50%);
}
.dp-left {
	left: 8px;
	top: 50%;
	transform: translateY(-50%);
}
.dp-right {
	right: 8px;
	top: 50%;
	transform: translateY(-50%);
}
.dp-center {
	position: absolute;
	width: 14px;
	height: 14px;
	background: rgba(100, 120, 160, 0.6);
	border-radius: 50%;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	box-shadow: 0 0 6px rgba(100, 140, 255, 0.4);
}

/* ── Split divider ───────────────────────────────────────────── */
.split-divider {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 50%;
	width: 2px;
	background: rgba(255, 255, 255, 0.2);
	z-index: 8;
	pointer-events: none;
}

/* ── Thermal tint overlay ─────────────────────────────────────── */
.thermal-tint {
	position: absolute;
	top: 0;
	left: 0;
	width: 50%;
	height: 100%;
	pointer-events: none;
	z-index: 6;
	mix-blend-mode: color;
	background: radial-gradient(
		ellipse at 40% 50%,
		rgba(255, 60, 30, 0.85) 0%,
		rgba(200, 0, 60, 0.75) 50%,
		rgba(140, 0, 80, 0.65) 100%
	);
	transition:
		width 0.2s,
		opacity 0.2s;
}
.thermal-tint.tint-full {
	width: 100%;
}
.thermal-tint.tint-off {
	opacity: 0;
}
</style>
