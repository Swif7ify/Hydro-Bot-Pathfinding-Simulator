import { ref, onMounted, watch } from "vue";
import * as THREE from "three";

export function usePathFinder(mainCanvas, miniMapCanvas, miniMapFog) {
	// State and config for HYDROBOT
	const poolSize = ref(50);
	const waterDepth = ref(8);
	const patterns = [
		"surface-sweep",
		"spiral-dive",
		"depth-layers",
		"debris-navigation",
		"thermal-tracking",
	];
	const currentPattern = ref("thermal-tracking");
	const modes = ["auto", "manual", "rescue-mode", "deep-search"];
	const currentMode = ref("auto"); // Start in auto for testing pathfinding
	const sonarRadius = ref(15);
	const sonarNumRays = ref(60);
	const thermalRadius = ref(18); // Much larger detection range
	const texturesEnabled = ref(true);
	const heatDetected = ref(false);
	const numVictims = ref(8); // More victims for testing
	const numDebris = ref(3); // Fewer debris to start
	const robotSpeed = ref(0.4); // Much faster movement
	const divingSpeed = ref(0.2);
	const cameraMode = ref("overview"); // Start with overview for better pathfinding visibility
	const ballastLevel = ref(0); // 0 = surface, 1 = fully submerged
	const waterTurbidity = ref(0.1); // Very clear water for easier detection
	const currentDepth = ref(0);
	const maxDiveDepth = ref(6);
	const detectedHeatTypes = ref([]);
	const missionStatus = ref("MANUAL CONTROL");
	const victimsFound = ref(0);
	const areaSearched = ref(0);
	const batteryLevel = ref(100);
	const waterTemperature = ref(24); // Celsius
	const oxygenLevel = ref(100);

	// Heat signature types for flood rescue
	const heatTypes = [
		{
			name: "Human Survivor",
			color: 0xff1111,
			emissive: 0xff0000,
			temp: 37,
			size: 0.9,
			priority: 1,
			underwater: true,
			description: "Living person - immediate rescue priority",
		},
		{
			name: "Injured Victim",
			color: 0xff3333,
			emissive: 0xff1111,
			temp: 35,
			size: 0.8,
			priority: 2,
			underwater: true,
			description: "Injured person - urgent medical attention needed",
		},
		{
			name: "Deceased Body",
			color: 0xff6666,
			emissive: 0x660000,
			temp: 28,
			size: 0.7,
			priority: 3,
			underwater: true,
			description: "Deceased - recovery operation",
		},
		{
			name: "Trapped Animal",
			color: 0xff8800,
			emissive: 0xff4400,
			temp: 39,
			size: 0.5,
			priority: 4,
			underwater: true,
			description: "Animal - rescue if possible",
		},
		{
			name: "Submerged Vehicle",
			color: 0xff9900,
			emissive: 0x994400,
			temp: 22,
			size: 1.5,
			priority: null,
			underwater: true,
			description: "Vehicle - check for occupants",
		},
	];

	// Control and scene objects - make it reactive
	const manualControl = ref({
		forward: false,
		backward: false,
		left: false,
		right: false,
		dive: false,
		surface: false,
	});

	let hydrobot = null;
	let waterSurface = null;
	let poolBottom = null;
	let wallMeshes = [];
	let debrisMeshes = [];
	let victimMeshes = [];
	let bubbleSystem = null;
	let mainScene = null;
	let fogCtx = null;
	let mainRenderer,
		mainCamera,
		miniRenderer,
		miniCamera,
		thermalGroup,
		sonarGroup;
	let animationId = null;

	// Navigation and search state
	let exploring = true;
	let divingMode = false;
	let surfaceMode = true;
	let targetDepth = 0;
	let currentSearchDepth = 0;
	let searchLayerIndex = 0;
	let spiralState = null;
	let thermalScanActive = false;
	let ballastTimer = 0;
	let emergencyAscent = false;
	let currentTarget = null;
	let searchGrid = [];
	let currentGridIndex = 0;
	let lastPosition = { x: 0, z: 0, y: 0 };
	let stuckTimer = 0;
	let debrisAvoidance = false;
	let thermalDetectionRange = 12;
	let depthLayers = [0, -2, -4, -6]; // Surface, shallow, medium, deep
	let currentLayer = 0;
	let heatScanCooldown = 0;

	// Geometry/materials for underwater rendering
	let thermalPointGeometry = new THREE.SphereGeometry(0.08, 8, 8);
	let sonarPointGeometry = new THREE.SphereGeometry(0.06, 8, 8);
	let victimPointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
	let debrisPointMaterial = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
	let thermalPointMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 });
	let sonarPointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
	let priorityVictimMaterial = new THREE.MeshBasicMaterial({
		color: 0xff00ff,
	});

	// Movement targets
	let targetPosition = { x: 0, y: 0, z: 0 };
	let targetRotation = 0;
	let ballastTarget = 0;
	let smoothingFactor = 0.2;

	// Sensor data
	let thermalData = {
		heatSources: [],
		temperatureMap: new Map(),
		victimDetections: [],
		priorityTargets: [],
	};

	let sonarData = {
		obstacles: [],
		debris: [],
		bottomContour: [],
		clearPaths: [],
	};

	// Mission planning
	let missionData = {
		searchPattern: null,
		waypoints: [],
		currentWaypoint: 0,
		rescueTargets: [],
		completedAreas: new Set(),
		searchLayers: [],
	};

	// Water environment effects
	let waterParticles = null;
	let thermalGradient = null;
	let currentFlow = { x: 0.02, z: 0.01 }; // Simulated water current

	// Toggle Functions
	function togglePattern() {
		const idx = patterns.indexOf(currentPattern.value);
		currentPattern.value = patterns[(idx + 1) % patterns.length];
		resetPatternStates();
		generateMissionPlan();
	}

	function toggleMode() {
		const idx = modes.indexOf(currentMode.value);
		currentMode.value = modes[(idx + 1) % modes.length];

		// Mode-specific settings
		if (currentMode.value === "manual") {
			missionStatus.value = "MANUAL CONTROL";
		} else if (currentMode.value === "rescue-mode") {
			missionStatus.value = "RESCUE OPERATIONS";
			robotSpeed.value = 0.18;
			thermalRadius.value = 12;
		} else if (currentMode.value === "deep-search") {
			missionStatus.value = "DEEP WATER SEARCH";
			robotSpeed.value = 0.08;
			maxDiveDepth.value = 8;
		} else {
			missionStatus.value = "AUTO SEARCH";
			robotSpeed.value = 0.12;
		}

		generateMissionPlan();
	}

	function toggleCameraMode() {
		const modes = [
			"first-person",
			"third-person",
			"underwater",
			"thermal",
			"sonar",
			"overview",
		];
		const idx = modes.indexOf(cameraMode.value);
		cameraMode.value = modes[(idx + 1) % modes.length];
	}

	function emergencyDive() {
		ballastTarget = 1;
		targetDepth = -maxDiveDepth.value;
		divingMode = true;
		surfaceMode = false;
		missionStatus.value = "EMERGENCY DIVE";
	}

	function emergencySurface() {
		ballastTarget = 0;
		targetDepth = 0;
		divingMode = false;
		surfaceMode = true;
		emergencyAscent = true;
		missionStatus.value = "EMERGENCY SURFACE";
	}

	// Mission planning for water rescue
	function generateMissionPlan() {
		missionData.waypoints = [];
		searchGrid = [];

		const poolS = poolSize.value;

		if (currentPattern.value === "surface-sweep") {
			generateSurfaceSweepWaypoints(poolS);
		} else if (currentPattern.value === "spiral-dive") {
			generateSpiralDiveWaypoints(poolS);
		} else if (currentPattern.value === "depth-layers") {
			generateDepthLayerWaypoints(poolS);
		} else if (currentPattern.value === "debris-navigation") {
			generateDebrisNavigationWaypoints(poolS);
		} else if (currentPattern.value === "thermal-tracking") {
			generateThermalTrackingWaypoints(poolS);
		}

		currentGridIndex = 0;
		missionData.currentWaypoint = 0;
		areaSearched.value = 0;
	}

	function generateSurfaceSweepWaypoints(poolS) {
		// Surface scanning in a grid pattern
		const step = 4;
		let y = 0;

		for (let x = -poolS / 2 + 2; x < poolS / 2 - 2; x += step) {
			for (let z = -poolS / 2 + 2; z < poolS / 2 - 2; z += step) {
				missionData.waypoints.push({
					x,
					y,
					z,
					depth: 0,
					scanMode: "thermal",
					searchType: "surface",
				});
			}
		}
	}

	function generateSpiralDiveWaypoints(poolS) {
		// Spiral pattern with depth changes
		const points = 24;
		const maxRadius = poolS * 0.4;

		for (let i = 0; i < points; i++) {
			const angle = (i / points) * Math.PI * 4;
			const radius = (i / points) * maxRadius;
			const depth = -(i / points) * maxDiveDepth.value;

			const x = Math.cos(angle) * radius;
			const z = Math.sin(angle) * radius;

			missionData.waypoints.push({
				x,
				y: depth,
				z,
				depth: depth,
				scanMode: "thermal-sonar",
				searchType: "spiral",
			});
		}
	}

	function generateDepthLayerWaypoints(poolS) {
		// Systematic layer-by-layer search
		const step = 5;

		for (let layer = 0; layer < depthLayers.length; layer++) {
			const depth = depthLayers[layer];

			for (let x = -poolS / 2 + 3; x < poolS / 2 - 3; x += step) {
				for (let z = -poolS / 2 + 3; z < poolS / 2 - 3; z += step) {
					missionData.waypoints.push({
						x,
						y: depth,
						z,
						depth: depth,
						scanMode: "thermal",
						searchType: "layer",
						layer: layer,
					});
				}
			}
		}
	}

	function generateDebrisNavigationWaypoints(poolS) {
		// Navigate around debris while searching
		const numPoints = 16;
		for (let i = 0; i < numPoints; i++) {
			const angle = (i / numPoints) * Math.PI * 2;
			const radius = poolS * 0.3;
			const x = Math.cos(angle) * radius;
			const z = Math.sin(angle) * radius;
			const depth = -2; // Medium depth to avoid surface debris

			missionData.waypoints.push({
				x,
				y: depth,
				z,
				depth: depth,
				scanMode: "sonar-thermal",
				searchType: "debris-avoid",
			});
		}
	}

	function generateThermalTrackingWaypoints(poolS) {
		// Focus on areas with potential heat signatures
		if (thermalData.heatSources.length > 0) {
			thermalData.heatSources.forEach((source) => {
				// Create search pattern around detected heat
				for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
					const offset = 3;
					const x = source.x + Math.cos(angle) * offset;
					const z = source.z + Math.sin(angle) * offset;

					missionData.waypoints.push({
						x,
						y: source.y,
						z,
						depth: source.y,
						scanMode: "thermal-focus",
						searchType: "thermal-track",
						target: source,
					});
				}
			});
		} else {
			// No heat sources yet, use wide search
			generateSurfaceSweepWaypoints(poolS);
		}
	}

	// Reset and setup functions
	function resetPatternStates() {
		exploring = true;
		divingMode = false;
		surfaceMode = true;
		targetDepth = 0;
		currentSearchDepth = 0;
		searchLayerIndex = 0;
		spiralState = null;
		thermalScanActive = false;
		ballastTimer = 0;
		emergencyAscent = false;
		currentTarget = null;
		debrisAvoidance = false;
		currentLayer = 0;
		heatScanCooldown = 0;
		ballastLevel.value = 0;
		currentDepth.value = 0;
		victimsFound.value = 0;
		areaSearched.value = 0;
		batteryLevel.value = 100;
		detectedHeatTypes.value = [];

		// Clear sensor data
		thermalData.heatSources = [];
		thermalData.temperatureMap.clear();
		thermalData.victimDetections = [];
		thermalData.priorityTargets = [];

		sonarData.obstacles = [];
		sonarData.debris = [];
		sonarData.bottomContour = [];
		sonarData.clearPaths = [];

		missionData.rescueTargets = [];
		missionData.completedAreas.clear();

		if (hydrobot) {
			hydrobot.position.set(0, 0, 0);
			hydrobot.rotation.y = 0;
		}
	}

	function resetSimulation() {
		resetPatternStates();

		if (mainScene) {
			// Clear existing meshes
			debrisMeshes.forEach((d) => mainScene.remove(d));
			victimMeshes.forEach((v) => mainScene.remove(v));
		}

		debrisMeshes.length = 0;
		victimMeshes.length = 0;

		if (fogCtx) {
			fogCtx.fillStyle = "rgba(0, 0, 0, 0.8)";
			fogCtx.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);
		}

		setupWaterEnvironment();
		generateMissionPlan();
	}

	// Scene setup for underwater environment
	function setupWaterEnvironment() {
		mainScene = new THREE.Scene();

		// Underwater atmosphere with better visibility
		mainScene.background = new THREE.Color(0x001122); // Dark underwater blue
		mainScene.fog = new THREE.Fog(0x001122, 5, 40); // Reduced fog distance

		// Water surface - visible but not obstructive
		const waterGeometry = new THREE.PlaneGeometry(
			poolSize.value,
			poolSize.value
		);
		const waterMaterial = new THREE.MeshPhongMaterial({
			color: 0x0088cc,
			transparent: true,
			opacity: 0.4,
			shininess: 100,
		});
		waterSurface = new THREE.Mesh(waterGeometry, waterMaterial);
		waterSurface.rotation.x = -Math.PI / 2;
		waterSurface.position.y = 0;
		mainScene.add(waterSurface);

		// Pool bottom - highly visible
		const bottomGeometry = new THREE.PlaneGeometry(
			poolSize.value,
			poolSize.value
		);
		const bottomMaterial = new THREE.MeshPhongMaterial({
			color: 0x664433,
		});
		poolBottom = new THREE.Mesh(bottomGeometry, bottomMaterial);
		poolBottom.rotation.x = -Math.PI / 2;
		poolBottom.position.y = -waterDepth.value;
		poolBottom.receiveShadow = true;
		mainScene.add(poolBottom);

		// Pool walls - solid barriers
		createPoolWalls();

		// Excellent underwater lighting
		const ambientLight = new THREE.AmbientLight(0x4488bb, 1.2);
		mainScene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xaaccff, 1.5);
		directionalLight.position.set(10, 15, 10);
		directionalLight.castShadow = true;
		directionalLight.shadow.mapSize.width = 2048;
		directionalLight.shadow.mapSize.height = 2048;
		directionalLight.shadow.camera.near = 0.5;
		directionalLight.shadow.camera.far = 50;
		directionalLight.shadow.camera.left = -25;
		directionalLight.shadow.camera.right = 25;
		directionalLight.shadow.camera.top = 25;
		directionalLight.shadow.camera.bottom = -25;
		mainScene.add(directionalLight);

		// Additional underwater lighting for visibility
		const underwaterLight1 = new THREE.PointLight(0x44aaff, 0.8, 30);
		underwaterLight1.position.set(15, -2, 15);
		mainScene.add(underwaterLight1);

		const underwaterLight2 = new THREE.PointLight(0x44aaff, 0.8, 30);
		underwaterLight2.position.set(-15, -2, -15);
		mainScene.add(underwaterLight2);

		// Emergency floodlights on robot
		const robotLight = new THREE.SpotLight(
			0xffffff,
			2,
			20,
			Math.PI / 6,
			0.5
		);
		robotLight.position.set(0, 0, 2);
		robotLight.target.position.set(0, 0, 5);

		// HYDROBOT creation
		createHydrobot();

		// Add the robot light to the robot
		if (hydrobot) {
			hydrobot.add(robotLight);
			hydrobot.add(robotLight.target);
		}

		// Spawn initial debris and victims
		spawnDebris();
		spawnVictims();

		// Create particle systems for underwater effects
		createUnderwaterEffects();
	}

	function createPoolWalls() {
		const wallHeight = waterDepth.value + 4;
		const wallThickness = 3; // Thicker walls
		const wallMaterial = new THREE.MeshPhongMaterial({
			color: 0x666666,
			opacity: 1.0, // Solid walls
		});

		const poolS = poolSize.value;
		wallMeshes = [
			// North wall
			new THREE.Mesh(
				new THREE.BoxGeometry(
					poolS + wallThickness,
					wallHeight,
					wallThickness
				),
				wallMaterial
			),
			// South wall
			new THREE.Mesh(
				new THREE.BoxGeometry(
					poolS + wallThickness,
					wallHeight,
					wallThickness
				),
				wallMaterial
			),
			// East wall
			new THREE.Mesh(
				new THREE.BoxGeometry(
					wallThickness,
					wallHeight,
					poolS + wallThickness
				),
				wallMaterial
			),
			// West wall
			new THREE.Mesh(
				new THREE.BoxGeometry(
					wallThickness,
					wallHeight,
					poolS + wallThickness
				),
				wallMaterial
			),
		];

		// Position walls as solid barriers
		wallMeshes[0].position.set(
			0,
			-wallHeight / 2 + 2,
			-poolS / 2 - wallThickness / 2
		);
		wallMeshes[1].position.set(
			0,
			-wallHeight / 2 + 2,
			poolS / 2 + wallThickness / 2
		);
		wallMeshes[2].position.set(
			poolS / 2 + wallThickness / 2,
			-wallHeight / 2 + 2,
			0
		);
		wallMeshes[3].position.set(
			-poolS / 2 - wallThickness / 2,
			-wallHeight / 2 + 2,
			0
		);

		wallMeshes.forEach((wall) => {
			wall.castShadow = true;
			wall.receiveShadow = true;
			mainScene.add(wall);
		});
	}

	function createHydrobot() {
		// Main body - submersible design with highly visible colors
		const bodyGeometry = new THREE.CapsuleGeometry(1.0, 4, 8, 16);
		const bodyMaterial = new THREE.MeshPhongMaterial({
			color: 0xff2222, // Bright red
			emissive: 0x441111,
			shininess: 100,
		});
		hydrobot = new THREE.Mesh(bodyGeometry, bodyMaterial);
		hydrobot.position.set(0, -1, 0); // Start slightly below surface
		hydrobot.castShadow = true;

		// Thermal sensor array - highly visible
		const sensorGeometry = new THREE.SphereGeometry(0.3);
		const sensorMaterial = new THREE.MeshBasicMaterial({
			color: 0xff8800,
		});
		const thermalSensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
		thermalSensor.position.set(0, 0.8, 2);
		hydrobot.add(thermalSensor);

		// Status beacon - always visible
		const beaconGeometry = new THREE.SphereGeometry(0.2);
		const beaconMaterial = new THREE.MeshBasicMaterial({
			color: 0x00ff00,
		});
		const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
		beacon.position.set(0, 1.5, 0);
		hydrobot.add(beacon);

		// Propellers - visible
		const propellerGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.2);
		const propellerMaterial = new THREE.MeshPhongMaterial({
			color: 0x333333,
		});

		const rearPropeller = new THREE.Mesh(
			propellerGeometry,
			propellerMaterial
		);
		rearPropeller.position.set(0, 0, -2.5);
		rearPropeller.rotation.z = Math.PI / 2;
		hydrobot.add(rearPropeller);

		// Side thrusters for maneuvering
		const sideThruster1 = new THREE.Mesh(
			propellerGeometry,
			propellerMaterial
		);
		sideThruster1.position.set(1.2, 0, 0);
		sideThruster1.rotation.x = Math.PI / 2;
		hydrobot.add(sideThruster1);

		const sideThruster2 = new THREE.Mesh(
			propellerGeometry,
			propellerMaterial
		);
		sideThruster2.position.set(-1.2, 0, 0);
		sideThruster2.rotation.x = Math.PI / 2;
		hydrobot.add(sideThruster2);

		// Ballast tanks (visual) - larger and more visible
		const ballastGeometry = new THREE.CylinderGeometry(0.35, 0.35, 1.5);
		const ballastMaterial = new THREE.MeshPhongMaterial({
			color: 0x888888,
			transparent: true,
			opacity: 0.8,
		});

		const ballast1 = new THREE.Mesh(ballastGeometry, ballastMaterial);
		ballast1.position.set(1, -0.5, 0);
		hydrobot.add(ballast1);

		const ballast2 = new THREE.Mesh(ballastGeometry, ballastMaterial);
		ballast2.position.set(-1, -0.5, 0);
		hydrobot.add(ballast2);

		// Status lights - highly visible
		const statusLight = new THREE.Mesh(
			new THREE.SphereGeometry(0.15),
			new THREE.MeshBasicMaterial({
				color: 0x00ff00,
			})
		);
		statusLight.position.set(0, 1, 0.8);
		hydrobot.add(statusLight);

		mainScene.add(hydrobot);
	}

	function spawnDebris() {
		for (let i = 0; i < numDebris.value; i++) {
			const debris = createDebrisObject();
			debrisMeshes.push(debris);
			mainScene.add(debris);
		}
	}

	function createDebrisObject() {
		const debrisTypes = [
			{ geometry: new THREE.BoxGeometry(2, 0.5, 3), color: 0x8b4513 }, // Wood plank
			{ geometry: new THREE.SphereGeometry(1), color: 0x444444 }, // Barrel
			{
				geometry: new THREE.CylinderGeometry(0.3, 0.3, 4),
				color: 0x666666,
			}, // Pipe
			{ geometry: new THREE.BoxGeometry(3, 1, 2), color: 0x993333 }, // Furniture
		];

		const type =
			debrisTypes[Math.floor(Math.random() * debrisTypes.length)];
		const material = new THREE.MeshPhongMaterial({ color: type.color });
		const debris = new THREE.Mesh(type.geometry, material);

		// Random position in pool
		debris.position.set(
			(Math.random() - 0.5) * (poolSize.value - 4),
			Math.random() * (-waterDepth.value + 2), // Floating at various depths
			(Math.random() - 0.5) * (poolSize.value - 4)
		);

		debris.rotation.set(
			Math.random() * Math.PI,
			Math.random() * Math.PI,
			Math.random() * Math.PI
		);

		return debris;
	}

	function spawnVictims() {
		for (let i = 0; i < numVictims.value; i++) {
			const victim = createVictimObject(i);
			victimMeshes.push(victim);
			mainScene.add(victim);
		}
	}

	function createVictimObject(index) {
		const heatType = heatTypes[index % heatTypes.length];

		// Human-like shape - even larger and more visible
		const bodyGeometry = new THREE.CapsuleGeometry(0.8, 3);
		const bodyMaterial = new THREE.MeshPhongMaterial({
			color: heatType.color,
			emissive: heatType.emissive,
			emissiveIntensity: 0.6, // Higher intensity
		});

		const victim = new THREE.Mesh(bodyGeometry, bodyMaterial);
		victim.castShadow = true;

		// Position victims at various depths and locations within bounds
		const boundary = poolSize.value / 2 - 6; // Keep away from walls
		victim.position.set(
			(Math.random() - 0.5) * boundary * 2,
			-Math.random() * (waterDepth.value - 3) - 1.5, // Keep above bottom
			(Math.random() - 0.5) * boundary * 2
		);

		// Add a highly visible heat signature marker above victims
		const markerGeometry = new THREE.SphereGeometry(0.4);
		const markerMaterial = new THREE.MeshBasicMaterial({
			color: 0xff0000,
			transparent: true,
			opacity: 0.8,
		});
		const heatMarker = new THREE.Mesh(markerGeometry, markerMaterial);
		heatMarker.position.set(0, 2, 0);
		victim.add(heatMarker);

		// Store victim data
		victim.userData = {
			heatType: heatType,
			temperature: heatType.temp,
			detected: false,
			priority: heatType.priority || 5,
		};

		return victim;
	}

	function createUnderwaterEffects() {
		// Bubble system for visual depth effect
		bubbleSystem = new THREE.Group();

		for (let i = 0; i < 30; i++) {
			const bubbleGeometry = new THREE.SphereGeometry(
				0.1 + Math.random() * 0.1
			);
			const bubbleMaterial = new THREE.MeshBasicMaterial({
				color: 0x88ccff,
				transparent: true,
				opacity: 0.6,
			});

			const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
			bubble.position.set(
				(Math.random() - 0.5) * poolSize.value,
				-Math.random() * waterDepth.value,
				(Math.random() - 0.5) * poolSize.value
			);

			bubble.userData = {
				velocity: 0.02 + Math.random() * 0.03,
				drift: (Math.random() - 0.5) * 0.01,
			};

			bubbleSystem.add(bubble);
		}

		mainScene.add(bubbleSystem);
	}

	// Thermal scanning for victim detection
	function performThermalScan() {
		if (heatScanCooldown > 0) {
			heatScanCooldown--;
			return;
		}

		thermalData.heatSources = [];
		let detectionMade = false;

		victimMeshes.forEach((victim) => {
			const distance = hydrobot.position.distanceTo(victim.position);
			const depthDifference = Math.abs(
				hydrobot.position.y - victim.position.y
			);

			// Much more generous thermal detection range
			let effectiveRange = thermalRadius.value * 1.5; // Increased base range

			// Much less impact from turbidity
			effectiveRange *= 1 - waterTurbidity.value * 0.1;

			// Minimal impact from depth difference
			if (depthDifference > 5) effectiveRange *= 0.9;

			if (distance <= effectiveRange) {
				const heatData = {
					position: victim.position.clone(),
					temperature: victim.userData.temperature,
					type: victim.userData.heatType,
					distance: distance,
					confidence: Math.max(0.7, 1 - distance / effectiveRange),
				};

				thermalData.heatSources.push(heatData);

				if (!victim.userData.detected) {
					victim.userData.detected = true;
					detectionMade = true;

					// Add to detected types
					if (
						!detectedHeatTypes.value.some(
							(d) => d.name === victim.userData.heatType.name
						)
					) {
						detectedHeatTypes.value.push(victim.userData.heatType);
					}

					// Update mission status
					if (victim.userData.heatType.priority) {
						victimsFound.value++;
						missionStatus.value = `VICTIM DETECTED: ${victim.userData.heatType.name}`;
					}

					// Make detected victims pulse/glow much brighter
					victim.material.emissiveIntensity = 1.0;

					// Make the heat marker very visible
					if (victim.children.length > 0) {
						victim.children[0].material.emissiveIntensity = 1.2;
					}
				}
			}
		});

		heatDetected.value = thermalData.heatSources.length > 0;
		heatScanCooldown = 10; // Faster scanning

		return detectionMade;
	}

	// Utility functions for pool management
	function increasePoolSize() {
		poolSize.value = Math.min(100, poolSize.value + 10);
		resetSimulation();
	}

	function decreasePoolSize() {
		poolSize.value = Math.max(20, poolSize.value - 10);
		resetSimulation();
	}

	function spawnMoreVictims() {
		// Clear existing victims
		victimMeshes.forEach((victim) => mainScene.remove(victim));
		victimMeshes = [];

		// Spawn new victims
		spawnVictims();
	}

	function spawnMoreDebris() {
		// Clear existing debris
		debrisMeshes.forEach((debris) => mainScene.remove(debris));
		debrisMeshes = [];

		// Spawn new debris
		spawnDebris();
	}

	function resetSimulation() {
		// Reset robot position
		if (hydrobot) {
			hydrobot.position.set(0, -1, 0);
			hydrobot.rotation.set(0, 0, 0);
		}

		// Reset all states
		ballastLevel.value = 0;
		ballastTarget = 0;
		currentDepth.value = 0;
		victimsFound.value = 0;
		areaSearched.value = 0;
		batteryLevel.value = 100;
		detectedHeatTypes.value = [];
		heatDetected.value = false;
		missionStatus.value = "MANUAL CONTROL";

		// Respawn everything
		spawnMoreVictims();
		spawnMoreDebris();
		generateMissionPlan();
	}

	function resetPatternStates() {
		// Reset navigation states
		missionData.currentWaypoint = 0;
		currentGridIndex = 0;
		spiralState = null;
		currentLayer = 0;
		searchLayerIndex = 0;
	}

	// Sonar scanning for navigation and debris detection
	function performSonarScan() {
		sonarData.obstacles = [];
		sonarData.debris = [];
		sonarData.clearPaths = [];

		const numRays = sonarNumRays.value;
		const maxRange = sonarRadius.value;

		for (let i = 0; i < numRays; i++) {
			const angle = (i / numRays) * Math.PI * 2;
			const rayDirection = new THREE.Vector3(
				Math.cos(angle),
				0,
				Math.sin(angle)
			);

			const raycaster = new THREE.Raycaster(
				hydrobot.position,
				rayDirection,
				0,
				maxRange
			);

			// Check for collisions with debris
			const debrisIntersects = raycaster.intersectObjects(debrisMeshes);
			if (debrisIntersects.length > 0) {
				sonarData.debris.push({
					angle: angle,
					distance: debrisIntersects[0].distance,
					position: debrisIntersects[0].point,
					object: debrisIntersects[0].object,
				});
			} else {
				sonarData.clearPaths.push({
					angle: angle,
					distance: maxRange,
				});
			}
		}
	}

	// Navigation and movement
	function updateMovement() {
		if (currentMode.value === "manual") {
			updateManualControl();
		} else {
			updateAutomaticNavigation();
		}

		// Update ballast and depth
		updateBallastSystem();

		// Apply water current
		hydrobot.position.x += currentFlow.x;
		hydrobot.position.z += currentFlow.z;

		// Update battery (decreases over time)
		batteryLevel.value = Math.max(0, batteryLevel.value - 0.01);

		// Update various timers
		if (heatScanCooldown > 0) heatScanCooldown--;
		if (ballastTimer > 0) ballastTimer--;
	}

	function updateManualControl() {
		const speed = robotSpeed.value; // Double speed for manual control
		const rotationSpeed = 0.05; // Faster rotation
		const boundary = poolSize.value / 2 - 3; // Keep robot 3 units from wall

		// Store current position for boundary checking
		let newX = hydrobot.position.x;
		let newZ = hydrobot.position.z;

		if (manualControl.value.forward) {
			newZ += Math.cos(hydrobot.rotation.y) * speed;
			newX += Math.sin(hydrobot.rotation.y) * speed;
		}
		if (manualControl.value.backward) {
			newZ -= Math.cos(hydrobot.rotation.y) * speed;
			newX -= Math.sin(hydrobot.rotation.y) * speed;
		}

		// Apply boundary checks - hard boundaries that prevent escape
		if (Math.abs(newX) < boundary && Math.abs(newZ) < boundary) {
			hydrobot.position.x = newX;
			hydrobot.position.z = newZ;
		} else {
			// Bounce back slightly from walls
			if (Math.abs(newX) >= boundary) {
				hydrobot.position.x =
					Math.sign(hydrobot.position.x) * (boundary - 0.5);
			}
			if (Math.abs(newZ) >= boundary) {
				hydrobot.position.z =
					Math.sign(hydrobot.position.z) * (boundary - 0.5);
			}
		}

		if (manualControl.value.left) {
			hydrobot.rotation.y += rotationSpeed;
		}
		if (manualControl.value.right) {
			hydrobot.rotation.y -= rotationSpeed;
		}
		if (manualControl.value.dive && ballastLevel.value < 1) {
			ballastTarget = Math.min(1, ballastTarget + 0.05); // Faster diving
		}
		if (manualControl.value.surface && ballastLevel.value > 0) {
			ballastTarget = Math.max(0, ballastTarget - 0.05); // Faster surfacing
		}

		// Ensure robot stays within depth bounds - hard limits
		const minDepth = -maxDiveDepth.value + 0.5;
		const maxDepth = 0.5; // Allow slight surface breach
		hydrobot.position.y = Math.max(
			minDepth,
			Math.min(maxDepth, hydrobot.position.y)
		);

		// Update current depth display
		currentDepth.value = Math.abs(Math.min(0, hydrobot.position.y));
	}

	function updateAutomaticNavigation() {
		// Perform scans
		performThermalScan();
		performSonarScan();

		// Check for priority targets (survivors) - improved targeting
		const priorityTarget = thermalData.heatSources.find(
			(h) => h.type.priority === 1 || h.type.priority === 2
		);

		// Check for any detected targets if no priority targets
		const anyTarget = priorityTarget || thermalData.heatSources[0];

		if (anyTarget && !emergencyAscent) {
			// Navigate directly to the target
			navigateToTarget(anyTarget.position);
			missionStatus.value = `APPROACHING: ${
				anyTarget.type.name
			} (${anyTarget.distance.toFixed(1)}m)`;

			// If we're close enough, the collection system will handle it
			if (anyTarget.distance < 3) {
				missionStatus.value = `COLLECTING: ${anyTarget.type.name}`;
			}
		} else {
			// Follow search pattern only when no targets detected
			updateSearchPattern();
		}

		// Debris avoidance - but don't override target navigation
		if (sonarData.debris.length > 0 && !anyTarget) {
			avoidDebris();
		}

		// Emergency ascent if battery low
		if (batteryLevel.value < 20 && !emergencyAscent) {
			emergencySurface();
		}
	}

	function updateSearchPattern() {
		if (currentPattern.value === "surface-sweep") {
			updateSurfaceSweep();
		} else if (currentPattern.value === "spiral-dive") {
			updateSpiralDive();
		} else if (currentPattern.value === "depth-layers") {
			updateDepthLayers();
		} else if (currentPattern.value === "debris-navigation") {
			updateDebrisNavigation();
		} else if (currentPattern.value === "thermal-tracking") {
			updateThermalTracking();
		}
	}

	function updateSurfaceSweep() {
		// Stay near surface and sweep in grid pattern
		ballastTarget = 0.2; // Slightly submerged

		if (missionData.waypoints.length > 0) {
			const waypoint = missionData.waypoints[missionData.currentWaypoint];
			navigateToWaypoint(waypoint);

			if (reachedWaypoint(waypoint)) {
				missionData.currentWaypoint =
					(missionData.currentWaypoint + 1) %
					missionData.waypoints.length;
				areaSearched.value = Math.min(
					100,
					(missionData.currentWaypoint /
						missionData.waypoints.length) *
						100
				);
			}
		}
	}

	function updateSpiralDive() {
		if (missionData.waypoints.length > 0) {
			const waypoint = missionData.waypoints[missionData.currentWaypoint];
			navigateToWaypoint(waypoint);
			ballastTarget = Math.abs(waypoint.depth) / maxDiveDepth.value;

			if (reachedWaypoint(waypoint)) {
				missionData.currentWaypoint =
					(missionData.currentWaypoint + 1) %
					missionData.waypoints.length;
			}
		}
	}

	function updateDepthLayers() {
		if (missionData.waypoints.length > 0) {
			const waypoint = missionData.waypoints[missionData.currentWaypoint];
			navigateToWaypoint(waypoint);
			ballastTarget = Math.abs(waypoint.depth) / maxDiveDepth.value;

			if (reachedWaypoint(waypoint)) {
				missionData.currentWaypoint =
					(missionData.currentWaypoint + 1) %
					missionData.waypoints.length;

				// Update mission status based on layer
				if (waypoint.layer !== undefined) {
					missionStatus.value = `SEARCHING LAYER ${
						waypoint.layer + 1
					}/4`;
				}
			}
		}
	}

	function updateDebrisNavigation() {
		// Similar to other patterns but with more debris avoidance
		if (missionData.waypoints.length > 0) {
			const waypoint = missionData.waypoints[missionData.currentWaypoint];
			navigateToWaypoint(waypoint);
			ballastTarget = Math.abs(waypoint.depth) / maxDiveDepth.value;

			if (reachedWaypoint(waypoint)) {
				missionData.currentWaypoint =
					(missionData.currentWaypoint + 1) %
					missionData.waypoints.length;
			}
		}
	}

	function updateThermalTracking() {
		if (thermalData.heatSources.length > 0) {
			// Track the closest heat source aggressively
			const closest = thermalData.heatSources.reduce((prev, curr) =>
				prev.distance < curr.distance ? prev : curr
			);

			// Go directly to the closest target
			navigateToTarget(closest.position);
			missionStatus.value = `THERMAL TRACKING: ${
				closest.type.name
			} (${closest.distance.toFixed(1)}m)`;

			// Adjust depth to match target
			const depthDiff = closest.position.y - hydrobot.position.y;
			if (Math.abs(depthDiff) > 1) {
				ballastTarget = Math.max(
					0,
					Math.min(1, ballastTarget + (depthDiff > 0 ? -0.02 : 0.02))
				);
			}
		} else {
			// No heat sources, continue with systematic search
			updateSurfaceSweep();
		}
	}

	function navigateToTarget(targetPos) {
		const direction = new THREE.Vector3()
			.subVectors(targetPos, hydrobot.position)
			.normalize();

		// Use faster speed when targeting something specific
		const speed = robotSpeed.value * 1.5;

		// Apply boundary checking for target navigation too
		const boundary = poolSize.value / 2 - 3;
		const newPos = hydrobot.position
			.clone()
			.add(direction.multiplyScalar(speed));

		// Only move if within boundaries
		if (Math.abs(newPos.x) < boundary && Math.abs(newPos.z) < boundary) {
			hydrobot.position.copy(newPos);
		} else {
			// Move parallel to boundary if target is outside
			const parallelDir = new THREE.Vector3(-direction.z, 0, direction.x);
			hydrobot.position.add(parallelDir.multiplyScalar(speed * 0.5));
		}

		// Rotate to face target more aggressively
		const targetAngle = Math.atan2(direction.x, direction.z);
		const angleDiff = targetAngle - hydrobot.rotation.y;

		// Normalize angle difference to [-π, π]
		let normalizedAngleDiff =
			((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;

		// Faster rotation when targeting
		hydrobot.rotation.y += normalizedAngleDiff * 0.2;
	}

	function navigateToWaypoint(waypoint) {
		const targetPos = new THREE.Vector3(waypoint.x, waypoint.y, waypoint.z);
		navigateToTarget(targetPos);
	}

	function reachedWaypoint(waypoint) {
		const distance = hydrobot.position.distanceTo(
			new THREE.Vector3(waypoint.x, waypoint.y, waypoint.z)
		);
		return distance < 2;
	}

	function avoidDebris() {
		// Find the clearest path
		if (sonarData.clearPaths.length > 0) {
			const bestPath = sonarData.clearPaths.reduce((prev, curr) =>
				prev.distance > curr.distance ? prev : curr
			);

			const avoidDirection = new THREE.Vector3(
				Math.sin(bestPath.angle),
				0,
				Math.cos(bestPath.angle)
			);

			hydrobot.position.add(
				avoidDirection.multiplyScalar(robotSpeed.value * 0.5)
			);
			hydrobot.rotation.y = bestPath.angle;
		}
	}

	function updateBallastSystem() {
		// Much faster ballast adjustment for manual control
		ballastLevel.value += (ballastTarget - ballastLevel.value) * 0.15;

		// Calculate target depth based on ballast
		const newTargetDepth = -ballastLevel.value * maxDiveDepth.value;

		// Much faster depth change
		const depthDiff = newTargetDepth - hydrobot.position.y;
		hydrobot.position.y += depthDiff * 0.2;

		currentDepth.value = Math.abs(Math.min(0, hydrobot.position.y));

		// Update diving mode status
		divingMode = ballastLevel.value > 0.3;
		surfaceMode = ballastLevel.value < 0.1;
	}

	// Utility functions
	function increasePoolSize() {
		poolSize.value += 10;
		resetSimulation();
	}

	function decreasePoolSize() {
		if (poolSize.value > 30) {
			poolSize.value -= 10;
			resetSimulation();
		}
	}

	function spawnMoreVictims() {
		victimMeshes.forEach((v) => mainScene.remove(v));
		victimMeshes.length = 0;
		spawnVictims();
	}

	function spawnMoreDebris() {
		debrisMeshes.forEach((d) => mainScene.remove(d));
		debrisMeshes.length = 0;
		spawnDebris();
	}

	// Target collection system
	function checkTargetCollection() {
		if (!hydrobot) return; // Prevent error if hydrobot is not yet created

		const collectionDistance = 2.0; // Distance needed to collect targets
		const robotPos = hydrobot.position;

		// Check victim collection
		for (let i = victimMeshes.length - 1; i >= 0; i--) {
			const victim = victimMeshes[i];
			const distance = robotPos.distanceTo(victim.position);

			if (distance < collectionDistance) {
				// Collect the victim
				collectTarget(victim, "victim", i);
			}
		}

		// Check debris collection
		for (let i = debrisMeshes.length - 1; i >= 0; i--) {
			const debris = debrisMeshes[i];
			const distance = robotPos.distanceTo(debris.position);

			if (distance < collectionDistance) {
				// Collect the debris
				collectTarget(debris, "debris", i);
			}
		}
	}

	function collectTarget(target, type, index) {
		// Add collection effect - flash and fade out
		const originalMaterial = target.material;

		// Flash effect
		target.material = new THREE.MeshBasicMaterial({
			color: 0x00ff00,
			transparent: true,
			opacity: 0.8,
		});

		// Animate collection
		const startTime = Date.now();
		const animateCollection = () => {
			const elapsed = Date.now() - startTime;
			const progress = elapsed / 500; // 500ms animation

			if (progress < 1) {
				// Scale down and fade out
				const scale = 1 - progress;
				const opacity = 1 - progress;

				target.scale.setScalar(scale);
				target.material.opacity = opacity;

				requestAnimationFrame(animateCollection);
			} else {
				// Remove from scene and arrays
				mainScene.remove(target);

				if (type === "victim") {
					victimMeshes.splice(index, 1);
					victimsFound.value++;

					// Add to detected heat types for UI
					const heatType = heatTypes.find(
						(h) =>
							h.name.includes("Survivor") ||
							h.name.includes("Victim")
					);
					if (
						heatType &&
						!detectedHeatTypes.value.find(
							(d) => d.name === heatType.name
						)
					) {
						detectedHeatTypes.value.push({ ...heatType });
					}

					missionStatus.value = `VICTIM RESCUED! Total: ${victimsFound.value}`;
				} else if (type === "debris") {
					debrisMeshes.splice(index, 1);
					missionStatus.value = "DEBRIS CLEARED";
				}

				// Reset mission status after 2 seconds
				setTimeout(() => {
					if (currentMode.value === "manual") {
						missionStatus.value = "MANUAL CONTROL";
					} else {
						missionStatus.value = "SEARCH AND RESCUE";
					}
				}, 2000);
			}
		};

		animateCollection();
	}

	// Animation loop
	function animate() {
		if (!mainScene || !hydrobot) return; // Also check for hydrobot

		updateMovement();
		checkTargetCollection();

		// Update bubble effects
		if (bubbleSystem) {
			bubbleSystem.children.forEach((bubble) => {
				bubble.position.y += bubble.userData.velocity;
				bubble.position.x += bubble.userData.drift;

				// Reset bubbles that reach surface
				if (bubble.position.y > 0) {
					bubble.position.y = -waterDepth.value;
					bubble.position.x = (Math.random() - 0.5) * poolSize.value;
					bubble.position.z = (Math.random() - 0.5) * poolSize.value;
				}
			});
		}

		// Update area searched
		if (missionData.waypoints.length > 0) {
			areaSearched.value = Math.min(
				100,
				(missionData.currentWaypoint / missionData.waypoints.length) *
					100
			);
		}

		// Render cameras based on mode
		renderCameras();

		animationId = requestAnimationFrame(animate);
	}

	function renderCameras() {
		if (!mainCamera || !mainRenderer || !hydrobot) return;

		// Update camera position based on mode with better following for manual control
		if (cameraMode.value === "first-person") {
			// First person view - camera is at robot's position looking forward
			mainCamera.position.copy(hydrobot.position);
			mainCamera.position.y += 0.5; // Slightly above robot center

			const lookTarget = new THREE.Vector3(
				hydrobot.position.x + Math.sin(hydrobot.rotation.y) * 10,
				hydrobot.position.y,
				hydrobot.position.z + Math.cos(hydrobot.rotation.y) * 10
			);
			mainCamera.lookAt(lookTarget);
		} else if (cameraMode.value === "third-person") {
			// Third person view - camera follows behind robot
			const distance = 6;
			const height = 3;
			const targetX =
				hydrobot.position.x - Math.sin(hydrobot.rotation.y) * distance;
			const targetZ =
				hydrobot.position.z - Math.cos(hydrobot.rotation.y) * distance;
			const targetY = hydrobot.position.y + height;

			// Smooth camera movement
			mainCamera.position.lerp(
				new THREE.Vector3(targetX, targetY, targetZ),
				0.1
			);
			mainCamera.lookAt(hydrobot.position);
		} else if (cameraMode.value === "underwater") {
			// Close follow camera - follows behind robot smoothly
			const distance = 4;
			const height = 2;
			const targetX =
				hydrobot.position.x - Math.sin(hydrobot.rotation.y) * distance;
			const targetZ =
				hydrobot.position.z - Math.cos(hydrobot.rotation.y) * distance;
			const targetY = hydrobot.position.y + height;

			// Smooth camera movement
			mainCamera.position.lerp(
				new THREE.Vector3(targetX, targetY, targetZ),
				0.1
			);
			mainCamera.lookAt(hydrobot.position);
		} else if (cameraMode.value === "thermal") {
			// First person view from robot's thermal sensor
			const offset = new THREE.Vector3(0, 0.8, 1.5);
			offset.applyQuaternion(hydrobot.quaternion);
			mainCamera.position.copy(hydrobot.position).add(offset);

			const lookTarget = new THREE.Vector3(
				hydrobot.position.x + Math.sin(hydrobot.rotation.y) * 15,
				hydrobot.position.y,
				hydrobot.position.z + Math.cos(hydrobot.rotation.y) * 15
			);
			mainCamera.lookAt(lookTarget);
		} else if (cameraMode.value === "overview") {
			// High overhead view that follows the robot in all modes
			const followX = hydrobot.position.x;
			const followZ = hydrobot.position.z + 5; // Slightly behind
			const followY = currentMode.value === "manual" ? 12 : 15; // Higher for auto mode

			mainCamera.position.lerp(
				new THREE.Vector3(followX, followY, followZ),
				0.08
			);
			mainCamera.lookAt(
				new THREE.Vector3(
					hydrobot.position.x,
					hydrobot.position.y,
					hydrobot.position.z
				)
			);
		} else if (cameraMode.value === "sonar") {
			// Side view that follows robot
			const sideDistance = 8;
			const targetX = hydrobot.position.x + sideDistance;
			const targetZ = hydrobot.position.z;
			const targetY = hydrobot.position.y + 3;

			mainCamera.position.lerp(
				new THREE.Vector3(targetX, targetY, targetZ),
				0.1
			);
			mainCamera.lookAt(hydrobot.position);
		}

		// Render main scene
		mainRenderer.render(mainScene, mainCamera);

		// Render minimap if available
		if (miniRenderer && miniCamera) {
			miniCamera.position.set(0, 20, 0);
			miniCamera.lookAt(0, 0, 0);
			miniRenderer.render(mainScene, miniCamera);
		}
	}

	// Initialize Three.js and scene
	function initializeThreeJS() {
		if (!mainCanvas.value || !miniMapCanvas.value || !miniMapFog.value) {
			console.warn("Canvas elements not ready yet");
			return false;
		}

		try {
			// Get canvas dimensions dynamically
			const canvasRect = mainCanvas.value.getBoundingClientRect();
			const canvasWidth = canvasRect.width || 800;
			const canvasHeight = canvasRect.height || 600;

			mainRenderer = new THREE.WebGLRenderer({
				canvas: mainCanvas.value,
				antialias: true,
				alpha: false,
			});
			mainRenderer.setSize(canvasWidth, canvasHeight);
			mainRenderer.shadowMap.enabled = true;
			mainRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
			mainRenderer.setClearColor(0x001122, 1); // Dark blue underwater color

			mainCamera = new THREE.PerspectiveCamera(
				75,
				canvasWidth / canvasHeight,
				0.1,
				200
			);

			miniRenderer = new THREE.WebGLRenderer({
				canvas: miniMapCanvas.value,
				antialias: true,
			});
			miniRenderer.setSize(200, 200);
			miniRenderer.setClearColor(0x004466, 1);

			miniCamera = new THREE.OrthographicCamera(-30, 30, 30, -30, 1, 100);

			fogCtx = miniMapFog.value.getContext("2d");

			setupWaterEnvironment();
			generateMissionPlan();
			animate();

			console.log("Three.js initialized successfully");
			return true;
		} catch (error) {
			console.error("Failed to initialize Three.js:", error);
			return false;
		}
	}

	// Initialize on mount - delayed to ensure canvas elements are ready
	onMounted(() => {
		// Wait for next tick to ensure DOM elements are rendered
		setTimeout(() => {
			if (!initializeThreeJS()) {
				// Retry after another delay if first attempt fails
				setTimeout(() => {
					initializeThreeJS();
				}, 500);
			}
		}, 100);
	});

	// Return reactive properties and methods
	return {
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

		// Robot position access
		getRobotPosition: () => hydrobot?.position || { x: 0, y: 0, z: 0 },

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
	};
}

// Target collection system
function checkTargetCollection() {
	if (!hydrobot) return; // Prevent error if hydrobot is not yet created

	const collectionDistance = 2.0; // Distance needed to collect targets
	const robotPos = hydrobot.position;

	// Check victim collection
	for (let i = victimMeshes.length - 1; i >= 0; i--) {
		const victim = victimMeshes[i];
		const distance = robotPos.distanceTo(victim.position);

		if (distance < collectionDistance) {
			// Collect the victim
			collectTarget(victim, "victim", i);
		}
	}

	// Check debris collection
	for (let i = debrisMeshes.length - 1; i >= 0; i--) {
		const debris = debrisMeshes[i];
		const distance = robotPos.distanceTo(debris.position);

		if (distance < collectionDistance) {
			// Collect the debris
			collectTarget(debris, "debris", i);
		}
	}
}

function collectTarget(target, type, index) {
	// Add collection effect - flash and fade out
	const originalMaterial = target.material;

	// Flash effect
	target.material = new THREE.MeshBasicMaterial({
		color: 0x00ff00,
		transparent: true,
		opacity: 0.8,
	});

	// Animate collection
	const startTime = Date.now();
	const animateCollection = () => {
		const elapsed = Date.now() - startTime;
		const progress = elapsed / 500; // 500ms animation

		if (progress < 1) {
			// Scale down and fade out
			const scale = 1 - progress;
			const opacity = 1 - progress;

			target.scale.setScalar(scale);
			target.material.opacity = opacity;

			requestAnimationFrame(animateCollection);
		} else {
			// Remove from scene and arrays
			mainScene.remove(target);

			if (type === "victim") {
				victimMeshes.splice(index, 1);
				victimsFound.value++;

				// Add to detected heat types for UI
				const heatType = heatTypes.find(
					(h) =>
						h.name.includes("Survivor") || h.name.includes("Victim")
				);
				if (
					heatType &&
					!detectedHeatTypes.value.find(
						(d) => d.name === heatType.name
					)
				) {
					detectedHeatTypes.value.push({ ...heatType });
				}

				missionStatus.value = `VICTIM RESCUED! Total: ${victimsFound.value}`;
			} else if (type === "debris") {
				debrisMeshes.splice(index, 1);
				missionStatus.value = "DEBRIS CLEARED";
			}

			// Reset mission status after 2 seconds
			setTimeout(() => {
				if (currentMode.value === "manual") {
					missionStatus.value = "MANUAL CONTROL";
				} else {
					missionStatus.value = "SEARCH AND RESCUE";
				}
			}, 2000);
		}
	};

	animateCollection();
}

// Fix pool bottom material (remove roughness from MeshPhongMaterial)
// In setupWaterEnvironment or wherever pool bottom is created:
// const bottomMaterial = new THREE.MeshPhongMaterial({
//     color: 0x664433,
//     // roughness: 0.8, // REMOVE THIS LINE
// });

// Fix marker material (remove emissive from MeshBasicMaterial)
// const markerMaterial = new THREE.MeshBasicMaterial({
//     color: 0xff0000,
//     // emissive: 0xff0000, // REMOVE THIS LINE
//     transparent: true,
//     opacity: 0.8,
// });
