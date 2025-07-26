import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

/**
 * HYDROBOT AUV Simulation Engine
 *
 * Core simulation system for autonomous underwater vehicle operations.
 * Manages 3D environment rendering, physics simulation, sensor systems,
 * collision detection, and search-and-rescue mission execution.
 *
 * Features:
 * - Real-time 3D underwater environment with physics
 * - Dual-mode camera system (optical/sonar) with seamless switching
 * - Advanced collision detection and damage assessment
 * - Environmental event simulation (currents, interference, malfunctions)
 * - Search and rescue target detection and collection
 * - Professional-grade navigation and control systems
 */
export class AUVLogic {
	/**
	 * Initialize the AUV simulation system
	 * @param {HTMLCanvasElement} canvas - Primary rendering canvas element
	 */
	constructor(canvas) {
		this.canvas = canvas;
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.auv = null;

		// Vehicle dynamics and control
		this.velocity = new THREE.Vector3();
		this.speed = 0.1;
		this.rotationSpeed = 0.02;

		// Navigation and telemetry systems
		this.currentHeading = 0; // Magnetic compass bearing (0-360 degrees)
		this.currentSpeed = 0; // Forward velocity in knots
		this.lastPosition = new THREE.Vector3(0, 0, 0);
		this.lastUpdateTime = Date.now();
		this.speedSamples = []; // Speed averaging buffer for smooth readings
		this.maxSpeedSamples = 10;
		this.compassErrorOffset = 0; // Magnetic interference compensation

		// Camera control systems
		this.isFreeCam = false;
		this.cameraSpeed = 0.2;
		this.mouseSensitivity = 0.002;
		this.isPointerLocked = false;

		// Sensor mode management ('optical', 'sonar')
		this.cameraMode = "optical";
		this.sonarRenderer = null;

		// Advanced sonar detection system
		this.sonarSystem = {
			detectedObjects: [],
			scanRadius: 50,
			fadeTime: 8000, // Object persistence duration (milliseconds)
			canvas: null,
			ctx: null,
			isActive: false,
			maxPulseRange: 50, // Maintained for compatibility
			pulses: [], // Maintained for compatibility

			// Sonar visualization parameters
			backgroundColor: 0x000811,
			returnColor: "#88ff00",
			oldReturnColor: "#446622",
		};

		// Operator input state management
		this.keys = {
			forward: false,
			backward: false,
			left: false,
			right: false,
			up: false,
			down: false,
			turnLeft: false,
			turnRight: false,
		};

		// First-person camera positioning relative to AUV
		this.cameraOffset = new THREE.Vector3(0, -2, 0.5); // Optimized for vehicle scale

		// Operational environment constraints
		this.constraints = {
			minY: -15, // Maximum operational depth
			maxY: 5, // Surface limit
			boundary: 100, // Horizontal operational area
		};

		// Collision detection and safety systems
		this.collisionObjects = []; // Environment obstacles for collision checking
		this.auvBoundingBox = new THREE.Box3(); // Vehicle collision boundary
		this.raycaster = new THREE.Raycaster(); // Ray-based collision detection

		// Vehicle integrity monitoring
		this.collisionData = {
			active: false,
			damageStatus: {
				front: false,
				left: false,
				right: false,
				back: false,
			},
			newCollision: null,
			lastCollisionTime: 0,
		};

		// Search and rescue mission systems
		this.foundSurvivors = []; // Located survivors awaiting rescue
		this.rescueMessages = []; // Operator notification queue

		// Environmental event simulation system
		this.randomEvents = {
			active: null,
			lastEventTime: 0,
			eventCooldown: 15000, // Minimum time between events (15 seconds)
			eventTypes: [
				"highCurrent",
				"lowVisibility",
				"thermalLayer",
				"magneticInterference",
				"equipment_malfunction",
				"marine_life_interference",
				"underwater_storm",
			],
			effects: {
				highCurrent: {
					name: "High Current",
					duration: Math.random() * 30000 + 30000, // 30-60 second duration
					force: new THREE.Vector3(),
					description:
						"Strong underwater currents affecting movement",
				},
				lowVisibility: {
					name: "Low Visibility",
					duration: Math.random() * 30000 + 30000, // 30-60 second duration
					fogDensity: 0.8,
					description: "Reduced visibility due to sediment or algae",
				},
				thermalLayer: {
					name: "Thermal Layer",
					duration: Math.random() * 30000 + 30000, // 30-60 second duration
					sonarInterference: 0.6,
					description:
						"Temperature differences affecting sonar accuracy",
				},
				magneticInterference: {
					name: "Magnetic Interference",
					duration: Math.random() * 30000 + 30000, // 30-60 second duration
					compassError: 15,
					description:
						"Magnetic anomaly affecting navigation systems",
				},
				equipment_malfunction: {
					name: "Equipment Malfunction",
					duration: Math.random() * 30000 + 30000, // 30-60 seconds
					systemAffected: null,
					description: "Temporary system malfunction",
				},
				marine_life_interference: {
					name: "Marine Life Interference",
					duration: Math.random() * 30000 + 30000, // 30-60 seconds
					sonarNoise: 0.7,
					description:
						"Large marine animals interfering with sensors",
				},
				underwater_storm: {
					name: "Underwater Storm",
					duration: Math.random() * 30000 + 30000, // 30-60 seconds
					turbulence: 2.0,
					description: "Underwater disturbance causing turbulence",
				},
			},
		};

		this.init();
		this.setupEventListeners();
		this.animate();
	}

	/**
	 * Initialize the complete 3D simulation environment
	 * Sets up rendering pipeline, lighting, environment, and vehicle systems
	 */
	init() {
		// Initialize the Three.js scene container
		this.scene = new THREE.Scene();

		// Configure underwater atmosphere with realistic fog and color
		this.scene.fog = new THREE.Fog(0x001144, 1, 50);
		this.scene.background = new THREE.Color(0x000811);

		// Determine rendering canvas dimensions
		const rect = this.canvas.getBoundingClientRect();
		const width = rect.width || window.innerWidth;
		const height = rect.height || window.innerHeight;

		console.log("Canvas dimensions:", width, "x", height);

		// Configure first-person perspective camera
		this.camera = new THREE.PerspectiveCamera(
			75,
			width / height,
			0.1,
			1000
		);
		this.camera.position.set(0, 0, 0);

		// Initialize WebGL renderer with high-quality settings
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
		});
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		// Ensure canvas occupies full available space
		this.canvas.style.width = "100%";
		this.canvas.style.height = "100%";
		this.canvas.style.display = "block";

		console.log("Renderer created");

		// Initialize advanced sonar visualization system
		this.initializeSonarSystem();

		// Configure underwater lighting environment
		this.setupLighting();
		console.log("Lighting setup complete");

		// Generate the flooded urban environment
		this.createUnderwaterEnvironment();
		console.log("Environment created");

		// Preserve original material properties for camera mode switching
		this.storeOriginalMaterials();

		// Load the detailed AUV 3D model
		this.loadAUVModel();
		console.log("AUV model loading started");

		// Register viewport resize handler
		window.addEventListener("resize", () => this.onWindowResize());

		// Execute initial rendering pass
		this.renderer.render(this.scene, this.camera);
		console.log("Initial render complete");
	}

	/**
	 * Configure underwater lighting environment
	 * Establishes realistic underwater illumination with surface light filtering
	 * and vehicle-mounted illumination systems
	 */
	setupLighting() {
		// Ambient underwater illumination (filtered sunlight)
		const ambientLight = new THREE.AmbientLight(0x4488bb, 0.4);
		this.scene.add(ambientLight);

		// Primary directional light (simulates filtered surface sunlight)
		const directionalLight = new THREE.DirectionalLight(0x88ccff, 0.6);
		directionalLight.position.set(0, 10, 0);
		directionalLight.castShadow = true;
		directionalLight.shadow.mapSize.width = 2048;
		directionalLight.shadow.mapSize.height = 2048;
		directionalLight.shadow.camera.near = 0.1;
		directionalLight.shadow.camera.far = 50;
		directionalLight.shadow.camera.left = -20;
		directionalLight.shadow.camera.right = 20;
		directionalLight.shadow.camera.top = 20;
		directionalLight.shadow.camera.bottom = -20;
		this.scene.add(directionalLight);

		// Initialize vehicle-mounted lighting systems
		this.createAUVLights();
	}

	/**
	 * Create vehicle-mounted illumination systems
	 * Provides forward-facing spotlights for enhanced visibility and object illumination
	 */
	createAUVLights() {
		// Port side headlight
		this.leftHeadlight = new THREE.SpotLight(
			0xffffff,
			1,
			30,
			Math.PI / 4,
			0.1
		);
		// Starboard side headlight
		this.rightHeadlight = new THREE.SpotLight(
			0xffffff,
			1,
			30,
			Math.PI / 4,
			0.1
		);

		this.leftHeadlight.castShadow = true;
		this.rightHeadlight.castShadow = true;

		this.scene.add(this.leftHeadlight);
		this.scene.add(this.rightHeadlight);
		this.scene.add(this.leftHeadlight.target);
		this.scene.add(this.rightHeadlight.target);
	}

	/**
	 * Generate the complete underwater disaster environment
	 * Creates a flooded urban area with buildings, vehicles, debris, and search targets
	 */
	createUnderwaterEnvironment() {
		// Generate ocean floor surface with sonar-optimized materials
		const floorGeometry = new THREE.PlaneGeometry(200, 200);
		const floorMaterial = new THREE.MeshLambertMaterial({
			color: 0x001122, // Sonar-visible dark blue
			transparent: true,
			opacity: 0.9,
		});
		const floor = new THREE.Mesh(floorGeometry, floorMaterial);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -10;
		floor.receiveShadow = true;
		this.scene.add(floor);

		// Generate flooded urban infrastructure
		this.createFloodedCity();

		// Add search and rescue targets (people/survivors)
		this.createSearchTargets();

		// Create floating debris and particles
		this.createFloodDebris();
		this.createFloatingParticles();

		// Hitbox visibility state
		this.hitboxVisible = false;
		this.showHitboxes();
	}

	storeOriginalMaterials() {
		// Store original material colors before any camera mode effects
		this.scene.traverse((object) => {
			if (object.isMesh && object.material && object.material.color) {
				// Only store if not already stored
				if (!object.userData.originalMaterial) {
					object.userData.originalMaterial = {
						color: object.material.color.clone(),
						emissive: object.material.emissive
							? object.material.emissive.clone()
							: null,
						opacity: object.material.opacity || 1,
					};
				}
			}
		});
	}

	showHitboxes() {
		if (!this.hitboxHelpers) this.hitboxHelpers = [];
		// Always remove previous helpers
		this.hitboxHelpers.forEach((h) => this.scene.remove(h));
		this.hitboxHelpers = [];

		if (!this.hitboxVisible) return;

		// AUV hitbox
		if (this.auv) {
			// Compute the bounding box of the AUV model
			const auvBox = new THREE.Box3().setFromObject(this.auv);
			const auvHelper = new THREE.Box3Helper(auvBox, 0xff00ff);
			this.scene.add(auvHelper);
			this.hitboxHelpers.push(auvHelper);
		}

		// Collision objects
		this.collisionObjects.forEach((obj) => {
			const box = new THREE.Box3().setFromObject(obj);
			const helper = new THREE.Box3Helper(box, 0x00ff00);
			this.scene.add(helper);
			this.hitboxHelpers.push(helper);
		});
	}

	toggleHitboxes() {
		this.hitboxVisible = !this.hitboxVisible;
		this.showHitboxes();
	}

	updateHitboxes() {
		if (!this.hitboxVisible || !this.hitboxHelpers || !this.auv) return;

		// Update AUV hitbox position (first helper in the array is always the AUV)
		if (this.hitboxHelpers.length > 0) {
			const auvHelper = this.hitboxHelpers[0];
			if (auvHelper) {
				// Update the AUV bounding box position
				const auvBox = new THREE.Box3().setFromObject(this.auv);
				auvHelper.box.copy(auvBox);
			}
		}
	}

	createFloodedCity() {
		// Create partially submerged buildings
		this.createSubmergedBuildings();

		// Add cars and vehicles underwater
		this.createSubmergedVehicles();

		// Create street infrastructure (lamp posts, traffic lights, etc.)
		this.createStreetInfrastructure();

		// Add natural debris (trees, branches)
		this.createNaturalDebris();
	}

	createSubmergedBuildings() {
		// Create several buildings of different sizes with sonar colors
		const buildingConfigs = [
			{ x: 20, z: 15, width: 8, height: 12, depth: 6, color: 0xffcc00 },
			{ x: -15, z: 25, width: 6, height: 15, depth: 8, color: 0xff8800 },
			{ x: 35, z: -20, width: 10, height: 10, depth: 7, color: 0xffcc00 },
			{ x: -30, z: -10, width: 5, height: 8, depth: 5, color: 0xff4400 },
			{ x: 0, z: 40, width: 12, height: 18, depth: 10, color: 0xff8800 },
			{ x: -40, z: 15, width: 7, height: 11, depth: 6, color: 0xffcc00 },
			{ x: 25, z: 35, width: 9, height: 14, depth: 8, color: 0xff4400 },
		];

		buildingConfigs.forEach((config, index) => {
			// Main building structure
			const buildingGeometry = new THREE.BoxGeometry(
				config.width,
				config.height,
				config.depth
			);
			const buildingMaterial = new THREE.MeshLambertMaterial({
				color: config.color,
				transparent: true,
				opacity: 0.9,
			});
			const building = new THREE.Mesh(buildingGeometry, buildingMaterial);

			// Position building so it's partially submerged
			building.position.set(config.x, -5 + config.height / 2, config.z);
			building.castShadow = true;
			building.receiveShadow = true;
			building.userData = { type: "building", id: index };

			// Store original material immediately after creation
			building.userData.originalMaterial = {
				color: buildingMaterial.color.clone(),
				emissive: buildingMaterial.emissive
					? buildingMaterial.emissive.clone()
					: null,
				opacity: buildingMaterial.opacity,
			};

			this.scene.add(building);
			this.collisionObjects.push(building);

			// Add windows to buildings
			this.addBuildingWindows(building, config);

			// Add building damage effects
			this.addBuildingDamage(building, config);
		});
	}

	addBuildingWindows(building, config) {
		const windowMaterial = new THREE.MeshBasicMaterial({
			color: 0x87ceeb,
			transparent: true,
			opacity: 0.3,
		});

		// Front and back windows
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < Math.floor(config.height / 2); j++) {
				const windowGeometry = new THREE.PlaneGeometry(0.8, 0.8);
				const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
				window1.position.set(
					building.position.x + (i - 1) * 2,
					building.position.y - config.height / 2 + j * 2 + 1,
					building.position.z + config.depth / 2 + 0.01
				);
				// Store original material for window
				window1.userData = {
					originalMaterial: {
						color: windowMaterial.color.clone(),
						emissive: windowMaterial.emissive
							? windowMaterial.emissive.clone()
							: null,
						opacity: windowMaterial.opacity,
					},
				};
				this.scene.add(window1);

				const window2 = new THREE.Mesh(
					windowGeometry,
					windowMaterial.clone()
				);
				window2.position.set(
					building.position.x + (i - 1) * 2,
					building.position.y - config.height / 2 + j * 2 + 1,
					building.position.z - config.depth / 2 - 0.01
				);
				window2.rotation.y = Math.PI;
				// Store original material for window
				window2.userData = {
					originalMaterial: {
						color: window2.material.color.clone(),
						emissive: window2.material.emissive
							? window2.material.emissive.clone()
							: null,
						opacity: window2.material.opacity,
					},
				};
				this.scene.add(window2);
			}
		}
	}

	addBuildingDamage(building, config) {
		// Add some broken/damaged parts
		if (Math.random() > 0.5) {
			const damageGeometry = new THREE.BoxGeometry(
				config.width * 0.3,
				config.height * 0.2,
				config.depth * 0.1
			);
			const damageMaterial = new THREE.MeshLambertMaterial({
				color: 0x4a4a4a,
				transparent: true,
				opacity: 0.7,
			});
			const damage = new THREE.Mesh(damageGeometry, damageMaterial);
			damage.position.set(
				building.position.x + (Math.random() - 0.5) * config.width,
				building.position.y + (Math.random() - 0.5) * config.height,
				building.position.z + config.depth / 2 + 0.5
			);
			// Store original material for damage
			damage.userData = {
				originalMaterial: {
					color: damageMaterial.color.clone(),
					emissive: damageMaterial.emissive
						? damageMaterial.emissive.clone()
						: null,
					opacity: damageMaterial.opacity,
				},
			};
			this.scene.add(damage);
		}
	}

	createSubmergedVehicles() {
		// Create various vehicles scattered around
		const vehiclePositions = [
			{ x: 10, z: 5 },
			{ x: -20, z: 10 },
			{ x: 30, z: -15 },
			{ x: -5, z: -25 },
			{ x: 15, z: 30 },
			{ x: -35, z: 5 },
		];

		vehiclePositions.forEach((pos, index) => {
			// Car body
			const carBodyGeometry = new THREE.BoxGeometry(4, 1.5, 2);
			const carBodyMaterial = new THREE.MeshLambertMaterial({
				color: [
					0xff4400, 0xff8800, 0xffcc00, 0x00ffff, 0x0088ff, 0x004488,
				][index % 6],
			});
			const carBody = new THREE.Mesh(carBodyGeometry, carBodyMaterial);
			carBody.position.set(pos.x, -8.5, pos.z);
			carBody.castShadow = true;
			carBody.userData = {
				type: "vehicle",
				id: index,
				originalMaterial: {
					color: carBodyMaterial.color.clone(),
					emissive: carBodyMaterial.emissive
						? carBodyMaterial.emissive.clone()
						: null,
					opacity: carBodyMaterial.opacity,
				},
			};
			this.scene.add(carBody);
			this.collisionObjects.push(carBody);

			// Car roof
			const carRoofGeometry = new THREE.BoxGeometry(3, 1, 1.8);
			const carRoof = new THREE.Mesh(
				carRoofGeometry,
				carBodyMaterial.clone()
			);
			carRoof.position.set(pos.x, -7.5, pos.z);
			carRoof.userData = {
				originalMaterial: {
					color: carRoof.material.color.clone(),
					emissive: carRoof.material.emissive
						? carRoof.material.emissive.clone()
						: null,
					opacity: carRoof.material.opacity,
				},
			};
			this.scene.add(carRoof);

			// Wheels (partially buried)
			const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2);
			const wheelMaterial = new THREE.MeshLambertMaterial({
				color: 0x222222,
			});

			const wheelPositions = [
				{ x: pos.x - 1.3, z: pos.z - 0.8 },
				{ x: pos.x + 1.3, z: pos.z - 0.8 },
				{ x: pos.x - 1.3, z: pos.z + 0.8 },
				{ x: pos.x + 1.3, z: pos.z + 0.8 },
			];

			wheelPositions.forEach((wheelPos) => {
				const wheel = new THREE.Mesh(
					wheelGeometry,
					wheelMaterial.clone()
				);
				wheel.position.set(wheelPos.x, -9, wheelPos.z);
				wheel.rotation.z = Math.PI / 2;
				wheel.userData = {
					originalMaterial: {
						color: wheel.material.color.clone(),
						emissive: wheel.material.emissive
							? wheel.material.emissive.clone()
							: null,
						opacity: wheel.material.opacity,
					},
				};
				this.scene.add(wheel);
			});
		});
	}

	createStreetInfrastructure() {
		// Traffic lights
		for (let i = 0; i < 5; i++) {
			const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 6);
			const poleMaterial = new THREE.MeshLambertMaterial({
				color: 0x666666,
			});
			const pole = new THREE.Mesh(poleGeometry, poleMaterial);
			pole.position.set(
				(Math.random() - 0.5) * 80,
				-6,
				(Math.random() - 0.5) * 80
			);
			pole.castShadow = true;
			pole.userData = { type: "infrastructure" };
			this.scene.add(pole);
			this.collisionObjects.push(pole);

			// Traffic light box
			const lightBoxGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.3);
			const lightBoxMaterial = new THREE.MeshLambertMaterial({
				color: 0x333333,
			});
			const lightBox = new THREE.Mesh(lightBoxGeometry, lightBoxMaterial);
			lightBox.position.set(pole.position.x, -3, pole.position.z);
			this.scene.add(lightBox);
		}

		// Street signs and lamp posts
		for (let i = 0; i < 8; i++) {
			const signPoleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 4);
			const signPoleMaterial = new THREE.MeshLambertMaterial({
				color: 0x888888,
			});
			const signPole = new THREE.Mesh(signPoleGeometry, signPoleMaterial);
			signPole.position.set(
				(Math.random() - 0.5) * 100,
				-7,
				(Math.random() - 0.5) * 100
			);
			signPole.userData = { type: "infrastructure" };
			this.scene.add(signPole);
			this.collisionObjects.push(signPole);
		}
	}

	createNaturalDebris() {
		// Tree trunks and large branches
		for (let i = 0; i < 15; i++) {
			const trunkGeometry = new THREE.CylinderGeometry(
				Math.random() * 0.3 + 0.1,
				Math.random() * 0.4 + 0.2,
				Math.random() * 3 + 2
			);
			const trunkMaterial = new THREE.MeshLambertMaterial({
				color: 0x00ffff,
			});
			const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);

			trunk.position.set(
				(Math.random() - 0.5) * 120,
				-8 + Math.random() * 2,
				(Math.random() - 0.5) * 120
			);
			trunk.rotation.set(
				((Math.random() - 0.5) * Math.PI) / 2,
				Math.random() * Math.PI,
				((Math.random() - 0.5) * Math.PI) / 2
			);
			trunk.castShadow = true;
			trunk.userData = { type: "debris" };
			this.scene.add(trunk);
			this.collisionObjects.push(trunk);
		}

		// Large rocks and concrete debris
		for (let i = 0; i < 20; i++) {
			const debrisGeometry = new THREE.DodecahedronGeometry(
				Math.random() * 1 + 0.5
			);
			const debrisMaterial = new THREE.MeshLambertMaterial({
				color: [0x00ffff, 0x0088ff, 0x004488][
					Math.floor(Math.random() * 3)
				],
			});
			const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);

			debris.position.set(
				(Math.random() - 0.5) * 100,
				-9 + Math.random() * 2,
				(Math.random() - 0.5) * 100
			);
			debris.rotation.set(
				Math.random() * Math.PI,
				Math.random() * Math.PI,
				Math.random() * Math.PI
			);
			debris.castShadow = true;
			debris.receiveShadow = true;
			debris.userData = { type: "debris" };
			this.scene.add(debris);
			this.collisionObjects.push(debris);
		}
	}

	createSearchTargets() {
		// Create search targets (people/survivors) that the AUV needs to find
		this.searchTargets = [];

		for (let i = 0; i < 5; i++) {
			// Simple human figure representation
			const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1.5);
			const bodyMaterial = new THREE.MeshLambertMaterial({
				color: 0xff4400, // Bright red-orange for survivors
				emissive: 0x440000, // Red glow to make them visible
				emissiveIntensity: 0.1,
			});
			const person = new THREE.Mesh(bodyGeometry, bodyMaterial);

			// Position randomly around buildings or in open areas
			person.position.set(
				(Math.random() - 0.5) * 80,
				-8.5, // On the ground
				(Math.random() - 0.5) * 80
			);

			person.userData = {
				type: "survivor",
				id: i,
				found: false,
				blinkTimer: 0,
			};

			this.scene.add(person);
			this.searchTargets.push(person);

			// Add a small beacon light to make them easier to spot
			const beaconGeometry = new THREE.SphereGeometry(0.1);
			const beaconMaterial = new THREE.MeshBasicMaterial({
				color: 0xff0000,
				transparent: true,
				opacity: 0.8,
			});
			const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
			beacon.position.set(
				person.position.x,
				person.position.y + 1,
				person.position.z
			);
			this.scene.add(beacon);
			person.userData.beacon = beacon;
		}
	}

	createFloodDebris() {
		// Floating debris at various depths with sonar colors
		const debrisTypes = [
			{ geometry: new THREE.BoxGeometry(1, 0.2, 0.5), color: 0x00ffff }, // Wood planks - cyan
			{ geometry: new THREE.SphereGeometry(0.3), color: 0x0088ff }, // Balls/barrels - blue
			{
				geometry: new THREE.CylinderGeometry(0.2, 0.2, 1),
				color: 0x004488,
			}, // Pipes - dark blue
		];

		for (let i = 0; i < 30; i++) {
			const debrisType =
				debrisTypes[Math.floor(Math.random() * debrisTypes.length)];
			const debrisMaterial = new THREE.MeshLambertMaterial({
				color: debrisType.color,
				transparent: true,
				opacity: 0.8,
			});
			const debris = new THREE.Mesh(debrisType.geometry, debrisMaterial);

			debris.position.set(
				(Math.random() - 0.5) * 100,
				Math.random() * 10 - 5, // Floating at various depths
				(Math.random() - 0.5) * 100
			);
			debris.rotation.set(
				Math.random() * Math.PI,
				Math.random() * Math.PI,
				Math.random() * Math.PI
			);
			debris.userData = {
				type: "floating_debris",
				floatSpeed: (Math.random() - 0.5) * 0.01,
			};
			this.scene.add(debris);
		}
	}

	createFloatingParticles() {
		const particleGeometry = new THREE.BufferGeometry();
		const particleCount = 500;
		const positions = new Float32Array(particleCount * 3);

		for (let i = 0; i < particleCount * 3; i += 3) {
			positions[i] = (Math.random() - 0.5) * 100; // x
			positions[i + 1] = Math.random() * 20 - 10; // y
			positions[i + 2] = (Math.random() - 0.5) * 100; // z
		}

		particleGeometry.setAttribute(
			"position",
			new THREE.BufferAttribute(positions, 3)
		);

		const particleMaterial = new THREE.PointsMaterial({
			color: 0x88ccff,
			size: 0.1,
			transparent: true,
			opacity: 0.6,
		});

		this.particles = new THREE.Points(particleGeometry, particleMaterial);
		this.scene.add(this.particles);
	}

	loadAUVModel() {
		// Create a temporary AUV (simple geometry) while loading the actual model
		this.createTemporaryAUV();

		// Load the actual AUV model
		const mtlLoader = new MTLLoader();
		mtlLoader.setPath("models/");

		mtlLoader.load("HydroBotAUV.mtl", (materials) => {
			materials.preload();

			const objLoader = new OBJLoader();
			objLoader.setMaterials(materials);
			objLoader.setPath("models/");

			objLoader.load(
				"HydroBotAUV.obj",
				(object) => {
					// Remove temporary AUV
					if (this.auv) {
						this.scene.remove(this.auv);
					}

					// Setup the loaded AUV
					this.auv = object;
					this.auv.scale.setScalar(0.15); // Much smaller scale to look more realistic
					this.auv.position.set(0, 0, 0);

					// Fix AUV orientation - rotate to fix vertical loading
					this.auv.rotation.x = -Math.PI / 2; // Fix vertical orientation
					this.auv.rotation.y = 0; // Face forward
					this.auv.rotation.z = 0; // No initial roll - this will be used for horizontal turning

					// Enable shadows
					this.auv.traverse((child) => {
						if (child.isMesh) {
							child.castShadow = true;
							child.receiveShadow = true;
						}
					});

					this.scene.add(this.auv);
					this.updateCameraPosition();
				},
				(progress) => {
					console.log("Loading progress:", progress);
				},
				(error) => {
					console.error("Error loading AUV model:", error);
					// Keep using the temporary AUV if loading fails
				}
			);
		});
	}

	createTemporaryAUV() {
		// Create a simple AUV representation
		const auvGroup = new THREE.Group();

		// Main body
		const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.2, 2);
		const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
		const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
		body.rotation.z = Math.PI / 2;
		body.castShadow = true;
		auvGroup.add(body);

		// Propeller
		const propGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1);
		const propMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
		const propeller = new THREE.Mesh(propGeometry, propMaterial);
		propeller.position.set(-1.2, 0, 0);
		propeller.rotation.z = Math.PI / 2;
		auvGroup.add(propeller);

		// Camera dome (front)
		const domeGeometry = new THREE.SphereGeometry(0.2);
		const domeMaterial = new THREE.MeshLambertMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.8,
		});
		const dome = new THREE.Mesh(domeGeometry, domeMaterial);
		dome.position.set(1, 0, 0);
		auvGroup.add(dome);

		this.auv = auvGroup;
		this.auv.position.set(0, 0, 0);
		this.scene.add(this.auv);
	}

	setupEventListeners() {
		// Keyboard controls
		document.addEventListener("keydown", (event) => this.onKeyDown(event));
		document.addEventListener("keyup", (event) => this.onKeyUp(event));

		// Mouse controls for free cam
		document.addEventListener("mousemove", (event) =>
			this.onMouseMove(event)
		);
		document.addEventListener("click", () => this.requestPointerLock());

		// Prevent default browser behavior for movement keys
		document.addEventListener("keydown", (event) => {
			if (
				[
					"ArrowUp",
					"ArrowDown",
					"ArrowLeft",
					"ArrowRight",
					"KeyW",
					"KeyA",
					"KeyS",
					"KeyD",
					"KeyQ",
					"KeyE",
					"KeyC",
				].includes(event.code)
			) {
				event.preventDefault();
			}
		});

		// Pointer lock change events
		document.addEventListener("pointerlockchange", () => {
			this.isPointerLocked =
				document.pointerLockElement === document.body;
		});
	}

	onKeyDown(event) {
		switch (event.code) {
			case "KeyW":
			case "ArrowUp":
				this.keys.forward = true;
				break;
			case "KeyS":
			case "ArrowDown":
				this.keys.backward = true;
				break;
			case "KeyA":
				this.keys.left = true;
				break;
			case "KeyD":
				this.keys.right = true;
				break;
			case "ArrowLeft":
				this.keys.turnLeft = true;
				break;
			case "ArrowRight":
				this.keys.turnRight = true;
				break;
			case "KeyQ":
				this.keys.up = true;
				break;
			case "KeyE":
				this.keys.down = true;
				break;
			case "KeyC":
				this.toggleFreeCam();
				break;
			case "KeyV":
				this.toggleHitboxes();
				break;
			case "KeyF":
				this.cycleCameraMode();
				break;
			case "Space":
				this.rescueSurvivor();
				event.preventDefault(); // Prevent page scrolling
				break;
		}
	}

	onKeyUp(event) {
		switch (event.code) {
			case "KeyW":
			case "ArrowUp":
				this.keys.forward = false;
				break;
			case "KeyS":
			case "ArrowDown":
				this.keys.backward = false;
				break;
			case "KeyA":
				this.keys.left = false;
				break;
			case "KeyD":
				this.keys.right = false;
				break;
			case "ArrowLeft":
				this.keys.turnLeft = false;
				break;
			case "ArrowRight":
				this.keys.turnRight = false;
				break;
			case "KeyQ":
				this.keys.up = false;
				break;
			case "KeyE":
				this.keys.down = false;
				break;
		}
	}

	requestPointerLock() {
		if (this.isFreeCam) {
			document.body.requestPointerLock();
		}
	}

	onMouseMove(event) {
		if (!this.isFreeCam || !this.isPointerLocked) return;

		const movementX = event.movementX || 0;
		const movementY = event.movementY || 0;

		// Rotate camera based on mouse movement
		this.camera.rotation.y -= movementX * this.mouseSensitivity;
		this.camera.rotation.x -= movementY * this.mouseSensitivity;

		// Clamp vertical rotation to prevent flipping
		this.camera.rotation.x = Math.max(
			-Math.PI / 2,
			Math.min(Math.PI / 2, this.camera.rotation.x)
		);
	}

	toggleFreeCam() {
		this.isFreeCam = !this.isFreeCam;

		if (this.isFreeCam) {
			console.log("Free cam enabled - Press C to toggle back");
		} else {
			// Exit pointer lock
			if (this.isPointerLocked) {
				document.exitPointerLock();
			}
		}
	}

	cycleCameraMode() {
		const modes = ["optical", "sonar"];
		const currentIndex = modes.indexOf(this.cameraMode);
		this.cameraMode = modes[(currentIndex + 1) % modes.length];

		// Activate/deactivate sonar system
		this.sonarSystem.isActive = this.cameraMode === "sonar";
		if (this.sonarSystem.isActive) {
			this.sonarSystem.detectedObjects = []; // Clear previous detections
			this.showAllObjectHitboxes(); // Show all hitboxes immediately
		} else {
			this.hideAllObjectHitboxes(); // Hide hitboxes when switching off sonar
		}

		this.applyCameraEffects();
	}

	showAllObjectHitboxes() {
		// Show wireframes for all collision objects immediately
		this.collisionObjects.forEach((object) => {
			if (!object.userData.sonarWireframe) {
				// Calculate distance for intensity-based coloring
				const distance = this.auv
					? this.auv.position.distanceTo(object.position)
					: 10;
				const intensity = Math.max(
					0.3,
					1 - distance / this.sonarSystem.maxPulseRange
				);

				// Get realistic sonar colors based on object type and intensity
				let wireframeColor = 0x0066aa; // Default blue fallback

				switch (
					object.userData?.type ||
					object.parent?.userData?.type
				) {
					case "survivor":
						// Survivors: bright red-orange
						if (intensity > 0.7) {
							wireframeColor = 0xff4400; // Bright red-orange
						} else if (intensity > 0.4) {
							wireframeColor = 0xff8800; // Orange
						} else {
							wireframeColor = 0xaa4400; // Dark orange
						}
						break;
					case "building":
					case "vehicle":
						// Buildings/vehicles: yellow-orange
						if (intensity > 0.7) {
							wireframeColor = 0xffcc00; // Bright yellow
						} else if (intensity > 0.4) {
							wireframeColor = 0xff8800; // Orange
						} else {
							wireframeColor = 0xcc6600; // Dark orange
						}
						break;
					case "debris":
						// Debris: cyan-blue
						if (intensity > 0.7) {
							wireframeColor = 0x00ffff; // Bright cyan
						} else if (intensity > 0.4) {
							wireframeColor = 0x0088ff; // Blue-cyan
						} else {
							wireframeColor = 0x004488; // Dark blue
						}
						break;
					default:
						// Unknown objects: standard sonar progression (blue to yellow)
						if (intensity > 0.7) {
							wireframeColor = 0xffff00; // Bright yellow
						} else if (intensity > 0.4) {
							wireframeColor = 0x00ffaa; // Cyan-green
						} else {
							wireframeColor = 0x0066aa; // Dark blue
						}
						break;
				}

				const wireframe = new THREE.BoxHelper(object, wireframeColor);
				wireframe.material.transparent = true;
				wireframe.material.opacity = 0.8;
				wireframe.userData = {
					isSonarWireframe: true,
					parentObject: object,
				};
				this.scene.add(wireframe);
				object.userData.sonarWireframe = wireframe;
			}
		});

		// Also show wireframes for search targets (survivors)
		if (this.searchTargets) {
			this.searchTargets.forEach((target) => {
				if (!target.userData.sonarWireframe) {
					const wireframe = new THREE.BoxHelper(target, 0xff4444);
					wireframe.material.transparent = true;
					wireframe.material.opacity = 0.8;
					wireframe.userData = {
						isSonarWireframe: true,
						parentObject: target,
					};
					this.scene.add(wireframe);
					target.userData.sonarWireframe = wireframe;
				}
			});
		}
	}

	hideAllObjectHitboxes() {
		// Remove all sonar wireframes
		this.collisionObjects.forEach((object) => {
			if (object.userData.sonarWireframe) {
				this.scene.remove(object.userData.sonarWireframe);
				delete object.userData.sonarWireframe;
			}
		});

		if (this.searchTargets) {
			this.searchTargets.forEach((target) => {
				if (target.userData.sonarWireframe) {
					this.scene.remove(target.userData.sonarWireframe);
					delete target.userData.sonarWireframe;
				}
			});
		}
	}

	initializeSonarSystem() {
		// Create sonar overlay canvas
		this.sonarSystem.canvas = document.createElement("canvas");
		this.sonarSystem.canvas.style.position = "absolute";
		this.sonarSystem.canvas.style.top = "0";
		this.sonarSystem.canvas.style.left = "0";
		this.sonarSystem.canvas.style.width = "100%";
		this.sonarSystem.canvas.style.height = "100%";
		this.sonarSystem.canvas.style.pointerEvents = "none";
		this.sonarSystem.canvas.style.zIndex = "10";
		this.sonarSystem.canvas.style.display = "none";

		// Get canvas context
		this.sonarSystem.ctx = this.sonarSystem.canvas.getContext("2d");

		// Add to DOM
		this.canvas.parentElement.appendChild(this.sonarSystem.canvas);

		// Create toast overlay canvas
		this.toastCanvas = document.createElement("canvas");
		this.toastCanvas.style.position = "absolute";
		this.toastCanvas.style.top = "0";
		this.toastCanvas.style.left = "0";
		this.toastCanvas.style.width = "100%";
		this.toastCanvas.style.height = "100%";
		this.toastCanvas.style.pointerEvents = "none";
		this.toastCanvas.style.zIndex = "20"; // Higher than sonar canvas
		this.toastCanvas.style.display = "block";

		// Get toast canvas context
		this.toastCtx = this.toastCanvas.getContext("2d");

		// Add toast canvas to DOM
		this.canvas.parentElement.appendChild(this.toastCanvas);

		// Set canvas size
		this.updateSonarCanvasSize();
	}

	updateSonarCanvasSize() {
		if (!this.sonarSystem.canvas) return;

		const rect = this.canvas.getBoundingClientRect();
		this.sonarSystem.canvas.width = rect.width;
		this.sonarSystem.canvas.height = rect.height;

		// Also update toast canvas size
		if (this.toastCanvas) {
			this.toastCanvas.width = rect.width;
			this.toastCanvas.height = rect.height;
		}
	}

	updateSonarScan() {
		if (!this.sonarSystem.isActive || !this.auv) return;

		// Simple visual sonar - just keep objects visible while sonar is active
		// Remove old detections periodically
		const currentTime = Date.now();
		this.sonarSystem.detectedObjects =
			this.sonarSystem.detectedObjects.filter(
				(obj) => currentTime - obj.timestamp < this.sonarSystem.fadeTime
			);
	}

	// Removed fireSonarPulse method - no longer using pulse system

	updateSonarPulses() {
		// Pulses disabled - clear any existing pulses
		this.sonarSystem.pulses = [];
	}

	checkPulseCollisions(pulse) {
		if (!this.auv) return;

		// Cast rays only in front of the AUV (forward arc)
		const rayCount = 36; // Number of rays in the forward arc
		const forwardArcAngle = Math.PI * 0.75; // 135 degrees forward arc (3/4 of PI)
		const startAngle = -forwardArcAngle / 2; // Start from left side of arc
		const angleStep = forwardArcAngle / rayCount;

		for (let i = 0; i < rayCount; i++) {
			// Calculate angle relative to forward direction
			const relativeAngle = startAngle + i * angleStep;

			// Create forward-facing direction vector
			const rayDirection = new THREE.Vector3(
				Math.sin(relativeAngle), // X component for left/right
				0, // Keep horizontal
				Math.cos(relativeAngle) // Z component for forward/back
			);

			// Apply AUV's rotation to the ray direction
			rayDirection.applyQuaternion(this.auv.quaternion);

			// Cast ray from pulse center
			this.raycaster.set(pulse.position, rayDirection);

			// Check intersections
			const intersections = this.raycaster.intersectObjects(
				this.collisionObjects,
				true
			);

			if (intersections.length > 0) {
				const hit = intersections[0];
				const distance = hit.distance;

				// Record hits that are within a reasonable range of the pulse
				const pulseEdge = pulse.radius;
				const hitTolerance = 2.0;

				if (
					distance >= pulseEdge - hitTolerance &&
					distance <= pulseEdge + hitTolerance &&
					distance <= this.sonarSystem.maxPulseRange
				) {
					// Store the angle relative to AUV's heading for proper display
					this.recordSonarReturn(
						relativeAngle,
						distance,
						hit.object,
						hit.point, // Store the exact hit point
						pulse.timestamp
					);
				}
			}
		}
	}

	recordSonarReturn(angle, distance, object, hitPoint, timestamp) {
		// Convert angle to degrees for storage
		const angleDeg = ((angle * 180) / Math.PI + 360) % 360;
		const angleKey = Math.round(
			angleDeg / (360 / this.sonarSystem.imageResolution)
		);
		const distanceKey = Math.round(distance);

		// Create unique key for the entire object
		const key = `${object.uuid}`;

		// Store sonar return data with the entire object for hitbox visualization
		const returnData = {
			angle: angleDeg,
			distance: distance,
			timestamp: timestamp,
			object: object,
			hitPoint: hitPoint.clone(),
			intensity: this.calculateReturnIntensity(object, distance),
			type:
				object.userData?.type ||
				object.parent?.userData?.type ||
				"unknown",
		};

		// Add sonar wireframe to the object temporarily
		this.addSonarWireframe(object, timestamp);

		this.sonarSystem.sonarData.set(key, returnData);
	}

	addSonarWireframe(object, timestamp) {
		// Remove existing sonar wireframe if any
		if (object.userData.sonarWireframe) {
			object.parent?.remove(object.userData.sonarWireframe) ||
				this.scene.remove(object.userData.sonarWireframe);
		}

		// Calculate distance for intensity-based coloring
		const distance = this.auv
			? this.auv.position.distanceTo(object.position)
			: 10;
		const intensity = Math.max(
			0.3,
			1 - distance / this.sonarSystem.maxPulseRange
		);

		// Get realistic sonar colors based on object type and intensity
		let wireframeColor = 0x00ff88; // Default fallback

		switch (object.userData?.type || object.parent?.userData?.type) {
			case "survivor":
				// Survivors: bright red-orange
				if (intensity > 0.7) {
					wireframeColor = 0xff4400; // Bright red-orange
				} else if (intensity > 0.4) {
					wireframeColor = 0xff8800; // Orange
				} else {
					wireframeColor = 0xaa4400; // Dark orange
				}
				break;
			case "building":
			case "vehicle":
				// Buildings/vehicles: yellow-orange
				if (intensity > 0.7) {
					wireframeColor = 0xffcc00; // Bright yellow
				} else if (intensity > 0.4) {
					wireframeColor = 0xff8800; // Orange
				} else {
					wireframeColor = 0xcc6600; // Dark orange
				}
				break;
			case "debris":
				// Debris: cyan-blue
				if (intensity > 0.7) {
					wireframeColor = 0x00ffff; // Bright cyan
				} else if (intensity > 0.4) {
					wireframeColor = 0x0088ff; // Blue-cyan
				} else {
					wireframeColor = 0x004488; // Dark blue
				}
				break;
			default:
				// Unknown objects: standard sonar progression (blue to yellow)
				if (intensity > 0.7) {
					wireframeColor = 0xffff00; // Bright yellow
				} else if (intensity > 0.4) {
					wireframeColor = 0x00ffaa; // Cyan-green
				} else {
					wireframeColor = 0x0066aa; // Dark blue
				}
				break;
		}

		const wireframe = new THREE.BoxHelper(object, wireframeColor);
		wireframe.material.transparent = true;
		wireframe.material.opacity = 0.8;
		wireframe.userData = {
			isSonarWireframe: true,
			timestamp: timestamp,
			parentObject: object,
		};

		// Add wireframe to scene
		this.scene.add(wireframe);
		object.userData.sonarWireframe = wireframe;
		object.userData.sonarTimestamp = timestamp;
	}

	calculateReturnIntensity(object, distance) {
		// Calculate intensity based on object type and distance
		let baseIntensity = 1.0;

		switch (object.userData?.type) {
			case "building":
				baseIntensity = 0.9;
				break;
			case "vehicle":
				baseIntensity = 0.7;
				break;
			case "debris":
				baseIntensity = 0.5;
				break;
			case "survivor":
				baseIntensity = 0.3;
				break;
			default:
				baseIntensity = 0.6;
		}

		// Reduce intensity with distance
		const distanceFactor = Math.max(
			0.1,
			1 - distance / this.sonarSystem.maxPulseRange
		);

		return baseIntensity * distanceFactor;
	}

	cleanupOldSonarData(currentTime) {
		// Remove sonar data older than fade time and clean up wireframes
		for (const [key, data] of this.sonarSystem.sonarData.entries()) {
			if (currentTime - data.timestamp > this.sonarSystem.fadeTime) {
				// Remove wireframe from the object
				if (data.object.userData.sonarWireframe) {
					this.scene.remove(data.object.userData.sonarWireframe);
					delete data.object.userData.sonarWireframe;
					delete data.object.userData.sonarTimestamp;
				}
				this.sonarSystem.sonarData.delete(key);
			} else {
				// Update wireframe opacity based on age
				if (data.object.userData.sonarWireframe) {
					const age = currentTime - data.timestamp;
					const fadeProgress = age / this.sonarSystem.fadeTime;
					const opacity = Math.max(0.1, 0.8 - fadeProgress);
					data.object.userData.sonarWireframe.material.opacity =
						opacity;
				}
			}
		}
	}

	renderSonarDisplay() {
		// No radar display - only wireframes in 3D scene
		return;
	}

	drawSonarSweepLines(ctx, canvas) {
		if (!this.auv) return;

		ctx.save();

		// Get AUV screen position
		const auvPos = this.worldToScreen(this.auv.position);
		if (auvPos.z > 1) return; // Behind camera

		// Draw forward-facing sonar sweep lines
		const currentTime = Date.now();
		const sweepCount = 5; // More sweep lines for forward scanning
		const forwardArcAngle = Math.PI * 0.75; // 135 degree forward arc
		const sweepLength = 300;

		// Get AUV's forward direction
		const forward = new THREE.Vector3(0, 0, 1);
		forward.applyQuaternion(this.auv.quaternion);

		// Calculate base angle for AUV's forward direction
		const baseAngle = Math.atan2(forward.x, forward.z);

		for (let i = 0; i < sweepCount; i++) {
			// Create sweeping motion within the forward arc
			const sweepProgress = (currentTime * 0.002 + i * 0.3) % 2; // Slower sweep
			let sweepAngle;

			if (sweepProgress <= 1) {
				// Sweep from left to right
				sweepAngle =
					baseAngle +
					-forwardArcAngle / 2 +
					sweepProgress * forwardArcAngle;
			} else {
				// Sweep from right to left
				sweepAngle =
					baseAngle +
					forwardArcAngle / 2 -
					(sweepProgress - 1) * forwardArcAngle;
			}

			// Calculate sweep line end point
			const endX = auvPos.x + Math.sin(sweepAngle) * sweepLength;
			const endY = auvPos.y - Math.cos(sweepAngle) * sweepLength; // Negative for correct screen orientation

			// Draw sweep line with fade
			const alpha = 0.4 - i * 0.05;
			ctx.strokeStyle = `rgba(0, 255, 136, ${alpha})`;
			ctx.lineWidth = 2;

			ctx.beginPath();
			ctx.moveTo(auvPos.x, auvPos.y);
			ctx.lineTo(endX, endY);
			ctx.stroke();
		}

		// Draw forward arc boundaries
		ctx.strokeStyle = `rgba(0, 255, 136, 0.2)`;
		ctx.lineWidth = 1;

		// Left boundary
		const leftAngle = baseAngle - forwardArcAngle / 2;
		ctx.beginPath();
		ctx.moveTo(auvPos.x, auvPos.y);
		ctx.lineTo(
			auvPos.x + Math.sin(leftAngle) * sweepLength * 0.8,
			auvPos.y - Math.cos(leftAngle) * sweepLength * 0.8
		);
		ctx.stroke();

		// Right boundary
		const rightAngle = baseAngle + forwardArcAngle / 2;
		ctx.beginPath();
		ctx.moveTo(auvPos.x, auvPos.y);
		ctx.lineTo(
			auvPos.x + Math.sin(rightAngle) * sweepLength * 0.8,
			auvPos.y - Math.cos(rightAngle) * sweepLength * 0.8
		);
		ctx.stroke();

		ctx.restore();
	}

	drawSonarObjectShapes(ctx, canvas) {
		// No longer need to draw on canvas - using actual 3D wireframes instead
		// The wireframes are added directly to the 3D scene in recordSonarReturn
		return;
	}

	drawFullScaleObject(ctx, object, screenPos, color, alpha) {
		ctx.save();
		ctx.strokeStyle = color;
		ctx.fillStyle = color.replace(/[\d\.]+\)$/g, `${alpha * 0.4})`);
		ctx.lineWidth = 2;

		// Calculate object's actual bounding box
		const bbox = new THREE.Box3().setFromObject(object);
		const size = bbox.getSize(new THREE.Vector3());

		// Calculate proper scale factor for realistic size on screen
		const distance = this.camera.position.distanceTo(object.position) || 1;
		const scaleFactor = 200 / distance; // Larger scale for full visibility
		const width = size.x * scaleFactor;
		const height = size.z * scaleFactor;

		// Draw based on object type with full scale
		switch (object.userData?.type || object.parent?.userData?.type) {
			case "building":
				// Draw full building rectangle
				ctx.fillRect(
					screenPos.x - width / 2,
					screenPos.y - height / 2,
					width,
					height
				);
				ctx.strokeRect(
					screenPos.x - width / 2,
					screenPos.y - height / 2,
					width,
					height
				);
				break;

			case "vehicle":
				// Draw full vehicle as rounded rectangle
				const radius = Math.min(width, height) * 0.2;
				this.drawRoundedRect(
					ctx,
					screenPos.x - width / 2,
					screenPos.y - height / 2,
					width,
					height,
					radius
				);
				ctx.fill();
				ctx.stroke();
				break;

			case "survivor":
				// Draw survivor as large circle
				const survivorRadius = Math.max(
					20,
					Math.max(width, height) / 2
				);
				ctx.beginPath();
				ctx.arc(
					screenPos.x,
					screenPos.y,
					survivorRadius,
					0,
					Math.PI * 2
				);
				ctx.fill();
				ctx.stroke();

				// Draw cross
				ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.moveTo(screenPos.x - 10, screenPos.y);
				ctx.lineTo(screenPos.x + 10, screenPos.y);
				ctx.moveTo(screenPos.x, screenPos.y - 10);
				ctx.lineTo(screenPos.x, screenPos.y + 10);
				ctx.stroke();
				break;

			case "debris":
			case "floating_debris":
				// Draw debris as irregular polygon
				const debrisSize = Math.max(15, Math.max(width, height) / 2);
				ctx.beginPath();
				for (let i = 0; i < 8; i++) {
					const angle = (i / 8) * Math.PI * 2;
					const radius = debrisSize * (0.7 + Math.sin(i * 2) * 0.3);
					const x = screenPos.x + Math.cos(angle) * radius;
					const y = screenPos.y + Math.sin(angle) * radius;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.closePath();
				ctx.fill();
				ctx.stroke();
				break;

			default:
				// Default - large circle
				const defaultRadius = Math.max(15, Math.max(width, height) / 2);
				ctx.beginPath();
				ctx.arc(
					screenPos.x,
					screenPos.y,
					defaultRadius,
					0,
					Math.PI * 2
				);
				ctx.fill();
				ctx.stroke();
				break;
		}

		ctx.restore();
	}

	drawRoundedRect(ctx, x, y, width, height, radius) {
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(
			x + width,
			y + height,
			x + width - radius,
			y + height
		);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
	}

	drawSonarHitPoint(ctx, screenPos, color, alpha, intensity, type) {
		ctx.save();

		// Size based on intensity and type
		let baseSize = 2 + intensity * 4;
		if (type === "survivor") baseSize *= 1.5; // Make survivors more visible
		if (type === "building") baseSize *= 1.2; // Buildings slightly larger

		// Draw hit point with glow effect
		ctx.shadowColor = color;
		ctx.shadowBlur = 8 * alpha;
		ctx.fillStyle = color;

		// Main hit point
		ctx.beginPath();
		ctx.arc(screenPos.x, screenPos.y, baseSize, 0, Math.PI * 2);
		ctx.fill();

		// Draw additional visual indicator based on type
		ctx.shadowBlur = 0;
		ctx.strokeStyle = color;
		ctx.lineWidth = 1;

		switch (type) {
			case "building":
				// Square outline for buildings
				ctx.strokeRect(
					screenPos.x - baseSize - 2,
					screenPos.y - baseSize - 2,
					(baseSize + 2) * 2,
					(baseSize + 2) * 2
				);
				break;
			case "vehicle":
				// Diamond shape for vehicles
				ctx.beginPath();
				ctx.moveTo(screenPos.x, screenPos.y - baseSize - 3);
				ctx.lineTo(screenPos.x + baseSize + 3, screenPos.y);
				ctx.lineTo(screenPos.x, screenPos.y + baseSize + 3);
				ctx.lineTo(screenPos.x - baseSize - 3, screenPos.y);
				ctx.closePath();
				ctx.stroke();
				break;
			case "survivor":
				// Cross for survivors
				ctx.beginPath();
				ctx.moveTo(screenPos.x - baseSize - 3, screenPos.y);
				ctx.lineTo(screenPos.x + baseSize + 3, screenPos.y);
				ctx.moveTo(screenPos.x, screenPos.y - baseSize - 3);
				ctx.lineTo(screenPos.x, screenPos.y + baseSize + 3);
				ctx.stroke();
				break;
			case "debris":
				// Irregular outline for debris
				ctx.beginPath();
				for (let i = 0; i < 6; i++) {
					const angle = (i / 6) * Math.PI * 2;
					const radius = baseSize + 2 + Math.sin(i) * 2;
					const x = screenPos.x + Math.cos(angle) * radius;
					const y = screenPos.y + Math.sin(angle) * radius;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.closePath();
				ctx.stroke();
				break;
		}

		ctx.restore();
	}

	drawObjectOutline(ctx, object, screenPos, color, alpha) {
		ctx.save();
		ctx.strokeStyle = color;
		ctx.fillStyle = color.replace(/[\d\.]+\)$/g, `${alpha * 0.2})`); // Semi-transparent fill
		ctx.lineWidth = 2;

		// Get object's bounding box for size reference
		const bbox = new THREE.Box3().setFromObject(object);
		const size = bbox.getSize(new THREE.Vector3());

		// Scale factor for screen space
		const scaleFactor =
			100 / (this.camera.position.distanceTo(object.position) || 1);
		const width = size.x * scaleFactor;
		const height = size.z * scaleFactor; // Use Z for width in screen space

		switch (object.userData?.type) {
			case "building":
				// Draw building as rectangle
				ctx.strokeRect(
					screenPos.x - width / 2,
					screenPos.y - height / 2,
					width,
					height
				);
				ctx.fillRect(
					screenPos.x - width / 2,
					screenPos.y - height / 2,
					width,
					height
				);
				break;

			case "vehicle":
				// Draw vehicle as rounded rectangle
				const radius = Math.min(width, height) * 0.2;
				this.drawRoundedRect(
					ctx,
					screenPos.x - width / 2,
					screenPos.y - height / 2,
					width,
					height,
					radius
				);
				break;

			case "survivor":
				// Draw survivor as circle with cross
				const survivorRadius = Math.max(8, width / 2);
				ctx.beginPath();
				ctx.arc(
					screenPos.x,
					screenPos.y,
					survivorRadius,
					0,
					Math.PI * 2
				);
				ctx.stroke();
				ctx.fill();

				// Draw cross inside
				ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(screenPos.x - 4, screenPos.y);
				ctx.lineTo(screenPos.x + 4, screenPos.y);
				ctx.moveTo(screenPos.x, screenPos.y - 4);
				ctx.lineTo(screenPos.x, screenPos.y + 4);
				ctx.stroke();
				break;

			case "debris":
				// Draw debris as irregular shape
				const debrisSize = Math.max(6, width / 2);
				ctx.beginPath();
				for (let i = 0; i < 6; i++) {
					const angle = (i / 6) * Math.PI * 2;
					const radius = debrisSize * (0.7 + Math.random() * 0.3);
					const x = screenPos.x + Math.cos(angle) * radius;
					const y = screenPos.y + Math.sin(angle) * radius;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.closePath();
				ctx.stroke();
				ctx.fill();
				break;

			default:
				// Draw unknown objects as diamonds
				const diamondSize = Math.max(8, width / 2);
				ctx.beginPath();
				ctx.moveTo(screenPos.x, screenPos.y - diamondSize);
				ctx.lineTo(screenPos.x + diamondSize, screenPos.y);
				ctx.lineTo(screenPos.x, screenPos.y + diamondSize);
				ctx.lineTo(screenPos.x - diamondSize, screenPos.y);
				ctx.closePath();
				ctx.stroke();
				ctx.fill();
				break;
		}

		ctx.restore();
	}

	drawRoundedRect(ctx, x, y, width, height, radius) {
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(
			x + width,
			y + height,
			x + width - radius,
			y + height
		);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
		ctx.stroke();
		ctx.fill();
	}

	drawSonarPulseRings(ctx, canvas) {
		if (!this.auv) return;

		ctx.save();

		// Get AUV screen position for pulse center
		const auvPos = this.worldToScreen(this.auv.position);
		if (auvPos.z > 1) return;

		// Draw expanding pulse rings
		this.sonarSystem.pulses.forEach((pulse) => {
			const distance = pulse.radius;
			const screenRadius = distance * 10; // Scale to screen space

			if (screenRadius < 5) return;

			// Pulse ring
			ctx.strokeStyle = "rgba(0, 255, 136, 0.6)";
			ctx.lineWidth = 2;
			ctx.globalAlpha = 0.8;

			ctx.beginPath();
			ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
			ctx.stroke();

			// Draw pulse fade effect (only if radius is large enough)
			if (screenRadius > 20) {
				const innerRadius = Math.max(0, screenRadius - 5);
				const outerRadius = screenRadius + 5;

				const gradient = ctx.createRadialGradient(
					centerX,
					centerY,
					innerRadius,
					centerX,
					centerY,
					outerRadius
				);
				gradient.addColorStop(0, "rgba(0, 255, 136, 0)");
				gradient.addColorStop(0.5, "rgba(0, 255, 136, 0.3)");
				gradient.addColorStop(1, "rgba(0, 255, 136, 0)");

				ctx.strokeStyle = gradient;
				ctx.lineWidth = 10;
				ctx.globalAlpha = 0.4;
				ctx.beginPath();
				ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
				ctx.stroke();
			}
		});

		ctx.restore();
	}

	drawSonarInfoOverlay(ctx, canvas) {
		ctx.save();

		// Sonar status info with realistic sonar amber color
		ctx.fillStyle = "rgba(255, 200, 100, 0.9)";
		ctx.font = "16px monospace";
		ctx.fillText("SONAR ACTIVE - SHOWING ALL HITBOXES", 20, 30);

		ctx.font = "12px monospace";
		ctx.fillText(`Total objects: ${this.collisionObjects.length}`, 20, 50);
		if (this.searchTargets) {
			ctx.fillText(`Survivors: ${this.searchTargets.length}`, 20, 70);
		}

		// Search and Rescue Panel
		ctx.fillStyle = "#ffaa00";
		ctx.font = "14px monospace";
		ctx.fillText("SEARCH & RESCUE", 20, 110);

		ctx.font = "12px monospace";
		ctx.fillStyle = "#ffffff";

		if (this.foundSurvivors.length > 0) {
			ctx.fillText(
				`Found Survivors: ${this.foundSurvivors.length}`,
				20,
				130
			);
			this.foundSurvivors.forEach((survivor, index) => {
				if (!survivor.rescued) {
					ctx.fillText(
						`• Survivor ${index + 1} - Press SPACE to rescue`,
						20,
						150 + index * 20
					);
				}
			});
		} else {
			ctx.fillText("No survivors found yet", 20, 130);
		}

		ctx.restore();
	}

	drawToastMessages() {
		if (
			!this.toastCanvas ||
			!this.toastCtx ||
			this.rescueMessages.length === 0
		)
			return;

		// Clear the toast canvas
		this.toastCtx.clearRect(
			0,
			0,
			this.toastCanvas.width,
			this.toastCanvas.height
		);

		this.toastCtx.save();

		// Draw each rescue message as a toast notification
		this.rescueMessages.forEach((message, index) => {
			const currentTime = Date.now();
			const age = currentTime - message.timestamp;
			const progress = age / message.duration;

			// Calculate opacity with fade out effect
			let alpha = 1;
			if (progress > 0.7) {
				// Start fading out in the last 30% of duration
				alpha = 1 - (progress - 0.7) / 0.3;
			}

			if (alpha <= 0) return;

			// Toast position (centered horizontally, stacked vertically)
			const toastWidth = 400;
			const toastHeight = 60;
			const x = (this.toastCanvas.width - toastWidth) / 2;
			const y = 100 + index * (toastHeight + 10); // Stack multiple toasts

			// Draw toast background
			this.toastCtx.fillStyle = `rgba(0, 0, 0, ${0.8 * alpha})`;
			this.toastCtx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
			this.toastCtx.lineWidth = 2;

			// Rounded rectangle background
			this.drawRoundedRect(
				this.toastCtx,
				x,
				y,
				toastWidth,
				toastHeight,
				10
			);
			this.toastCtx.fill();
			this.toastCtx.stroke();

			// Draw text
			this.toastCtx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
			this.toastCtx.font = "bold 18px monospace";
			this.toastCtx.textAlign = "center";
			this.toastCtx.fillText(
				message.text,
				x + toastWidth / 2,
				y + toastHeight / 2 + 6
			);
		});

		this.toastCtx.restore();
	}

	worldToScreen(worldPos) {
		// Convert 3D world position to 2D screen coordinates
		const vector = worldPos.clone().project(this.camera);

		const canvas = this.sonarSystem.canvas || this.canvas;
		const x = ((vector.x + 1) * canvas.width) / 2;
		const y = ((-vector.y + 1) * canvas.height) / 2;

		return { x, y, z: vector.z };
	}

	// Removed drawSonarPulses method - no longer using pulse system

	drawSonarReturns(ctx, centerX, centerY, scale) {
		const currentTime = Date.now();

		ctx.save();

		// Draw all sonar returns as a proper sonar image
		for (const [key, returnData] of this.sonarSystem.sonarData.entries()) {
			const age = currentTime - returnData.timestamp;
			const fadeProgress = age / this.sonarSystem.fadeTime;
			const alpha = Math.max(0, 1 - fadeProgress);

			if (alpha <= 0) continue;

			// Convert polar coordinates to screen position
			// Apply AUV heading offset so display rotates with AUV
			const auvHeading = this.auv ? this.auv.rotation.z : 0; // Z rotation for horizontal turning
			const angleRad = (returnData.angle * Math.PI) / 180 + auvHeading;
			const distance = returnData.distance * scale;

			const x = centerX + Math.cos(angleRad - Math.PI / 2) * distance;
			const y = centerY + Math.sin(angleRad - Math.PI / 2) * distance;

			// Color based on intensity and age
			let intensity = returnData.intensity * alpha;

			// Different colors for different object types
			let r, g, b;
			switch (returnData.type) {
				case "building":
					r = Math.floor(255 * intensity);
					g = Math.floor(100 * intensity);
					b = 0;
					break;
				case "vehicle":
					r = Math.floor(255 * intensity);
					g = Math.floor(255 * intensity);
					b = 0;
					break;
				case "survivor":
					r = Math.floor(255 * intensity);
					g = 0;
					b = 0;
					break;
				default:
					r = 0;
					g = Math.floor(255 * intensity);
					b = Math.floor(100 * intensity);
					break;
			}

			// Draw the sonar return pixel
			ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
			ctx.fillRect(x - 1, y - 1, 3, 3);

			// Add glow effect for strong returns
			if (intensity > 0.7) {
				ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`;
				ctx.fillRect(x - 2, y - 2, 5, 5);
			}
		}

		ctx.restore();
	}

	drawSonarGrid(ctx, centerX, centerY, maxRadius) {
		ctx.save();
		ctx.strokeStyle = "rgba(0, 255, 136, 0.2)";
		ctx.lineWidth = 1;

		// Range rings
		const ringCount = 5;
		for (let i = 1; i <= ringCount; i++) {
			const radius = (maxRadius / ringCount) * i;
			ctx.beginPath();
			ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
			ctx.stroke();

			// Range labels
			ctx.fillStyle = "rgba(0, 255, 136, 0.6)";
			ctx.font = "12px Courier New";
			ctx.textAlign = "center";
			const range = (this.sonarSystem.maxPulseRange / ringCount) * i;
			ctx.fillText(range.toFixed(0) + "m", centerX + radius, centerY - 5);
		}

		// Bearing lines (every 30 degrees) - rotate with AUV heading
		const auvHeading = this.auv ? this.auv.rotation.z : 0;
		for (let angle = 0; angle < 360; angle += 30) {
			const angleRad = (angle * Math.PI) / 180 + auvHeading;
			const x1 = centerX + Math.cos(angleRad - Math.PI / 2) * 20;
			const y1 = centerY + Math.sin(angleRad - Math.PI / 2) * 20;
			const x2 = centerX + Math.cos(angleRad - Math.PI / 2) * maxRadius;
			const y2 = centerY + Math.sin(angleRad - Math.PI / 2) * maxRadius;

			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();

			// Bearing labels - show relative bearing
			ctx.fillStyle = "rgba(0, 255, 136, 0.8)";
			ctx.font = "14px Courier New";
			ctx.textAlign = "center";
			const labelX =
				centerX + Math.cos(angleRad - Math.PI / 2) * (maxRadius + 15);
			const labelY =
				centerY + Math.sin(angleRad - Math.PI / 2) * (maxRadius + 15);

			// Show relative bearing (0° is always forward for the AUV)
			const relativeBearing = angle;
			ctx.fillText(relativeBearing + "°", labelX, labelY);
		}

		// Center point (AUV position)
		ctx.fillStyle = this.sonarSystem.pulseColor;
		ctx.beginPath();
		ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
		ctx.fill();

		ctx.restore();
	}

	drawSonarInfo(ctx, canvas) {
		ctx.save();
		ctx.fillStyle = "rgba(0, 255, 136, 0.8)";
		ctx.font = "16px Courier New";
		ctx.textAlign = "left";

		// Sonar info display
		const info = [
			`SONAR ACTIVE`,
			`Range: ${this.sonarSystem.maxPulseRange}m`,
			`Pulses: ${this.sonarSystem.pulses.length}`,
			`Returns: ${this.sonarSystem.sonarData.size}`,
		];

		info.forEach((text, index) => {
			ctx.fillText(text, 20, 30 + index * 20);
		});

		// Pulse indicator
		if (this.sonarSystem.pulses.length > 0) {
			const pulseAge =
				Date.now() -
				this.sonarSystem.pulses[this.sonarSystem.pulses.length - 1]
					.timestamp;
			const pulseFlash = Math.sin(pulseAge * 0.01) * 0.5 + 0.5;
			ctx.fillStyle = `rgba(0, 255, 136, ${pulseFlash})`;
			ctx.fillText("● PING", canvas.width - 100, 30);
		}

		ctx.restore();
	}

	applyCameraEffects() {
		// Reset renderer effects
		this.renderer.setClearColor(0x004466, 1.0);

		// Update sonar canvas visibility
		if (this.sonarSystem.canvas) {
			this.sonarSystem.canvas.style.display =
				this.cameraMode === "sonar" ? "block" : "none";
		}

		switch (this.cameraMode) {
			case "optical":
				// Normal underwater view
				this.scene.fog.color.setHex(0x006994);
				this.scene.fog.near = 1;
				this.scene.fog.far = 50;
				break;

			case "sonar":
				// Sonar view - darker with green tint
				this.renderer.setClearColor(0x001100, 1.0);
				this.scene.fog.color.setHex(0x002200);
				this.scene.fog.near = 0.5;
				this.scene.fog.far = 30;
				break;
		}
	}

	getCameraMode() {
		return this.cameraMode;
	}

	updateMovement() {
		if (this.isFreeCam) {
			this.updateFreeCamMovement();
		} else {
			this.updateAUVMovement();
		}
	}

	updateFreeCamMovement() {
		// Free camera movement
		const direction = new THREE.Vector3();

		// Get camera's forward direction
		const forward = new THREE.Vector3(0, 0, -1);
		forward.applyQuaternion(this.camera.quaternion);

		// Get camera's right direction
		const right = new THREE.Vector3(1, 0, 0);
		right.applyQuaternion(this.camera.quaternion);

		// Get camera's up direction (world up)
		const up = new THREE.Vector3(0, 1, 0);

		// Movement based on camera orientation
		if (this.keys.forward) {
			direction.add(forward.multiplyScalar(this.cameraSpeed));
		}
		if (this.keys.backward) {
			direction.add(forward.multiplyScalar(-this.cameraSpeed));
		}
		if (this.keys.left) {
			direction.add(right.multiplyScalar(-this.cameraSpeed));
		}
		if (this.keys.right) {
			direction.add(right.multiplyScalar(this.cameraSpeed));
		}
		if (this.keys.up) {
			direction.add(up.multiplyScalar(this.cameraSpeed));
		}
		if (this.keys.down) {
			direction.add(up.multiplyScalar(-this.cameraSpeed));
		}

		// Apply movement
		this.camera.position.add(direction);
	}

	updateAUVMovement() {
		if (!this.auv) return;

		// Handle rotation first - store the rotation for both AUV and camera
		let rotationChange = 0;
		if (this.keys.left) {
			rotationChange = this.rotationSpeed; // Turn left (yaw)
		}
		if (this.keys.right) {
			rotationChange = -this.rotationSpeed; // Turn right (yaw)
		}

		// Apply rotation to both AUV and camera - use Z axis for horizontal rotation
		// since the AUV model is rotated (x = -PI/2)
		if (rotationChange !== 0) {
			this.auv.rotation.z += rotationChange; // Use Z-axis for horizontal turning
			this.camera.rotation.y += rotationChange;
		}

		// Calculate movement based on camera's view direction (where you're looking)
		const direction = new THREE.Vector3();

		// Get the camera's forward direction (where you're looking)
		const forward = new THREE.Vector3(0, 0, -1);
		forward.applyQuaternion(this.camera.quaternion);

		// Get the camera's right direction
		const right = new THREE.Vector3(1, 0, 0);
		right.applyQuaternion(this.camera.quaternion);

		// Get the world up direction
		const up = new THREE.Vector3(0, 1, 0);

		// Forward/backward movement based on camera view direction
		if (this.keys.forward) {
			direction.add(forward.multiplyScalar(this.speed));
		}
		if (this.keys.backward) {
			direction.add(forward.multiplyScalar(-this.speed));
		}

		// Strafing with arrow keys based on camera orientation
		if (this.keys.turnLeft) {
			direction.add(right.multiplyScalar(-this.speed)); // Strafe left
		}
		if (this.keys.turnRight) {
			direction.add(right.multiplyScalar(this.speed)); // Strafe right
		}

		// Up/down movement in world space
		if (this.keys.up) {
			direction.add(up.multiplyScalar(this.speed));
		}
		if (this.keys.down) {
			direction.add(up.multiplyScalar(-this.speed));
		}

		// Apply movement with collision detection
		const newPosition = this.auv.position.clone().add(direction);

		// Check for collisions before moving
		if (this.checkCollision(newPosition)) {
			// Collision detected, try to slide along the surface
			const slideDirection = this.calculateSlideDirection(
				direction,
				newPosition
			);
			if (
				slideDirection &&
				!this.checkCollision(
					this.auv.position.clone().add(slideDirection)
				)
			) {
				this.auv.position.add(slideDirection);
			}
			// If sliding also fails, don't move
		} else {
			// No collision, safe to move
			this.auv.position.copy(newPosition);
		}

		// Keep AUV above the ocean floor
		this.auv.position.y = Math.max(this.auv.position.y, -8);

		// Check for search target proximity
		this.checkSearchTargets();

		// Update navigation data
		this.updateNavigationData();

		// Update camera position for first-person view
		this.updateCameraPosition();

		// Update headlight positions
		this.updateHeadlights();
	}

	updateCameraPosition() {
		if (!this.auv || this.isFreeCam) return;

		// Position camera at the front of the AUV (first person view)
		const cameraPosition = this.cameraOffset.clone();
		cameraPosition.applyQuaternion(this.auv.quaternion);
		cameraPosition.add(this.auv.position);

		this.camera.position.copy(cameraPosition);

		// Keep camera rotation synchronized with AUV rotation
		// Since AUV uses Z-axis for horizontal rotation, adjust camera accordingly
		this.camera.rotation.x = 0; // No pitch from AUV
		this.camera.rotation.y = this.auv.rotation.z + Math.PI; // Follow AUV's Z rotation + 180 to face forward
		this.camera.rotation.z = 0; // No roll
	}

	updateHeadlights() {
		if (!this.auv || !this.leftHeadlight || !this.rightHeadlight) return;

		// Position headlights at the front of the AUV - adjusted for rotated AUV
		const leftPos = new THREE.Vector3(0.2, -2, 0.1); // Adjusted for rotated AUV
		const rightPos = new THREE.Vector3(-0.2, -2, 0.1); // Adjusted for rotated AUV

		leftPos.applyQuaternion(this.auv.quaternion);
		rightPos.applyQuaternion(this.auv.quaternion);

		leftPos.add(this.auv.position);
		rightPos.add(this.auv.position);

		this.leftHeadlight.position.copy(leftPos);
		this.rightHeadlight.position.copy(rightPos);

		// Point headlights north (negative Y direction) - LED lights now face north
		const targetPos = new THREE.Vector3(0, -5, 0); // Changed to negative Y to point north
		targetPos.applyQuaternion(this.auv.quaternion);
		targetPos.add(this.auv.position);

		this.leftHeadlight.target.position.copy(targetPos);
		this.rightHeadlight.target.position.copy(targetPos);
	}

	updateNavigationData() {
		if (!this.auv) return;

		// Calculate heading from AUV rotation (Z-axis rotation converted to compass degrees)
		// Convert radians to degrees and normalize to 0-360
		let headingRad = this.auv.rotation.z;
		let newHeading = ((headingRad * 180) / Math.PI + 360) % 360;

		// Apply compass error from magnetic interference
		newHeading += this.compassErrorOffset;

		// Smooth heading changes to prevent jumps
		const headingDiff = newHeading - this.currentHeading;
		if (Math.abs(headingDiff) > 180) {
			// Handle wrap-around case (e.g., 359° to 1°)
			if (headingDiff > 0) {
				newHeading -= 360;
			} else {
				newHeading += 360;
			}
		}

		// Interpolate for smoother heading changes
		this.currentHeading += (newHeading - this.currentHeading) * 0.1;

		// Normalize to 0-360 range
		if (this.currentHeading < 0) this.currentHeading += 360;
		if (this.currentHeading >= 360) this.currentHeading -= 360;

		// Calculate speed based on position change with smoothing
		const currentTime = Date.now();
		const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds

		if (deltaTime > 0.02) {
			// Only update every 20ms to reduce jitter
			const distance = this.auv.position.distanceTo(this.lastPosition);
			// Convert to knots with better scaling
			const instantSpeed = Math.min((distance / deltaTime) * 5, 10); // Cap at 10 knots

			// Add to speed samples for smoothing
			this.speedSamples.push(instantSpeed);
			if (this.speedSamples.length > this.maxSpeedSamples) {
				this.speedSamples.shift();
			}

			// Calculate average speed for smoothing
			this.currentSpeed =
				this.speedSamples.reduce((a, b) => a + b, 0) /
				this.speedSamples.length;

			this.lastPosition.copy(this.auv.position);
			this.lastUpdateTime = currentTime;
		}
	}

	animateParticles() {
		if (this.particles) {
			// Slowly rotate particles to simulate water movement
			this.particles.rotation.y += 0.001;

			// Move particles slightly
			const positions = this.particles.geometry.attributes.position.array;
			for (let i = 1; i < positions.length; i += 3) {
				positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.001;
			}
			this.particles.geometry.attributes.position.needsUpdate = true;
		}
	}

	onWindowResize() {
		const rect = this.canvas.getBoundingClientRect();
		const width = rect.width || window.innerWidth;
		const height = rect.height || window.innerHeight;

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(window.devicePixelRatio);

		// Update sonar canvas size
		this.updateSonarCanvasSize();
	}

	animate() {
		requestAnimationFrame(() => this.animate());

		this.updateMovement();
		this.animateParticles();
		this.animateFloatingDebris();
		this.updateHitboxes(); // Update hitbox positions
		this.applyCameraModeEffects(); // Apply visual effects based on camera mode
		this.updateSonarScan(); // Update sonar scanning
		this.updateRandomEvents(); // Update random events system
		this.updateFoundSurvivors(); // Update survivor rescue system

		if (this.renderer && this.scene && this.camera) {
			this.renderer.render(this.scene, this.camera);
			// Draw toast messages on top of the 3D scene
			this.drawToastMessages();
		}
	}

	applyCameraModeEffects() {
		// Apply different visual effects based on camera mode
		this.scene.traverse((object) => {
			if (object.isMesh && object.material && object.material.color) {
				// Store original material if not already stored
				if (!object.userData.originalMaterial) {
					object.userData.originalMaterial = {
						color: object.material.color.clone(),
						emissive: object.material.emissive
							? object.material.emissive.clone()
							: null,
						opacity: object.material.opacity || 1,
					};
				}

				switch (this.cameraMode) {
					case "optical":
						// Normal view - restore original colors
						object.material.color.copy(
							object.userData.originalMaterial.color
						);
						if (
							object.userData.originalMaterial.emissive &&
							object.material.emissive
						) {
							object.material.emissive.copy(
								object.userData.originalMaterial.emissive
							);
						}
						object.material.opacity =
							object.userData.originalMaterial.opacity;
						// Restore scene background and fog for optical mode
						this.scene.background = new THREE.Color(0x000811);
						this.renderer.setClearColor(0x000811, 1.0);
						if (this.scene.fog) {
							this.scene.fog.color.setHex(0x006994);
							this.scene.fog.near = 1;
							this.scene.fog.far = 50;
						}
						break;
					case "sonar":
						// Sonar view - green monochrome with distance-based intensity
						if (this.auv && object !== this.auv) {
							const distance = this.auv.position.distanceTo(
								object.position
							);
							const intensity = Math.max(0.1, 1 - distance / 50);
							object.material.color.setRGB(0, intensity, 0);
							if (object.material.emissive) {
								object.material.emissive.setRGB(
									0,
									intensity * 0.2,
									0
								);
							}
						}
						break;
				}

				// Force material update
				object.material.needsUpdate = true;
			}
		});
	}

	// Collision detection methods
	checkCollision(newPosition) {
		if (!this.auv) return false;

		// Create a temporary AUV at the new position to test collision
		const originalPosition = this.auv.position.clone();
		this.auv.position.copy(newPosition);

		// Get the actual AUV bounding box at the new position
		this.auvBoundingBox.setFromObject(this.auv);

		// Restore original position
		this.auv.position.copy(originalPosition);

		// Check collision with all collidable objects
		for (let obj of this.collisionObjects) {
			const objBoundingBox = new THREE.Box3().setFromObject(obj);
			if (this.auvBoundingBox.intersectsBox(objBoundingBox)) {
				// Calculate collision direction and update damage status
				this.handleCollisionEvent(obj, originalPosition, newPosition);

				return true; // Collision detected
			}
		}

		// Reset collision status if no collision
		this.collisionData.active = false;
		this.resetDamageStatus();
		return false;
	}

	handleCollisionEvent(collisionObject, originalPos, attemptedPos) {
		const currentTime = Date.now();

		// Prevent spam collisions (only trigger every 500ms)
		if (currentTime - this.collisionData.lastCollisionTime < 500) {
			this.collisionData.active = true;
			return;
		}

		// Calculate collision direction relative to AUV
		const collisionDirection = this.calculateCollisionDirection(
			originalPos,
			attemptedPos,
			collisionObject
		);

		// Update damage status based on direction
		this.updateDamageStatus(collisionDirection);

		// Set collision data for GUI
		this.collisionData.active = true;
		this.collisionData.newCollision = {
			type: collisionObject.userData?.type || "object",
			direction: collisionDirection,
			timestamp: currentTime,
		};
		this.collisionData.lastCollisionTime = currentTime;

		// Clear new collision after GUI has time to process it
		setTimeout(() => {
			this.collisionData.newCollision = null;
		}, 100);
	}

	calculateCollisionDirection(originalPos, attemptedPos, collisionObject) {
		// Get the direction vector from AUV to collision object
		const directionToObject = collisionObject.position
			.clone()
			.sub(originalPos)
			.normalize();

		// Get AUV's local coordinate system (accounting for rotation)
		const auvForward = new THREE.Vector3(0, 1, 0); // Y is forward after rotation
		const auvRight = new THREE.Vector3(1, 0, 0); // X is right

		// Apply AUV rotation to get world directions
		auvForward.applyQuaternion(this.auv.quaternion);
		auvRight.applyQuaternion(this.auv.quaternion);

		// Calculate dot products to determine direction
		const forwardDot = directionToObject.dot(auvForward);
		const rightDot = directionToObject.dot(auvRight);

		// Determine primary collision direction
		if (Math.abs(forwardDot) > Math.abs(rightDot)) {
			return forwardDot > 0 ? "front" : "back";
		} else {
			return rightDot > 0 ? "right" : "left";
		}
	}

	updateDamageStatus(direction) {
		// Reset all damage first
		this.resetDamageStatus();

		// Set damage for the collision direction
		this.collisionData.damageStatus[direction] = true;

		// Clear damage after 2 seconds
		setTimeout(() => {
			this.collisionData.damageStatus[direction] = false;
		}, 2000);
	}

	resetDamageStatus() {
		this.collisionData.damageStatus = {
			front: false,
			left: false,
			right: false,
			back: false,
		};
	}

	calculateSlideDirection(originalDirection, blockedPosition) {
		// Try sliding along different axes
		const slideDirections = [
			new THREE.Vector3(originalDirection.x, 0, 0), // Slide along X
			new THREE.Vector3(0, 0, originalDirection.z), // Slide along Z
			new THREE.Vector3(0, originalDirection.y, 0), // Slide along Y
		];

		for (let slideDir of slideDirections) {
			if (slideDir.length() > 0.001) {
				// Avoid zero-length vectors
				slideDir
					.normalize()
					.multiplyScalar(originalDirection.length() * 0.5);
				const testPosition = this.auv.position.clone().add(slideDir);
				if (!this.checkCollision(testPosition)) {
					return slideDir;
				}
			}
		}

		return null; // No valid slide direction found
	}

	checkSearchTargets() {
		if (!this.auv || !this.searchTargets) return;

		const auvPosition = this.auv.position;

		this.searchTargets.forEach((target) => {
			if (!target.userData.found) {
				const distance = auvPosition.distanceTo(target.position);

				// If AUV is close enough to a survivor
				if (distance < 3) {
					target.userData.found = true;

					// Change the material to indicate found
					target.material.color.setHex(0x00ff00); // Green color
					target.material.emissive.setHex(0x004400);
					target.material.emissiveIntensity = 0.3;

					// Make beacon blink faster
					if (target.userData.beacon) {
						target.userData.beacon.material.color.setHex(0x00ff00);
					}

					// Play a sound effect or trigger GUI notification here
					this.onSurvivorFound(target.userData.id);
				}
			}

			// Animate beacon blinking
			if (target.userData.beacon) {
				target.userData.blinkTimer += 0.1;
				const opacity =
					0.5 + Math.sin(target.userData.blinkTimer * 3) * 0.5;
				target.userData.beacon.material.opacity = opacity;
			}
		});
	}

	onSurvivorFound(survivorId) {
		// This method can be expanded to trigger GUI updates, sounds, etc.
		// For now, just log the event
		const foundCount = this.searchTargets.filter(
			(t) => t.userData.found
		).length;
	}

	animateFloatingDebris() {
		// Animate floating debris
		this.scene.children.forEach((child) => {
			if (child.userData && child.userData.type === "floating_debris") {
				// Make debris float up and down
				child.position.y += child.userData.floatSpeed;

				// Reverse direction if too high or low
				if (child.position.y > 2 || child.position.y < -7) {
					child.userData.floatSpeed *= -1;
				}

				// Slowly rotate
				child.rotation.y += 0.005;
			}
		});
	}

	// Public methods for GUI integration
	getPosition() {
		return this.auv ? this.auv.position : new THREE.Vector3();
	}

	getRotation() {
		return this.auv ? this.auv.rotation : new THREE.Euler();
	}

	getSpeed() {
		return this.currentSpeed; // Return calculated speed in knots
	}

	getDepth() {
		return this.auv ? Math.abs(this.auv.position.y) : 0;
	}

	getHeading() {
		return this.currentHeading; // Return compass heading in degrees
	}

	getSearchProgress() {
		if (!this.searchTargets) return { found: 0, total: 0 };
		const found = this.searchTargets.filter((t) => t.userData.found).length;
		return { found, total: this.searchTargets.length };
	}

	getNearestTarget() {
		if (!this.auv || !this.searchTargets) return null;

		let nearest = null;
		let minDistance = Infinity;

		this.searchTargets.forEach((target) => {
			if (!target.userData.found) {
				const distance = this.auv.position.distanceTo(target.position);
				if (distance < minDistance) {
					minDistance = distance;
					nearest = {
						id: target.userData.id,
						distance: distance.toFixed(1),
						position: target.position,
					};
				}
			}
		});

		return nearest;
	}

	getCollisionData() {
		return this.collisionData;
	}

	// Random Events System
	updateRandomEvents() {
		const currentTime = Date.now();

		// Check if an event is currently active
		if (this.randomEvents.active) {
			const event = this.randomEvents.active;
			const eventConfig = this.randomEvents.effects[event.type];

			// Check if event should end
			if (currentTime - event.startTime >= eventConfig.duration) {
				this.endRandomEvent();
			} else {
				this.applyEventEffects(event.type, eventConfig);
			}
		} else {
			// Try to start a new event
			if (
				currentTime - this.randomEvents.lastEventTime >=
				this.randomEvents.eventCooldown
			) {
				// Random chance to start an event (10% chance per second)
				if (Math.random() < 0.002) {
					// Adjusted for 60fps
					this.startRandomEvent();
				}
			}
		}
	}

	startRandomEvent() {
		const eventTypes = this.randomEvents.eventTypes;
		const randomType =
			eventTypes[Math.floor(Math.random() * eventTypes.length)];
		const eventConfig = this.randomEvents.effects[randomType];

		// Reset duration for each event instance
		eventConfig.duration = Math.random() * 30000 + 30000; // 30-60 seconds

		this.randomEvents.active = {
			type: randomType,
			startTime: Date.now(),
			intensity: Math.random() * 0.5 + 0.5, // 0.5 to 1.0 intensity
		};

		// Initialize event-specific effects
		this.initializeEventEffects(randomType);
	}

	initializeEventEffects(eventType) {
		const eventConfig = this.randomEvents.effects[eventType];
		const event = this.randomEvents.active;

		switch (eventType) {
			case "highCurrent":
				// Generate random current direction and strength
				const angle = Math.random() * Math.PI * 2;
				const strength = 0.02 * event.intensity;
				eventConfig.force.set(
					Math.cos(angle) * strength,
					(Math.random() - 0.5) * strength * 0.5,
					Math.sin(angle) * strength
				);
				break;

			case "lowVisibility":
				// Store original fog settings
				eventConfig.originalFog = {
					near: this.scene.fog ? this.scene.fog.near : 1,
					far: this.scene.fog ? this.scene.fog.far : 50,
				};
				break;

			case "equipment_malfunction":
				// Randomly select which system to affect
				const systems = ["sonar", "navigation", "propulsion", "lights"];
				eventConfig.systemAffected =
					systems[Math.floor(Math.random() * systems.length)];
				break;
		}
	}

	applyEventEffects(eventType, eventConfig) {
		const event = this.randomEvents.active;

		switch (eventType) {
			case "highCurrent":
				// Apply current force to AUV movement
				if (this.auv) {
					this.auv.position.add(eventConfig.force);
				}
				break;

			case "lowVisibility":
				// Reduce visibility with fog
				if (this.scene.fog) {
					this.scene.fog.near = 0.5;
					this.scene.fog.far =
						15 * (1 - eventConfig.fogDensity * event.intensity);
				}
				break;

			case "thermalLayer":
				// Add interference to sonar readings
				if (this.sonarSystem.isActive) {
					// Add random noise to sonar detections
					this.addSonarInterference(
						eventConfig.sonarInterference * event.intensity
					);
				}
				break;

			case "magneticInterference":
				// Add error to heading calculations
				this.compassErrorOffset =
					(Math.random() - 0.5) *
					eventConfig.compassError *
					event.intensity;
				break;

			case "equipment_malfunction":
				// Apply system-specific malfunctions
				this.applySystemMalfunction(
					eventConfig.systemAffected,
					event.intensity
				);
				break;

			case "marine_life_interference":
				// Add biological noise to sonar
				if (this.sonarSystem.isActive) {
					this.addBiologicalNoise(
						eventConfig.sonarNoise * event.intensity
					);
				}
				break;

			case "underwater_storm":
				// Apply turbulence to movement
				if (this.auv) {
					const turbulence =
						eventConfig.turbulence * event.intensity * 0.03;
					this.auv.position.x += (Math.random() - 0.5) * turbulence;
					this.auv.position.z += (Math.random() - 0.5) * turbulence;
					this.auv.rotation.y +=
						(Math.random() - 0.5) * turbulence * 0.1;
				}
				break;
		}
	}

	endRandomEvent() {
		if (!this.randomEvents.active) return;

		const eventType = this.randomEvents.active.type;
		const eventConfig = this.randomEvents.effects[eventType];

		// Clean up event effects
		switch (eventType) {
			case "lowVisibility":
				// Restore original fog settings
				if (this.scene.fog && eventConfig.originalFog) {
					this.scene.fog.near = eventConfig.originalFog.near;
					this.scene.fog.far = eventConfig.originalFog.far;
				}
				break;

			case "magneticInterference":
				this.compassErrorOffset = 0;
				break;
		}

		this.randomEvents.lastEventTime = Date.now();
		this.randomEvents.active = null;
	}

	addSonarInterference(intensity) {
		// Add false sonar returns
		if (Math.random() < intensity * 0.1) {
			const angle = Math.random() * Math.PI * 2;
			const distance = Math.random() * 30 + 10;
			const falseReturn = {
				position: new THREE.Vector3(
					Math.cos(angle) * distance,
					this.auv.position.y + (Math.random() - 0.5) * 5,
					Math.sin(angle) * distance
				),
				type: "interference",
				timestamp: Date.now(),
			};
			this.sonarSystem.detectedObjects.push(falseReturn);
		}
	}

	addBiologicalNoise(intensity) {
		// Simulate marine life interference with visual effects
		if (Math.random() < intensity * 0.02) {
			// Create temporary visual marine life objects
			const count = Math.floor(Math.random() * 3) + 1;
			for (let i = 0; i < count; i++) {
				const angle = Math.random() * Math.PI * 2;
				const distance = Math.random() * 30 + 10;

				// Create a temporary marine life object
				const marineLifeGeometry = new THREE.SphereGeometry(0.5, 8, 6);
				const marineLifeMaterial = new THREE.MeshBasicMaterial({
					color: 0x004488,
					transparent: true,
					opacity: 0.6,
				});
				const marineLife = new THREE.Mesh(
					marineLifeGeometry,
					marineLifeMaterial
				);

				marineLife.position.set(
					this.auv.position.x + Math.cos(angle) * distance,
					this.auv.position.y + (Math.random() - 0.5) * 5,
					this.auv.position.z + Math.sin(angle) * distance
				);

				marineLife.userData = {
					type: "marine_life",
					timestamp: Date.now(),
					isTemporary: true,
				};

				this.scene.add(marineLife);

				// Animate and remove after a short time
				const animationDuration = 3000 + Math.random() * 2000; // 3-5 seconds
				const startTime = Date.now();

				const animateMarineLife = () => {
					const elapsed = Date.now() - startTime;
					if (elapsed < animationDuration) {
						// Move the marine life slightly
						marineLife.position.x += (Math.random() - 0.5) * 0.1;
						marineLife.position.z += (Math.random() - 0.5) * 0.1;
						marineLife.rotation.y += 0.02;

						// Fade out in the last second
						if (elapsed > animationDuration - 1000) {
							const fadeProgress =
								(elapsed - (animationDuration - 1000)) / 1000;
							marineLife.material.opacity =
								0.6 * (1 - fadeProgress);
						}

						requestAnimationFrame(animateMarineLife);
					} else {
						// Remove the marine life object
						this.scene.remove(marineLife);
						marineLife.geometry.dispose();
						marineLife.material.dispose();
					}
				};

				animateMarineLife();
			}
		}
	}

	applySystemMalfunction(system, intensity) {
		switch (system) {
			case "sonar":
				// Reduce sonar effectiveness
				if (Math.random() < intensity * 0.02) {
					this.sonarSystem.isActive = false;
					setTimeout(() => {
						this.sonarSystem.isActive = true;
					}, 1000);
				}
				break;

			case "navigation":
				// Add navigation errors
				this.compassErrorOffset =
					(Math.random() - 0.5) * 20 * intensity;
				break;

			case "propulsion":
				// Reduce movement efficiency
				this.speed *= 1 - intensity * 0.3;
				break;

			case "lights":
				// Flicker lighting
				if (Math.random() < intensity * 0.1) {
					this.scene.traverse((object) => {
						if (object.isLight) {
							object.intensity *= 0.5;
							setTimeout(() => {
								object.intensity *= 2;
							}, 200);
						}
					});
				}
				break;
		}
	}

	// Public methods for accessing random events
	getCurrentEvent() {
		return this.randomEvents.active;
	}

	getEventDescription() {
		if (!this.randomEvents.active) return null;
		const eventConfig =
			this.randomEvents.effects[this.randomEvents.active.type];
		return {
			name: eventConfig.name,
			description: eventConfig.description,
			timeRemaining: Math.max(
				0,
				eventConfig.duration -
					(Date.now() - this.randomEvents.active.startTime)
			),
		};
	}

	rescueSurvivor() {
		// Find the first found survivor that hasn't been rescued yet
		const foundSurvivor = this.foundSurvivors.find(
			(survivor) => survivor && !survivor.rescued
		);

		if (foundSurvivor) {
			// Mark as rescued
			foundSurvivor.rescued = true;

			// Add rescue message
			this.rescueMessages.push({
				text: "Survivor location sent to station",
				timestamp: Date.now(),
				duration: 3000, // Show message for 3 seconds
			});

			// Remove from scene
			if (foundSurvivor.object && foundSurvivor.object.parent) {
				foundSurvivor.object.parent.remove(foundSurvivor.object);
			}

			// Remove the beacon if it exists
			if (
				foundSurvivor.object.userData.beacon &&
				foundSurvivor.object.userData.beacon.parent
			) {
				foundSurvivor.object.userData.beacon.parent.remove(
					foundSurvivor.object.userData.beacon
				);
			}

			// Remove from search targets
			this.searchTargets = this.searchTargets.filter(
				(target) => target !== foundSurvivor.object
			);

			// Remove from found survivors list
			this.foundSurvivors = this.foundSurvivors.filter(
				(survivor) => survivor !== foundSurvivor
			);

			// Spawn a new survivor
			this.spawnNewSurvivor();
		}
	}

	spawnNewSurvivor() {
		// Create a new survivor at a random location
		const angle = Math.random() * Math.PI * 2;
		const distance = Math.random() * 80 + 20; // 20-100 units from center
		const x = Math.cos(angle) * distance;
		const z = Math.sin(angle) * distance;
		const y = -8.5; // On the ground, same as original survivors

		// Create survivor body (same as original)
		const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1.5);
		const bodyMaterial = new THREE.MeshLambertMaterial({
			color: 0xff4400, // Bright red-orange for survivors
			emissive: 0x440000, // Red glow to make them visible
			emissiveIntensity: 0.1,
		});
		const survivor = new THREE.Mesh(bodyGeometry, bodyMaterial);

		survivor.position.set(x, y, z);
		survivor.userData = {
			type: "survivor",
			found: false,
			blinkTimer: 0,
		};

		// Add beacon light (same as original)
		const beaconGeometry = new THREE.SphereGeometry(0.1);
		const beaconMaterial = new THREE.MeshBasicMaterial({
			color: 0xff0000,
			transparent: true,
			opacity: 0.8,
		});
		const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
		beacon.position.set(x, y + 1, z);

		// Add to scene and link beacon to survivor
		this.scene.add(survivor);
		this.scene.add(beacon);
		survivor.userData.beacon = beacon;

		// Add to search targets
		this.searchTargets.push(survivor);
	}

	updateFoundSurvivors() {
		// Check for newly found survivors
		this.searchTargets.forEach((target) => {
			if (
				target.userData.type === "survivor" &&
				target.userData.found &&
				!this.foundSurvivors.find((fs) => fs.object === target)
			) {
				this.foundSurvivors.push({
					object: target,
					foundTime: Date.now(),
					rescued: false,
				});
			}
		});

		// Clean up old rescue messages
		this.rescueMessages = this.rescueMessages.filter(
			(msg) => Date.now() - msg.timestamp < msg.duration
		);
	}
}
