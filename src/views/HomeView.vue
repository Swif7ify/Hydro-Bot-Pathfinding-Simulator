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
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13"
					/>
					<path
						d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 11"
					/>
				</svg>
			</button>
			<button class="icon-btn" title="Signal">
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
					@pointercancel="dpad('w', false)"
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
					@pointercancel="dpad('a', false)"
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
					@pointercancel="dpad('d', false)"
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
					@pointercancel="dpad('s', false)"
				>
					<svg viewBox="0 0 24 24">
						<path d="M12 19l8-8H4z" fill="currentColor" />
					</svg>
				</button>
			</div>
		</div>

		<!-- ── THERMAL DETECTION RETICLE ──────────────────────────── -->
		<div
			v-if="hotTarget && (viewMode === 'thermal' || viewMode === 'split')"
			class="hud reticle-wrap"
			:style="reticleStyle"
		>
			<div
				class="reticle"
				:class="{ 'reticle-hot': hotTarget.heat > 0.7 }"
			>
				<div class="rc tl"></div>
				<div class="rc tr"></div>
				<div class="rc bl"></div>
				<div class="rc br"></div>
				<div class="reticle-cross"></div>
				<div class="reticle-info">
					<span class="ri-name">{{ hotTarget.label }}</span>
					<span class="ri-temp">{{ hotTarget.tempC }}°C</span>
				</div>
			</div>
		</div>

		<!-- ── ESC MENU ────────────────────────────────────────────── -->
		<Transition name="menu-fade">
			<div v-if="menuOpen" class="esc-overlay" @click.self="resume">
				<div class="esc-panel">
					<div class="esc-logo">
						<span class="esc-logo-h">HYDRO</span
						><span class="esc-logo-b">BOT</span>
					</div>
					<p class="esc-sub">Pathfinding Simulator</p>
					<div class="esc-divider"></div>

					<button class="esc-btn primary" @click="resume">
						▶︎ RESUME
					</button>

					<div class="esc-section">
						<p class="esc-section-label">VIEW MODE</p>
						<div class="esc-btn-row">
							<button
								:class="[
									'esc-mode',
									{ active: viewMode === 'thermal' },
								]"
								@click="
									setMode('thermal');
									resume();
								"
							>
								&#127777; Thermal
							</button>
							<button
								:class="[
									'esc-mode',
									{ active: viewMode === 'camera' },
								]"
								@click="
									setMode('camera');
									resume();
								"
							>
								&#128065; Camera
							</button>
							<button
								:class="[
									'esc-mode',
									{ active: viewMode === 'split' },
								]"
								@click="
									setMode('split');
									resume();
								"
							>
								&#9633; Split
							</button>
						</div>
					</div>

					<div class="esc-divider"></div>
					<div class="esc-keys">
						<div class="esc-key-row">
							<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd
							><span>Move robot</span>
						</div>
						<div class="esc-key-row">
							<kbd>ESC</kbd><span>Toggle menu</span>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { AUVLogic } from "../composable/auvLogic.js";

const mainCanvas = ref(null);
let auvLogic = null;
let statsInterval = null;
let reticleInterval = null;

const viewMode = ref("split");
const connected = ref(true);
const menuOpen = ref(false);
const hotTarget = ref(null);
const stats = reactive({
	ping: 16,
	cpuTemp: 58.0,
	signalLabel: "STRONG",
	bars: 3,
});

// Position the reticle inside the thermal viewport
const reticleStyle = computed(() => {
	if (!hotTarget.value) return {};
	const xPct =
		viewMode.value === "split"
			? hotTarget.value.vx * 50 // left half only
			: hotTarget.value.vx * 100;
	return {
		left: xPct + "%",
		top: hotTarget.value.vy * 100 + "%",
		transform: "translate(-50%, -50%)",
	};
});

function setMode(mode) {
	viewMode.value = mode;
	auvLogic?.setMode(mode);
}
function dpad(key, pressed) {
	auvLogic?.dpadInput(key, pressed);
}
function cycleController() {}
function resume() {
	menuOpen.value = false;
	auvLogic?.setPaused(false);
}

const _escHandler = (e) => {
	if (e.key === "Escape") {
		e.preventDefault();
		menuOpen.value = !menuOpen.value;
		auvLogic?.setPaused(menuOpen.value);
	}
};

onMounted(() => {
	window.addEventListener("keydown", _escHandler);
	setTimeout(() => {
		if (mainCanvas.value) {
			try {
				auvLogic = new AUVLogic(mainCanvas.value);
				auvLogic.setMode(viewMode.value);
				// Sync ESC from sim back to Vue (keyboard handler in sim fires first)
				auvLogic.onMenuToggle = (v) => {
					menuOpen.value = v;
				};
			} catch (e) {
				console.error("Sim init error:", e);
			}
		}
		statsInterval = setInterval(() => {
			if (!auvLogic) return;
			const s = auvLogic.getStats();
			stats.ping = s.ping;
			stats.cpuTemp = s.cpuTemp;
			stats.signalLabel = s.signalLabel;
			stats.bars = s.bars;
		}, 400);
		reticleInterval = setInterval(() => {
			if (!auvLogic) return;
			hotTarget.value = auvLogic.getHotTarget();
		}, 80);
	}, 100);
});

onUnmounted(() => {
	window.removeEventListener("keydown", _escHandler);
	clearInterval(statsInterval);
	clearInterval(reticleInterval);
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
	gap: 6px;
	background: rgba(255, 255, 255, 0.9);
	border: 1.5px solid rgba(0, 0, 60, 0.12);
	border-radius: 999px;
	color: #374151;
	padding: 8px 16px;
	font-size: 13px;
	font-weight: 600;
	letter-spacing: 0.05em;
	cursor: pointer;
	backdrop-filter: blur(8px);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	transition:
		background 0.15s,
		color 0.15s,
		border-color 0.15s;
}
.mode-btn svg {
	width: 20px;
	height: 20px;
}
.mode-btn:hover {
	background: rgba(240, 242, 255, 1);
	color: #0066ff;
	border-color: rgba(0, 102, 255, 0.3);
}
.mode-btn.active {
	background: rgba(0, 102, 255, 0.1);
	border-color: #0066ff;
	color: #0066ff;
}
.split-btn {
	padding: 8px 18px;
}

/* ── Status pill (top-center) ────────────────────────────────── */
.status-pill {
	display: flex;
	align-items: center;
	gap: 8px;
	background: rgba(255, 255, 255, 0.9);
	border: 1.5px solid rgba(0, 0, 60, 0.12);
	border-radius: 999px;
	padding: 9px 22px;
	backdrop-filter: blur(8px);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	color: #0066ff;
	font-size: 13px;
	font-weight: 700;
	letter-spacing: 0.06em;
	white-space: nowrap;
}
.link-dot {
	width: 9px;
	height: 9px;
	border-radius: 50%;
	background: #bbb;
	transition: background 0.3s;
}
.link-dot.linked {
	background: #0066ff;
	box-shadow: 0 0 7px #0066ff;
}
.ico {
	width: 17px;
	height: 17px;
}
.sep {
	color: rgba(0, 0, 0, 0.2);
	font-weight: 300;
}
.lbl {
	color: #111827;
}

/* ── Icon buttons (top-right) ────────────────────────────────── */
.icon-btn {
	width: 50px;
	height: 50px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(255, 255, 255, 0.9);
	border: 1.5px solid rgba(0, 0, 60, 0.12);
	border-radius: 14px;
	color: #374151;
	cursor: pointer;
	backdrop-filter: blur(8px);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	transition:
		background 0.15s,
		color 0.15s;
}
.icon-btn svg {
	width: 24px;
	height: 24px;
}
.icon-btn.active {
	background: rgba(0, 102, 255, 0.1);
	border-color: #0066ff;
	color: #0066ff;
}
.icon-btn:hover {
	background: rgba(240, 242, 255, 1);
	color: #0066ff;
	border-color: rgba(0, 102, 255, 0.3);
}

/* ── Temp pill (bottom-center) ───────────────────────────────── */
.temp-pill {
	display: flex;
	align-items: center;
	gap: 9px;
	background: rgba(255, 255, 255, 0.9);
	border: 1.5px solid rgba(0, 0, 60, 0.12);
	border-radius: 999px;
	padding: 8px 22px;
	backdrop-filter: blur(8px);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	color: #111827;
	font-size: 15px;
	font-weight: 700;
	white-space: nowrap;
}
.temp-pill .ico {
	width: 22px;
	height: 22px;
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
	width: 155px;
	height: 155px;
	background: rgba(255, 255, 255, 0.88);
	border-radius: 50%;
	border: 1.5px solid rgba(0, 0, 60, 0.12);
	backdrop-filter: blur(10px);
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
	position: relative;
	touch-action: none;
}
.dp {
	position: absolute;
	width: 46px;
	height: 46px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	color: #374151;
	cursor: pointer;
	border-radius: 8px;
	transition:
		color 0.1s,
		background 0.1s;
}
.dp svg {
	width: 22px;
	height: 22px;
}
.dp:active,
.dp:hover {
	color: #0066ff;
	background: rgba(0, 102, 255, 0.1);
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
	width: 16px;
	height: 16px;
	background: rgba(0, 102, 255, 0.25);
	border-radius: 50%;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	box-shadow: 0 0 8px rgba(0, 102, 255, 0.3);
}

/* ── Split divider ───────────────────────────────────────────── */
.split-divider {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 50%;
	width: 2px;
	background: rgba(0, 0, 0, 0.15);
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

/* ══ THERMAL DETECTION RETICLE ══════════════════════════════════════════════ */
.reticle-wrap {
	position: absolute;
	pointer-events: none;
	z-index: 40;
}
.reticle {
	position: relative;
	width: 72px;
	height: 72px;
}
.rc {
	position: absolute;
	width: 14px;
	height: 14px;
	border-color: #0ff;
	border-style: solid;
	border-width: 0;
}
.rc.tl {
	top: 0;
	left: 0;
	border-top-width: 2px;
	border-left-width: 2px;
}
.rc.tr {
	top: 0;
	right: 0;
	border-top-width: 2px;
	border-right-width: 2px;
}
.rc.bl {
	bottom: 0;
	left: 0;
	border-bottom-width: 2px;
	border-left-width: 2px;
}
.rc.br {
	bottom: 0;
	right: 0;
	border-bottom-width: 2px;
	border-right-width: 2px;
}

.reticle-hot .rc {
	border-color: #f40;
	animation: reticle-pulse 0.6s infinite alternate;
}
@keyframes reticle-pulse {
	from {
		opacity: 1;
	}
	to {
		opacity: 0.35;
	}
}

.reticle-cross {
	position: absolute;
	inset: 0;
	margin: auto;
	width: 12px;
	height: 12px;
}
.reticle-cross::before,
.reticle-cross::after {
	content: "";
	position: absolute;
	background: rgba(0, 255, 255, 0.7);
}
.reticle-cross::before {
	width: 1px;
	height: 100%;
	left: 50%;
}
.reticle-cross::after {
	height: 1px;
	width: 100%;
	top: 50%;
}
.reticle-hot .reticle-cross::before,
.reticle-hot .reticle-cross::after {
	background: rgba(255, 80, 0, 0.8);
}

.reticle-info {
	position: absolute;
	bottom: -34px;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1px;
	white-space: nowrap;
}
.ri-name {
	font-family: "Courier New", monospace;
	font-size: 9px;
	font-weight: 700;
	letter-spacing: 0.1em;
	color: #0ff;
	text-shadow: 0 0 6px #0ff;
}
.ri-temp {
	font-family: "Courier New", monospace;
	font-size: 9px;
	color: #111827;
	opacity: 0.85;
}
.reticle-hot .ri-name {
	color: #ff5000;
	text-shadow: 0 0 6px #ff5000;
}

/* ══ ESC MENU ════════════════════════════════════════════════════════════════ */
.esc-overlay {
	position: absolute;
	inset: 0;
	z-index: 100;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(240, 244, 255, 0.82);
	backdrop-filter: blur(6px);
}
.esc-panel {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 18px;
	background: rgba(255, 255, 255, 0.97);
	border: 1.5px solid rgba(0, 102, 255, 0.18);
	border-radius: 16px;
	padding: 40px 48px;
	min-width: 320px;
	box-shadow:
		0 8px 40px rgba(0, 60, 180, 0.12),
		0 2px 8px rgba(0, 0, 0, 0.06);
}
.esc-logo {
	font-family: "Courier New", monospace;
	font-size: 32px;
	letter-spacing: 0.18em;
	font-weight: 900;
}
.esc-logo-h {
	color: #0066ff;
}
.esc-logo-b {
	color: #111827;
}
.esc-sub {
	font-size: 11px;
	letter-spacing: 0.22em;
	color: rgba(60, 80, 120, 0.65);
	margin: 0;
	text-transform: uppercase;
}
.esc-divider {
	width: 100%;
	height: 1px;
	background: linear-gradient(
		90deg,
		transparent,
		rgba(0, 100, 255, 0.25),
		transparent
	);
}
.esc-btn {
	width: 100%;
	padding: 12px 0;
	border-radius: 8px;
	border: 1.5px solid rgba(0, 102, 255, 0.25);
	background: rgba(0, 102, 255, 0.05);
	color: #0066ff;
	font-family: "Courier New", monospace;
	font-size: 14px;
	letter-spacing: 0.14em;
	cursor: pointer;
	transition:
		background 0.18s,
		box-shadow 0.18s;
}
.esc-btn.primary {
	background: #0066ff;
	border-color: #0050cc;
	color: #fff;
	font-weight: 700;
	font-size: 15px;
}
.esc-btn:hover {
	background: rgba(0, 102, 255, 0.12);
	box-shadow: 0 0 14px rgba(0, 102, 255, 0.2);
}
.esc-btn.primary:hover {
	background: #0050cc;
	box-shadow: 0 4px 18px rgba(0, 80, 200, 0.35);
}
.esc-section {
	width: 100%;
}
.esc-section-label {
	font-size: 10px;
	letter-spacing: 0.2em;
	color: rgba(60, 80, 140, 0.55);
	text-align: center;
	margin: 0 0 8px;
	text-transform: uppercase;
}
.esc-btn-row {
	display: flex;
	gap: 8px;
	justify-content: center;
}
.esc-mode {
	flex: 1;
	padding: 9px 6px;
	border-radius: 8px;
	border: 1.5px solid rgba(0, 102, 255, 0.18);
	background: rgba(240, 244, 255, 0.8);
	color: #374151;
	font-family: "Courier New", monospace;
	font-size: 11px;
	letter-spacing: 0.06em;
	cursor: pointer;
	transition:
		background 0.15s,
		border-color 0.15s;
}
.esc-mode:hover {
	background: rgba(210, 222, 255, 0.9);
	border-color: rgba(0, 102, 255, 0.4);
}
.esc-mode.active {
	background: rgba(0, 102, 255, 0.1);
	border-color: #0066ff;
	color: #0066ff;
	font-weight: 700;
}
.esc-keys {
	display: flex;
	flex-direction: column;
	gap: 7px;
	align-items: center;
}
.esc-key-row {
	display: flex;
	align-items: center;
	gap: 5px;
	font-size: 11px;
	color: rgba(60, 80, 120, 0.65);
}
.esc-key-row span {
	margin-left: 4px;
}
kbd {
	display: inline-block;
	padding: 3px 8px;
	border-radius: 5px;
	border: 1.5px solid rgba(0, 102, 255, 0.22);
	background: rgba(230, 237, 255, 0.8);
	font-family: "Courier New", monospace;
	font-size: 10px;
	color: #1a3a6e;
}

/* ── Menu fade transition ─── */
.menu-fade-enter-active,
.menu-fade-leave-active {
	transition: opacity 0.22s ease;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
	opacity: 0;
}
</style>
