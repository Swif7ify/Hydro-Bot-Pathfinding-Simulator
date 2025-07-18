import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

export class AUVLogic {
	constructor(canvas) {
		this.canvas = canvas;
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.auv = null;

		// Movement properties
		this.velocity = new THREE.Vector3();
		this.speed = 0.1;
		this.rotationSpeed = 0.02;

		// Navigation tracking
		this.currentHeading = 0; // Compass heading in degrees (0-360)
		this.currentSpeed = 0; // Speed in knots
		this.lastPosition = new THREE.Vector3(0, 0, 0);
		this.lastUpdateTime = Date.now();
		this.speedSamples = []; // For speed smoothing
		this.maxSpeedSamples = 10;

		// Camera control
		this.isFreeCam = false;
		this.cameraSpeed = 0.2;
		this.mouseSensitivity = 0.002;
		this.isPointerLocked = false;

		// Input state
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

		// Camera offset from AUV (first person view) - positioned in front of AUV
		this.cameraOffset = new THREE.Vector3(0, -10, 0); // Further forward from the AUV

		// Scene constraints
		this.constraints = {
			minY: -15, // Ocean floor
			maxY: 5, // Surface
			boundary: 100, // Horizontal boundary
		};

		console.log("AUV Logic constructor called");
		this.init();
		this.setupEventListeners();
		this.animate();
	}

	init() {
		console.log("Initializing AUV Logic...");

		// Create scene
		this.scene = new THREE.Scene();

		// Create underwater fog effect
		this.scene.fog = new THREE.Fog(0x006994, 1, 50);
		this.scene.background = new THREE.Color(0x004466);

		// Get canvas dimensions
		const rect = this.canvas.getBoundingClientRect();
		const width = rect.width || window.innerWidth;
		const height = rect.height || window.innerHeight;

		console.log("Canvas dimensions:", width, "x", height);

		// Create camera (first person perspective)
		this.camera = new THREE.PerspectiveCamera(
			75,
			width / height,
			0.1,
			1000
		);
		this.camera.position.set(0, 0, 0);

		// Create renderer
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			alpha: false,
		});
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setClearColor(0x004466, 1.0);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		// Force canvas to take full size
		this.canvas.style.width = "100%";
		this.canvas.style.height = "100%";
		this.canvas.style.display = "block";

		console.log("Renderer created");

		// Setup lighting for underwater environment
		this.setupLighting();
		console.log("Lighting setup complete");

		// Create underwater environment
		this.createUnderwaterEnvironment();
		console.log("Environment created");

		// Load AUV model
		this.loadAUVModel();
		console.log("AUV model loading started");

		// Handle window resize
		window.addEventListener("resize", () => this.onWindowResize());

		// Force initial render
		this.renderer.render(this.scene, this.camera);
		console.log("Initial render complete");
	}

	setupLighting() {
		// Ambient light (underwater has diffused light)
		const ambientLight = new THREE.AmbientLight(0x4488bb, 0.4);
		this.scene.add(ambientLight);

		// Directional light (simulating filtered sunlight from above)
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

		// AUV headlights
		this.createAUVLights();
	}

	createAUVLights() {
		// Front headlights
		this.leftHeadlight = new THREE.SpotLight(
			0xffffff,
			1,
			30,
			Math.PI / 4,
			0.1
		);
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

	createUnderwaterEnvironment() {
		// Create ocean floor
		const floorGeometry = new THREE.PlaneGeometry(200, 200);
		const floorMaterial = new THREE.MeshLambertMaterial({
			color: 0x3d5a3d,
			transparent: true,
			opacity: 0.8,
		});
		const floor = new THREE.Mesh(floorGeometry, floorMaterial);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -10;
		floor.receiveShadow = true;
		this.scene.add(floor);

		// Add some underwater rocks/debris
		this.createUnderwaterObjects();

		// Create floating particles (debris/plankton)
		this.createFloatingParticles();
	}

	createUnderwaterObjects() {
		// Create some rocks on the ocean floor
		for (let i = 0; i < 20; i++) {
			const rockGeometry = new THREE.DodecahedronGeometry(
				Math.random() * 0.5 + 0.2
			);
			const rockMaterial = new THREE.MeshLambertMaterial({
				color: new THREE.Color().setHSL(
					0.1,
					0.3,
					Math.random() * 0.3 + 0.2
				),
			});
			const rock = new THREE.Mesh(rockGeometry, rockMaterial);

			rock.position.set(
				(Math.random() - 0.5) * 100,
				-9 + Math.random() * 2,
				(Math.random() - 0.5) * 100
			);
			rock.rotation.set(
				Math.random() * Math.PI,
				Math.random() * Math.PI,
				Math.random() * Math.PI
			);
			rock.castShadow = true;
			rock.receiveShadow = true;
			this.scene.add(rock);
		}

		// Add some kelp-like structures
		for (let i = 0; i < 10; i++) {
			const kelpGeometry = new THREE.CylinderGeometry(0.1, 0.05, 5);
			const kelpMaterial = new THREE.MeshLambertMaterial({
				color: 0x2d4a2d,
				transparent: true,
				opacity: 0.7,
			});
			const kelp = new THREE.Mesh(kelpGeometry, kelpMaterial);

			kelp.position.set(
				(Math.random() - 0.5) * 80,
				-7,
				(Math.random() - 0.5) * 80
			);
			kelp.rotation.z = (Math.random() - 0.5) * 0.3;
			this.scene.add(kelp);
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
		mtlLoader.setPath("./src/assets/model/");

		mtlLoader.load("HydroBot AUV.mtl", (materials) => {
			materials.preload();

			const objLoader = new OBJLoader();
			objLoader.setMaterials(materials);
			objLoader.setPath("./src/assets/model/");

			objLoader.load(
				"HydroBot AUV.obj",
				(object) => {
					// Remove temporary AUV
					if (this.auv) {
						this.scene.remove(this.auv);
					}

					// Setup the loaded AUV
					this.auv = object;
					this.auv.scale.setScalar(0.5); // Adjust scale as needed
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
			console.log("AUV view enabled");
		}
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

		// Apply movement
		this.auv.position.add(direction);

		// Keep AUV above the ocean floor
		this.auv.position.y = Math.max(this.auv.position.y, -8);

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
		const leftPos = new THREE.Vector3(0.2, 0.8, 0.1); // Adjusted for rotated AUV
		const rightPos = new THREE.Vector3(-0.2, 0.8, 0.1); // Adjusted for rotated AUV

		leftPos.applyQuaternion(this.auv.quaternion);
		rightPos.applyQuaternion(this.auv.quaternion);

		leftPos.add(this.auv.position);
		rightPos.add(this.auv.position);

		this.leftHeadlight.position.copy(leftPos);
		this.rightHeadlight.position.copy(rightPos);

		// Point headlights forward - adjusted for rotated AUV
		const targetPos = new THREE.Vector3(0, 5, 0); // Y is forward after rotation
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
	}

	animate() {
		requestAnimationFrame(() => this.animate());

		this.updateMovement();
		this.animateParticles();

		if (this.renderer && this.scene && this.camera) {
			this.renderer.render(this.scene, this.camera);
		}
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
}
