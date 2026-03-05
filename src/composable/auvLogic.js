import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

/**
 * HydroBot Floating Device Simulator
 *
 * Controls (differential thrust):
 *   W = forward  |  S = backward  |  A = turn left  |  D = turn right
 */
export class AUVLogic {
	constructor(canvas) {
		this.canvas = canvas;
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.auv = null;
		this.waterMesh = null;
		this.rippleMesh = null;
		this.robotCamera = null;
		this.thermalCamera = null;
		this.viewMode = "split";
		this.clock = new THREE.Clock();

		// Physics
		this.heading = 0;
		this.linearVelocity = 0;
		this.angularVelocity = 0;
		this.thrustPower = 0.006;
		this.turnPower = 0.004;
		this.linearDamp = 0.94;
		this.angularDamp = 0.88;
		this.poolHalfW = 13;
		this.poolHalfL = 22;

		// Wake particles
		this.wakePositions = null;
		this.wakeLifetimes = null;
		this.wakeCount = 400;
		this.wakeNextSlot = 0;

		this.keys = { w: false, a: false, s: false, d: false };

		// Thermal detection
		this.thermalObjects = [];
		this.menuOpen = false;
		this.onMenuToggle = null;
		this._ambientLight = null;
		this._coldMat = null;
		this._matBackup = null;
		this._thermalGridScene = null;
		this._thermalGridCam = null;

		this.init();
		this.setupEventListeners();
		this.animate();
	}

	// ===================================================================
	//  Init
	// ===================================================================
	init() {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x87ceeb);
		this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

		const rect = this.canvas.getBoundingClientRect();
		const width = rect.width || window.innerWidth;
		const height = rect.height || window.innerHeight;

		this.camera = new THREE.PerspectiveCamera(
			70,
			width / height,
			0.05,
			500,
		);
		this.camera.position.set(0, 2, -4);

		// Front-facing robot camera (wide-angle, fisheye-like)
		this.robotCamera = new THREE.PerspectiveCamera(
			110,
			width / 2 / height,
			0.05,
			500,
		);
		this.robotCamera.position.set(0, 1, 0);

		// Downward-looking thermal camera — beneath waterline, stares at pool floor
		this.thermalCamera = new THREE.PerspectiveCamera(
			90,
			width / 2 / height,
			0.05,
			30,
		);
		this.thermalCamera.position.set(0, -0.05, 0);
		this.thermalCamera.lookAt(0, -6, 0);

		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
		});
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2x for perf
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;

		this.setupLighting();
		this.createPool();
		this.createScenery();
		this.initWakeParticles();
		this.loadRobot();
		this.createUnderwaterObjects();
		this._createThermalGrid();
	}

	// ===================================================================
	//  Lighting
	// ===================================================================
	setupLighting() {
		this._ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
		this.scene.add(this._ambientLight);

		const sun = new THREE.DirectionalLight(0xfff8e7, 1.2);
		sun.position.set(30, 60, 40);
		sun.castShadow = true;
		sun.shadow.mapSize.set(2048, 2048);
		Object.assign(sun.shadow.camera, {
			near: 1,
			far: 200,
			left: -80,
			right: 80,
			top: 80,
			bottom: -80,
		});
		this.scene.add(sun);

		this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x446644, 0.35));

		// Pool glow fill
		const fill = new THREE.PointLight(0x4499ff, 0.9, 50);
		fill.position.set(0, -1, 0);
		this.scene.add(fill);
	}

	// ===================================================================
	//  Procedural tile texture  (cached by key)
	// ===================================================================
	_tileCache = new Map();

	makeTileTexture({
		tileColor = "#dff2ff",
		groutColor = "#aaccdd",
		altColor = "#c8e8f8",
		size = 256,
		tiles = 4,
	} = {}) {
		const key = `${tileColor}|${altColor}|${tiles}`;
		if (this._tileCache.has(key)) return this._tileCache.get(key);
		const c = document.createElement("canvas");
		c.width = c.height = size;
		const ctx = c.getContext("2d");
		const ts = size / tiles;
		for (let r = 0; r < tiles; r++) {
			for (let col = 0; col < tiles; col++) {
				ctx.fillStyle = (r + col) % 2 === 0 ? tileColor : altColor;
				ctx.fillRect(col * ts, r * ts, ts, ts);
				ctx.strokeStyle = groutColor;
				ctx.lineWidth = 3;
				ctx.strokeRect(col * ts + 2, r * ts + 2, ts - 4, ts - 4);
			}
		}
		const tex = new THREE.CanvasTexture(c);
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
		tex.colorSpace = THREE.SRGBColorSpace;
		this._tileCache.set(key, tex);
		return tex;
	}

	tileMat(rx, ry, opts = {}) {
		const tex = this.makeTileTexture(opts);
		tex.repeat.set(rx, ry);
		return new THREE.MeshStandardMaterial({
			map: tex,
			roughness: 0.12,
			metalness: 0.04,
		});
	}

	// Shared material factory (re-use by hex colour key)
	_matCache = new Map();
	mat(color, roughness = 0.7, metalness = 0.05) {
		const key = `${color}_${roughness}_${metalness}`;
		if (this._matCache.has(key)) return this._matCache.get(key);
		const m = new THREE.MeshStandardMaterial({
			color,
			roughness,
			metalness,
		});
		this._matCache.set(key, m);
		return m;
	}

	// ===================================================================
	//  Pool
	// ===================================================================
	createPool() {
		const IW = 28,
			IL = 46,
			DEPTH = 5;
		const WALLH = DEPTH + 0.4;
		const WT = 1.2;
		const wallCY = -DEPTH + WALLH / 2;

		// Tile materials (shared textures)
		const wRep = (len) => len / 2.5;
		const vRep = WALLH / 2.5;
		const wMatNS = this.tileMat(wRep(IW), vRep);
		const wMatEW = this.tileMat(wRep(IL), vRep);
		const flMat = this.tileMat(IW / 2.5, IL / 2.5, {
			tileColor: "#1e6fa0",
			altColor: "#1a5e8e",
			groutColor: "#164d78",
		});

		// Floor
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(IW, IL), flMat);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -DEPTH;
		floor.receiveShadow = true;
		this.scene.add(floor);

		// Walls (4 sides, shared geometry per axis)
		const addBox = (w, h, d, x, y, z, mat) => {
			const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
			m.position.set(x, y, z);
			m.castShadow = m.receiveShadow = true;
			this.scene.add(m);
		};
		addBox(IW + WT * 2, WALLH, WT, 0, wallCY, IL / 2 + WT / 2, wMatNS);
		addBox(IW + WT * 2, WALLH, WT, 0, wallCY, -IL / 2 - WT / 2, wMatNS);
		addBox(WT, WALLH, IL, IW / 2 + WT / 2, wallCY, 0, wMatEW);
		addBox(WT, WALLH, IL, -IW / 2 - WT / 2, wallCY, 0, wMatEW);

		// Concrete deck coping
		const deckMat = this.mat(0xe8dfc8, 0.8);
		const dY = 0.32,
			dH = 0.28,
			dW = 3.5;
		const oHW = IW / 2 + WT,
			oHL = IL / 2 + WT;
		addBox(IW + WT * 2 + dW * 2, dH, dW, 0, dY, oHL + dW / 2, deckMat);
		addBox(IW + WT * 2 + dW * 2, dH, dW, 0, dY, -oHL - dW / 2, deckMat);
		addBox(dW, dH, IL, oHW + dW / 2, dY, 0, deckMat);
		addBox(dW, dH, IL, -(oHW + dW / 2), dY, 0, deckMat);

		// Grass ground — kept at y=-0.1 so it never z-fights with the water surface
		const gnd = new THREE.Mesh(
			new THREE.PlaneGeometry(600, 600),
			this.mat(0x5a8045, 0.95),
		);
		gnd.rotation.x = -Math.PI / 2;
		gnd.position.y = -0.1;
		gnd.receiveShadow = true;
		this.scene.add(gnd);

		// Main water — coarse 16×16 for ambient waves over the whole pool (256 verts)
		const waterGeo = new THREE.PlaneGeometry(IW - 0.12, IL - 0.12, 16, 16);
		const waterMat = new THREE.MeshStandardMaterial({
			color: 0x006994,
			roughness: 0.05,
			metalness: 0.3,
			side: THREE.DoubleSide,
		});
		this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
		this.waterMesh.rotation.x = -Math.PI / 2;
		this.waterMesh.position.y = 0.3;
		this.scene.add(this.waterMesh);

		// Ripple mesh — small 5×5m patch, 24×24 (625 verts), follows the robot every frame
		const rippleGeo = new THREE.PlaneGeometry(5, 5, 24, 24);
		const rippleMat = new THREE.MeshStandardMaterial({
			color: 0x0077aa,
			roughness: 0.04,
			metalness: 0.35,
			transparent: true,
			opacity: 0.92,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		this.rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
		this.rippleMesh.rotation.x = -Math.PI / 2;
		this.rippleMesh.position.y = 0.32; // just above main water
		this.rippleMesh.renderOrder = 2;
		this.scene.add(this.rippleMesh);

		// Lane lines
		this._addLaneLines(IW, IL, DEPTH);

		this.poolHalfW = IW / 2 - 0.7;
		this.poolHalfL = IL / 2 - 0.7;
	}

	_addLaneLines(iW, iL, depth) {
		const lMat = this.mat(0x1155aa, 0.3);
		const tMat = this.mat(0xee3333, 0.3);
		const lanes = 5;
		const sp = iW / lanes;
		for (let i = 1; i < lanes; i++) {
			const m = new THREE.Mesh(
				new THREE.BoxGeometry(0.1, 0.02, iL - 1),
				lMat,
			);
			m.position.set(-iW / 2 + sp * i, -depth + 0.02, 0);
			this.scene.add(m);
		}
		for (const z of [-iL / 2 + 2.5, iL / 2 - 2.5]) {
			const m = new THREE.Mesh(
				new THREE.BoxGeometry(iW - 1, 0.02, 0.15),
				tMat,
			);
			m.position.set(0, -depth + 0.02, z);
			this.scene.add(m);
		}
	}

	// ===================================================================
	//  Richly detailed scenery  all geometry/material reused via helpers
	// ===================================================================
	createScenery() {
		this._addMansion();
		this._addCabana();
		this._addPalms();
		this._addLoungeFurniture();
		this._addPerimeterWall();
		this._addPathway();
	}

	// Helper: add a mesh
	_add(geo, mat, x, y, z, ry = 0) {
		const m = new THREE.Mesh(geo, mat);
		m.position.set(x, y, z);
		if (ry) m.rotation.y = ry;
		m.castShadow = m.receiveShadow = true;
		this.scene.add(m);
		return m;
	}

	// --- Luxury modern mansion (east side) ---
	_addMansion() {
		const MX = 44,
			MZ = 0;
		const wall = this.mat(0xf2ede4, 0.65);
		const roof = this.mat(0x2a2a2a, 0.5, 0.2);
		const glass = this.mat(0x88aacc, 0.05, 0.6);
		const stone = this.mat(0x9e8f7c, 0.85);
		const wood = this.mat(0x6b3a1f, 0.8);
		const door = this.mat(0x1a1a1a, 0.4, 0.4);
		const stucco = this.mat(0xe0d8c8, 0.9);

		const add = (g, m, x, y, z, ry = 0) =>
			this._add(g, m, MX + x, y, MZ + z, ry);

		// Main block
		add(new THREE.BoxGeometry(18, 8, 14), wall, 0, 4, 0);
		// Flat roof overhang
		add(new THREE.BoxGeometry(20, 0.4, 16), roof, 0, 8.25, 0);

		// Floor  polished concrete
		add(
			new THREE.BoxGeometry(18, 0.2, 14),
			this.mat(0xcccccc, 0.2, 0.3),
			0,
			0.1,
			0,
		);

		// Large glass facade panels (front = -Z face)
		for (const [ox, oy] of [
			[-5, 5],
			[0, 5],
			[5, 5],
			[-5, 2],
			[5, 2],
		]) {
			add(new THREE.BoxGeometry(3.5, 2.5, 0.08), glass, ox, oy, -7.05);
		}

		// Side wing extension
		add(new THREE.BoxGeometry(8, 5, 10), wall, 12, 2.5, 0);
		add(new THREE.BoxGeometry(9, 0.4, 11), roof, 12, 5.25, 0);

		// Entry portico columns (front, -Z)
		const colGeo = new THREE.CylinderGeometry(0.18, 0.22, 4, 12);
		const colMat = this.mat(0xffffff, 0.4);
		for (const ox of [-3.5, -1.2, 1.2, 3.5]) {
			add(colGeo, colMat, ox, 2, -7.6);
		}
		// Portico ceiling slab
		add(new THREE.BoxGeometry(9.5, 0.3, 1.5), roof, 0, 4.1, -7.7);

		// Front door
		add(new THREE.BoxGeometry(2.2, 3.5, 0.12), door, 0, 1.75, -7.06);

		// Chimney
		add(new THREE.BoxGeometry(1.0, 4, 1.0), stone, 6, 10, 3);
		add(new THREE.BoxGeometry(1.3, 0.2, 1.3), stone, 6, 12.1, 3);

		// Garage block (south side)
		add(new THREE.BoxGeometry(8, 4.5, 8), stucco, -14, 2.25, -6);
		add(new THREE.BoxGeometry(8.2, 0.35, 8.2), roof, -14, 4.7, -6);
		// Garage doors (double)
		add(
			new THREE.BoxGeometry(3.2, 2.8, 0.15),
			this.mat(0x8899aa, 0.3, 0.5),
			-16,
			1.4,
			-10.05,
		);
		add(
			new THREE.BoxGeometry(3.2, 2.8, 0.15),
			this.mat(0x8899aa, 0.3, 0.5),
			-12,
			1.4,
			-10.05,
		);

		// Pool-facing balcony at y=8
		add(
			new THREE.BoxGeometry(14, 0.25, 3),
			this.mat(0xdddddd, 0.3, 0.3),
			0,
			8.15,
			-9.5,
		);
		// Railings
		for (let i = -6; i <= 6; i += 2) {
			add(
				new THREE.BoxGeometry(0.08, 1.0, 0.08),
				this.mat(0xffffff, 0.3),
				i,
				8.65,
				-10.9,
			);
		}
		add(
			new THREE.BoxGeometry(14, 0.08, 0.08),
			this.mat(0xffffff, 0.3),
			0,
			9.2,
			-10.9,
		);

		// Decorative hedges beside house
		const hedgeMat = this.mat(0x2d6a2d, 0.9);
		for (const [ox, oz] of [
			[-9, -7],
			[-9, 0],
			[-9, 7],
			[9, -7],
			[9, 7],
		]) {
			add(new THREE.BoxGeometry(1.5, 2.5, 1.5), hedgeMat, ox, 1.25, oz);
		}

		// Outdoor security light pillars
		const lpillar = this.mat(0x888888, 0.5, 0.5);
		for (const [ox, oz] of [
			[-9, -11],
			[9, -11],
			[-9, 11],
		]) {
			add(
				new THREE.CylinderGeometry(0.1, 0.12, 3.5, 8),
				lpillar,
				ox,
				1.75,
				oz,
			);
			add(
				new THREE.SphereGeometry(0.2, 8, 8),
				this.mat(0xffffaa, 0.1, 0.5),
				ox,
				3.7,
				oz,
			);
			const pl = new THREE.PointLight(0xffffcc, 0.6, 12);
			pl.position.set(MX + ox, 3.6, MZ + oz);
			this.scene.add(pl);
		}
	}

	// --- Pool cabana / guest house (west side) ---
	_addCabana() {
		const CX = -44,
			CZ = -10;
		const add = (g, m, x, y, z) => this._add(g, m, CX + x, y, CZ + z);
		const wall = this.mat(0xffffff, 0.6);
		const thatch = this.mat(0xb89a50, 0.95);
		const wood = this.mat(0x7a4f2e, 0.85);

		// Cabana body
		add(new THREE.BoxGeometry(10, 4, 6), wall, 0, 2, 0);
		// Thatched hip roof (approximated with two crossing slabs + cone)
		add(new THREE.ConeGeometry(7, 3, 4), thatch, 0, 5.5, 0, Math.PI / 4);

		// Open front archway
		add(new THREE.BoxGeometry(10, 0.3, 0.2), wall, 0, 4.15, -3);
		// Columns
		for (const ox of [-4, 4]) {
			add(
				new THREE.CylinderGeometry(0.12, 0.15, 4, 10),
				this.mat(0xeeeeee, 0.5),
				ox,
				2,
				-3.1,
			);
		}

		// Bar counter inside
		add(new THREE.BoxGeometry(6, 1, 1), this.mat(0x8b5e3c, 0.7), 0, 0.5, 0);
		add(
			new THREE.BoxGeometry(6.2, 0.1, 1.2),
			this.mat(0xcccccc, 0.15, 0.4),
			0,
			1.05,
			0,
		);

		// Shade pergola extending toward pool
		const beamMat = wood;
		for (const ox of [-4, -1, 2]) {
			add(new THREE.BoxGeometry(0.15, 0.15, 8), beamMat, ox, 4.1, 6);
		}
		for (const oz of [2, 4, 6, 8]) {
			add(new THREE.BoxGeometry(9, 0.15, 0.15), beamMat, 0, 4.1, oz);
		}

		// Outdoor shower post
		add(
			new THREE.CylinderGeometry(0.06, 0.06, 3, 8),
			this.mat(0x888888, 0.3, 0.8),
			6,
			1.5,
			5,
		);
	}

	// --- Instanced palm trees ---
	_addPalms() {
		const POSITIONS = [
			[-22, 0, 28],
			[-22, 0, -28],
			[22, 0, 28],
			[22, 0, -28],
			[0, 0, 35],
			[0, 0, -35],
			[-30, 0, 10],
			[30, 0, 10],
			[-50, 0, 15],
			[50, 0, 15],
			[-50, 0, -15],
			[50, 0, -15],
			[-38, 0, 30],
			[38, 0, 30],
		];
		const N = POSITIONS.length;

		// Trunk (instanced)
		const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 7, 8);
		const trunkMat = this.mat(0x7a5c3a, 0.9);
		const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
		trunks.castShadow = true;

		// Fronds (instanced cone)
		const frondGeo = new THREE.ConeGeometry(2.8, 2.2, 6);
		const frondMat = this.mat(0x2d7a2d, 0.85);
		const fronds = new THREE.InstancedMesh(frondGeo, frondMat, N);
		fronds.castShadow = true;

		const dummy = new THREE.Object3D();
		POSITIONS.forEach(([x, , z], i) => {
			dummy.position.set(x, 3.5, z);
			dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
			dummy.scale.setScalar(0.9 + Math.random() * 0.25);
			dummy.updateMatrix();
			trunks.setMatrixAt(i, dummy.matrix);

			dummy.position.set(x, 7.4 + Math.random() * 0.5, z);
			dummy.updateMatrix();
			fronds.setMatrixAt(i, dummy.matrix);
		});
		trunks.instanceMatrix.needsUpdate = true;
		fronds.instanceMatrix.needsUpdate = true;
		this.scene.add(trunks, fronds);
	}

	// --- Lounge chairs + umbrellas (instanced) ---
	_addLoungeFurniture() {
		// Lounge chair positions (poolside)
		const CHAIRS = [
			[-20, 0, -18],
			[-20, 0, -14],
			[-20, 0, -10],
			[-20, 0, 10],
			[-20, 0, 14],
			[-20, 0, 18],
			[20, 0, -18],
			[20, 0, -8],
			[20, 0, 8],
			[20, 0, 18],
		];
		const N = CHAIRS.length;
		const cMat = this.mat(0x4488cc, 0.6);
		const legM = this.mat(0xaaaaaa, 0.3, 0.7);
		const uMat = this.mat(0xffdd55, 0.8);
		const uPole = this.mat(0xffffff, 0.4);

		const bodyGeo = new THREE.BoxGeometry(0.75, 0.12, 2.2);
		const legGeo = new THREE.BoxGeometry(0.06, 0.55, 0.06);
		const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8);
		const umbrGeo = new THREE.ConeGeometry(1.4, 0.9, 8);

		const bodies = new THREE.InstancedMesh(bodyGeo, cMat, N);
		const poles = new THREE.InstancedMesh(poleGeo, uPole, N);
		const umbrellas = new THREE.InstancedMesh(umbrGeo, uMat, N);

		const dummy = new THREE.Object3D();
		CHAIRS.forEach(([x, , z], i) => {
			const ry = x < 0 ? 0 : Math.PI;
			dummy.position.set(x, 0.36, z);
			dummy.rotation.set(0, ry, 0);
			dummy.scale.set(1, 1, 1);
			dummy.updateMatrix();
			bodies.setMatrixAt(i, dummy.matrix);

			dummy.position.set(x + (x < 0 ? -0.8 : 0.8), 1.25, z);
			dummy.rotation.set(0, 0, 0);
			dummy.scale.set(1, 1, 1);
			dummy.updateMatrix();
			poles.setMatrixAt(i, dummy.matrix);

			dummy.position.set(x + (x < 0 ? -0.8 : 0.8), 2.75, z);
			dummy.updateMatrix();
			umbrellas.setMatrixAt(i, dummy.matrix);

			// Legs (non-instanced, 4 per chair  acceptable for small count)
			for (const [lx, lz] of [
				[-0.3, -0.9],
				[0.3, -0.9],
				[-0.3, 0.9],
				[0.3, 0.9],
			]) {
				const leg = new THREE.Mesh(legGeo, legM);
				leg.position.set(x + lx, 0.08, z + lz);
				this.scene.add(leg);
			}
		});
		bodies.instanceMatrix.needsUpdate = true;
		poles.instanceMatrix.needsUpdate = true;
		umbrellas.instanceMatrix.needsUpdate = true;
		this.scene.add(bodies, poles, umbrellas);
	}

	// --- Security perimeter wall with stone pillars ---
	_addPerimeterWall() {
		const WALL_H = 2.2;
		const WALL_T = 0.4;
		const PILLAR_H = WALL_H + 0.5;
		const PILLAR_S = 0.55;
		const R = 70; // perimeter radius (rough square)

		const wallMat = this.mat(0xd4c9b0, 0.85);
		const pillarMat = this.mat(0xb5a898, 0.7, 0.1);
		const capMat = this.mat(0x8a7a6a, 0.5, 0.15);

		// Four wall segments
		const segs = [
			{ w: R * 2, d: WALL_T, x: 0, z: R },
			{ w: R * 2, d: WALL_T, x: 0, z: -R },
			{ w: WALL_T, d: R * 2, x: R, z: 0 },
			{ w: WALL_T, d: R * 2, x: -R, z: 0 },
		];
		for (const s of segs) {
			const m = new THREE.Mesh(
				new THREE.BoxGeometry(s.w, WALL_H, s.d),
				wallMat,
			);
			m.position.set(s.x, WALL_H / 2, s.z);
			m.receiveShadow = true;
			this.scene.add(m);
		}

		// Instanced pillars along perimeter
		const spacing = 8;
		const pillarPositions = [];
		for (let p = -R; p <= R; p += spacing) {
			pillarPositions.push([p, R], [p, -R], [R, p], [-R, p]);
		}
		const N = pillarPositions.length;
		const pGeo = new THREE.BoxGeometry(PILLAR_S, PILLAR_H, PILLAR_S);
		const cGeo = new THREE.BoxGeometry(
			PILLAR_S + 0.15,
			0.18,
			PILLAR_S + 0.15,
		);
		const pillars = new THREE.InstancedMesh(pGeo, pillarMat, N);
		const caps = new THREE.InstancedMesh(cGeo, capMat, N);
		const dummy = new THREE.Object3D();
		pillarPositions.forEach(([x, z], i) => {
			dummy.position.set(x, PILLAR_H / 2, z);
			dummy.rotation.set(0, 0, 0);
			dummy.scale.set(1, 1, 1);
			dummy.updateMatrix();
			pillars.setMatrixAt(i, dummy.matrix);
			dummy.position.set(x, PILLAR_H + 0.09, z);
			dummy.updateMatrix();
			caps.setMatrixAt(i, dummy.matrix);
		});
		pillars.instanceMatrix.needsUpdate = true;
		caps.instanceMatrix.needsUpdate = true;
		pillars.castShadow = caps.castShadow = true;
		this.scene.add(pillars, caps);

		// Main entrance gate (south gap)
		const gateM = this.mat(0x333333, 0.3, 0.8);
		for (const gx of [-3, 3]) {
			// Gate pillar
			this._add(
				new THREE.BoxGeometry(1, PILLAR_H + 1, 1),
				pillarMat,
				gx,
				(PILLAR_H + 1) / 2,
				-R,
			);
			// Cap ball
			this._add(
				new THREE.SphereGeometry(0.4, 10, 8),
				capMat,
				gx,
				PILLAR_H + 1.4,
				-R,
			);
		}
		// Gate bars (decorative)
		for (let gx = -2.5; gx <= 2.5; gx += 0.7) {
			this._add(
				new THREE.BoxGeometry(0.08, WALL_H + 0.4, 0.08),
				gateM,
				gx,
				(WALL_H + 0.4) / 2,
				-R,
			);
		}
	}

	// --- Stone path from gate to house ---
	_addPathway() {
		const pkMat = this.mat(0xbbb0a0, 0.85);
		const R = 70; // match perimeter radius
		// Stop at z=-30: pool edge is at z≈-23, deck extends to z≈-27.7
		for (let z = -R + 1; z < -30; z += 2.2) {
			const jitter = (Math.random() - 0.5) * 0.4;
			this._add(
				new THREE.BoxGeometry(3.5, 0.08, 2),
				pkMat,
				jitter,
				0.04,
				z,
			);
		}
	}

	// ===================================================================
	//  Wake / water particles
	// ===================================================================
	initWakeParticles() {
		const N = this.wakeCount;
		const pos = new Float32Array(N * 3);
		const alpha = new Float32Array(N);
		for (let i = 0; i < N; i++) {
			pos[i * 3 + 1] = -100;
			alpha[i] = 0;
		}

		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

		const mat = new THREE.PointsMaterial({
			color: 0xffffff,
			size: 0.18,
			transparent: true,
			opacity: 0.65,
			depthWrite: false,
			sizeAttenuation: true,
		});
		this.wakeParticles = new THREE.Points(geo, mat);
		this.wakeParticles.renderOrder = 3;
		this.scene.add(this.wakeParticles);

		this.wakePositions = pos;
		this.wakeLifetimes = alpha;
	}

	updateWakeParticles() {
		if (!this.auv || !this.wakeParticles) return;

		const speed = Math.abs(this.linearVelocity);
		const spin = Math.abs(this.angularVelocity);
		const active = speed > 0.0005 || spin > 0.001;

		if (active) {
			// Emit several particles per frame proportional to speed
			const emit = Math.ceil((speed + spin * 0.5) * 400);
			for (let e = 0; e < emit; e++) {
				const idx = this.wakeNextSlot % this.wakeCount;
				this.wakeNextSlot++;

				const behind = Math.random() * 1.2;
				const spread = (Math.random() - 0.5) * 0.9;
				const sh = Math.sin(this.heading),
					ch = Math.cos(this.heading);

				this.wakePositions[idx * 3 + 0] =
					this.auv.position.x - sh * behind - ch * spread;
				this.wakePositions[idx * 3 + 1] = 0.06 + Math.random() * 0.1;
				this.wakePositions[idx * 3 + 2] =
					this.auv.position.z - ch * behind + sh * spread;
				this.wakeLifetimes[idx] = 1.0;
			}
		}

		// Age all particles
		for (let i = 0; i < this.wakeCount; i++) {
			if (this.wakeLifetimes[i] > 0) {
				this.wakeLifetimes[i] -= 0.014;
				if (this.wakeLifetimes[i] <= 0) {
					this.wakePositions[i * 3 + 1] = -100;
					this.wakeLifetimes[i] = 0;
				} else {
					// Drift particles outward slightly
					this.wakePositions[i * 3 + 1] += 0.002;
				}
			}
		}
		this.wakeParticles.geometry.attributes.position.needsUpdate = true;
	}

	// ===================================================================
	//  Animated water surface
	// ===================================================================
	updateWater(t) {
		if (!this.waterMesh) return;

		// ── Pass 1: Ambient waves on the coarse full-pool mesh (16×16 = 256 verts) ──
		const pos = this.waterMesh.geometry.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const wx = pos.getX(i);
			const wz = -pos.getY(i);
			const wave =
				Math.sin(wx * 0.35 + t * 1.5) * 0.045 +
				Math.sin(wz * 0.28 + t * 1.1) * 0.038 +
				Math.sin((wx + wz) * 0.22 + t * 0.9) * 0.022;
			pos.setZ(i, wave);
		}
		pos.needsUpdate = true;
		this.waterMesh.geometry.computeVertexNormals();

		// ── Pass 2: Robot ripple on the small trailing mesh (24×24 = 625 verts) ──
		if (!this.rippleMesh || !this.auv) return;

		// Move ripple patch to robot
		this.rippleMesh.position.x = this.auv.position.x;
		this.rippleMesh.position.z = this.auv.position.z;

		const rSpeed =
			Math.abs(this.linearVelocity) +
			Math.abs(this.angularVelocity) * 0.5;

		const rpos = this.rippleMesh.geometry.attributes.position;
		for (let i = 0; i < rpos.count; i++) {
			// Local coords of ripple mesh (centred on robot)
			const lx = rpos.getX(i);
			const lz = -rpos.getY(i);
			const dist = Math.sqrt(lx * lx + lz * lz) + 0.001;

			// Ambient component (keeps the patch matching main water visually)
			const wx = lx + this.auv.position.x;
			const wz = lz + this.auv.position.z;
			const ambient =
				Math.sin(wx * 0.35 + t * 1.5) * 0.045 +
				Math.sin(wz * 0.28 + t * 1.1) * 0.038 +
				Math.sin((wx + wz) * 0.22 + t * 0.9) * 0.022;

			// Ripple ring — only computed when moving
			const ripple =
				rSpeed > 0.0002
					? Math.exp(-dist * 0.35) *
						rSpeed *
						40 *
						Math.sin(dist * 3.0 - t * 6) *
						0.055
					: 0;

			rpos.setZ(i, ambient + ripple);
		}
		rpos.needsUpdate = true;
		this.rippleMesh.geometry.computeVertexNormals();
	}

	// ===================================================================
	//  Robot
	// ===================================================================
	loadRobot() {
		this.buildPlaceholder();
	}

	// ===================================================================
	//  Underwater thermal objects
	// ===================================================================
	createUnderwaterObjects() {
		const FY = -4.8; // just above pool floor (floor at y=-5)
		const defs = [
			{
				label: "HOT VENT",
				tempC: 89,
				heat: 0.92,
				geo: new THREE.CylinderGeometry(0.5, 0.6, 0.4, 12),
				normal: 0x444444,
				x: 3,
				z: 5,
			},
			{
				label: "BIO MASS",
				tempC: 34,
				heat: 0.52,
				geo: new THREE.SphereGeometry(0.55, 10, 8),
				normal: 0x1a3a10,
				x: -5,
				z: -8,
			},
			{
				label: "CHEM DRUM",
				tempC: 61,
				heat: 0.73,
				geo: new THREE.CylinderGeometry(0.35, 0.35, 0.9, 14),
				normal: 0x6b3010,
				x: 7,
				z: -4,
			},
			{
				label: "METAL PLATE",
				tempC: 12,
				heat: 0.1,
				geo: new THREE.BoxGeometry(1.4, 0.1, 1.4),
				normal: 0x8a8a8a,
				x: -3,
				z: 12,
			},
			{
				label: "WARM PIPE",
				tempC: 54,
				heat: 0.65,
				geo: new THREE.CylinderGeometry(0.15, 0.15, 2.4, 10),
				normal: 0x555555,
				x: 0,
				z: -16,
			},
			{
				label: "COOL ROCK",
				tempC: 18,
				heat: 0.22,
				geo: new THREE.DodecahedronGeometry(0.45, 0),
				normal: 0x5a4a3a,
				x: -8,
				z: 3,
			},
		];

		for (const d of defs) {
			const normalMat = new THREE.MeshStandardMaterial({
				color: d.normal,
				roughness: 0.8,
				metalness: 0.3,
			});
			const tc = this._heatColor(d.heat);
			const thermalMat = new THREE.MeshStandardMaterial({
				color: tc,
				emissive: tc,
				emissiveIntensity: 0.9 + d.heat * 0.8,
				roughness: 0.1,
				metalness: 0.0,
			});
			const mesh = new THREE.Mesh(d.geo, normalMat);
			mesh.position.set(d.x, FY, d.z);
			if (d.label === "WARM PIPE") mesh.rotation.z = Math.PI / 2;
			mesh.castShadow = mesh.receiveShadow = true;
			this.scene.add(mesh);
			this.thermalObjects.push({
				mesh,
				normalMat,
				thermalMat,
				heat: d.heat,
				label: d.label,
				tempC: d.tempC,
			});
		}
	}

	_heatColor(h) {
		const stops = [
			[0.0, new THREE.Color(0x000011)],
			[0.2, new THREE.Color(0x1a0066)],
			[0.35, new THREE.Color(0x0055cc)],
			[0.5, new THREE.Color(0x00ccaa)],
			[0.62, new THREE.Color(0x00ff44)],
			[0.72, new THREE.Color(0xddff00)],
			[0.82, new THREE.Color(0xff8800)],
			[0.9, new THREE.Color(0xff2200)],
			[1.0, new THREE.Color(0xffffff)],
		];
		for (let i = 0; i < stops.length - 1; i++) {
			const [t0, c0] = stops[i],
				[t1, c1] = stops[i + 1];
			if (h >= t0 && h <= t1)
				return c0.clone().lerp(c1, (h - t0) / (t1 - t0));
		}
		return new THREE.Color(0xffffff);
	}

	_enterThermalRender() {
		this._savedBg = this.scene.background;
		this._savedFog = this.scene.fog;
		this._savedAmbient = this._ambientLight
			? this._ambientLight.intensity
			: 0.5;

		// Swap every non-thermal mesh to the flat cold material
		this._matBackup = new Map();
		const hotSet = new Set(this.thermalObjects.map((o) => o.mesh));
		this.scene.traverse((obj) => {
			if (!obj.isMesh || hotSet.has(obj)) return;
			this._matBackup.set(obj, obj.material);
			obj.material = this._coldMat;
		});

		// Thermal objects → grid-silhouette heat materials
		for (const o of this.thermalObjects) o.mesh.material = o.thermalMat;

		this.scene.background = new THREE.Color(0x000c18);
		this.scene.fog = null;
		if (this._ambientLight) this._ambientLight.intensity = 0.06;
		if (this.waterMesh) this.waterMesh.visible = true;
		if (this.rippleMesh) this.rippleMesh.visible = true;
	}

	_exitThermalRender() {
		this.scene.background = this._savedBg;
		this.scene.fog = this._savedFog;
		if (this._ambientLight)
			this._ambientLight.intensity = this._savedAmbient;
		if (this._matBackup) {
			this._matBackup.forEach((mat, mesh) => {
				mesh.material = mat;
			});
			this._matBackup = null;
		}
	}

	_createThermalGrid() {
		// ── Grid emissive map for thermal object silhouettes ──────────────
		// White lines on black canvas: emissiveMap × emissive heat color
		// → only grid lines glow, between-line areas are pitch black
		const gS = 256,
			gC = 22;
		const gcv = document.createElement("canvas");
		gcv.width = gcv.height = gS;
		const gctx = gcv.getContext("2d");
		gctx.fillStyle = "#000";
		gctx.fillRect(0, 0, gS, gS);
		gctx.strokeStyle = "#ffffff";
		gctx.lineWidth = 1.8;
		for (let x = 0; x <= gS; x += gC) {
			gctx.beginPath();
			gctx.moveTo(x, 0);
			gctx.lineTo(x, gS);
			gctx.stroke();
		}
		for (let y = 0; y <= gS; y += gC) {
			gctx.beginPath();
			gctx.moveTo(0, y);
			gctx.lineTo(gS, y);
			gctx.stroke();
		}
		const gridTex = new THREE.CanvasTexture(gcv);
		gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
		gridTex.repeat.set(4, 4);

		// Patch every thermalMat: fill → black, only grid lines emit heat color
		for (const o of this.thermalObjects) {
			o.thermalMat.color.set(0x000000);
			o.thermalMat.emissiveMap = gridTex;
			o.thermalMat.emissiveIntensity = 1.8 + o.heat * 1.2;
			o.thermalMat.needsUpdate = true;
		}

		// ── Fullscreen scan-line overlay rendered additively on top ───────
		const S = 512,
			C = 20;
		const cv = document.createElement("canvas");
		cv.width = cv.height = S;
		const ctx = cv.getContext("2d");
		ctx.clearRect(0, 0, S, S);
		ctx.strokeStyle = "rgba(0,230,200,0.15)";
		ctx.lineWidth = 0.6;
		for (let x = 0; x <= S; x += C) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, S);
			ctx.stroke();
		}
		for (let y = 0; y <= S; y += C) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(S, y);
			ctx.stroke();
		}
		const scanTex = new THREE.CanvasTexture(cv);
		scanTex.wrapS = scanTex.wrapT = THREE.RepeatWrapping;
		scanTex.repeat.set(5, 5);

		this._thermalGridScene = new THREE.Scene();
		this._thermalGridCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		const overlayMat = new THREE.MeshBasicMaterial({
			map: scanTex,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: false,
		});
		this._thermalGridScene.add(
			new THREE.Mesh(new THREE.PlaneGeometry(2, 2), overlayMat),
		);

		// Flat cold material for all non-thermal scene meshes
		this._coldMat = new THREE.MeshBasicMaterial({ color: 0x001a20 });
	}

	buildPlaceholder() {
		const g = new THREE.Group();

		const whiteMat = this.mat(0xf0f0f0, 0.25, 0.04);
		const blackMat = this.mat(0x111111, 0.75, 0.1);
		const greenMat = this.mat(0x2e8b2e, 0.4, 0.05);
		const darkMat = this.mat(0x223344, 0.2, 0.45);

		// ── Pontoons: green bottle cylinders, one each side ──────────────
		const pontoonGeo = new THREE.CylinderGeometry(0.14, 0.13, 1.15, 14);
		for (const sx of [-0.78, 0.78]) {
			const p = new THREE.Mesh(pontoonGeo, greenMat);
			p.rotation.x = Math.PI / 2;
			p.position.set(sx, -0.04, 0);
			p.castShadow = true;
			g.add(p);
			// White bottle caps at front and back
			const capGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.08, 10);
			for (const ez of [-0.6, 0.6]) {
				const cap = new THREE.Mesh(capGeo, whiteMat);
				cap.rotation.x = Math.PI / 2;
				cap.position.set(sx, -0.04, ez);
				g.add(cap);
			}
		}

		// ── U-frame brackets: 2 per side (front & back) ─────────────────
		// Each bracket is a ⊓ shape: top crossbar + two vertical legs
		const bW = 0.4; // crossbar width along X (box edge → pontoon)
		const bH = 0.24; // leg height
		const bT = 0.07; // bar thickness
		const bTopY = 0.14; // top-bar world-Y in group space

		for (const sx of [-0.78, 0.78]) {
			const sign = sx < 0 ? -1 : 1;
			const innerX = sign * 0.32; // where box wall is
			const outerX = sx; // where pontoon center is
			const midX = (innerX + outerX) / 2;

			for (const bz of [-0.33, 0.33]) {
				// Top crossbar
				const bar = new THREE.Mesh(
					new THREE.BoxGeometry(bW, bT, bT),
					blackMat,
				);
				bar.position.set(midX, bTopY, bz);
				g.add(bar);
				// Inner leg (near box)
				const legI = new THREE.Mesh(
					new THREE.BoxGeometry(bT, bH, bT),
					blackMat,
				);
				legI.position.set(innerX, bTopY - bH / 2, bz);
				g.add(legI);
				// Outer leg (at pontoon)
				const legO = new THREE.Mesh(
					new THREE.BoxGeometry(bT, bH, bT),
					blackMat,
				);
				legO.position.set(outerX, bTopY - bH / 2, bz);
				g.add(legO);
			}
		}

		// ── Main body box (white electronics enclosure) ──────────────────
		const box = new THREE.Mesh(
			new THREE.BoxGeometry(0.64, 0.34, 0.56),
			whiteMat,
		);
		box.position.set(0, 0.26, 0);
		box.castShadow = true;
		g.add(box);

		// Lid seam — thin dark strip around box equator
		const seam = new THREE.Mesh(
			new THREE.BoxGeometry(0.662, 0.022, 0.572),
			darkMat,
		);
		seam.position.set(0, 0.26, 0);
		g.add(seam);

		// ── Front sensor port (dark circle on front face) ────────────────
		const sensor = new THREE.Mesh(
			new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12),
			darkMat,
		);
		sensor.rotation.x = Math.PI / 2;
		sensor.position.set(0, 0.24, 0.29);
		g.add(sensor);

		// ── Antenna ──────────────────────────────────────────────────────
		const antBase = new THREE.Mesh(
			new THREE.CylinderGeometry(0.042, 0.042, 0.055, 8),
			darkMat,
		);
		antBase.position.set(0.04, 0.26 + 0.17 + 0.028, 0.06);
		g.add(antBase);

		const antRod = new THREE.Mesh(
			new THREE.CylinderGeometry(0.016, 0.013, 0.6, 7),
			blackMat,
		);
		antRod.position.set(0.04, 0.26 + 0.17 + 0.055 + 0.3, 0.06);
		g.add(antRod);

		// ── Thrusters at rear of each pontoon ────────────────────────────
		const propGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10);
		this.lProp = new THREE.Mesh(propGeo, blackMat);
		this.lProp.rotation.x = Math.PI / 2;
		this.lProp.position.set(-0.78, -0.04, -0.62);
		g.add(this.lProp);

		this.rProp = new THREE.Mesh(propGeo, blackMat);
		this.rProp.rotation.x = Math.PI / 2;
		this.rProp.position.set(0.78, -0.04, -0.62);
		g.add(this.rProp);

		this.auv = g;
		this.scene.add(this.auv);
	}

	// ===================================================================
	//  Input
	// ===================================================================
	setupEventListeners() {
		this._kd = (e) => {
			const k = e.key.toLowerCase();
			if (k in this.keys) {
				e.preventDefault();
				this.keys[k] = true;
			}
		};
		this._ku = (e) => {
			const k = e.key.toLowerCase();
			if (k in this.keys) {
				e.preventDefault();
				this.keys[k] = false;
			}
		};
		this._resize = () => {
			const r = this.canvas.getBoundingClientRect();
			const w = r.width || window.innerWidth;
			const h = r.height || window.innerHeight;
			if (this.viewMode === "split") {
				this.camera.aspect = w / 2 / h;
				this.robotCamera.aspect = w / 2 / h;
				this.thermalCamera.aspect = w / 2 / h;
			} else {
				this.camera.aspect = w / h;
				this.robotCamera.aspect = w / h;
				this.thermalCamera.aspect = w / h;
			}
			this.camera.updateProjectionMatrix();
			this.robotCamera.updateProjectionMatrix();
			this.thermalCamera.updateProjectionMatrix();
			this.renderer.setSize(w, h);
		};
		window.addEventListener("keydown", this._kd);
		window.addEventListener("keyup", this._ku);
		window.addEventListener("resize", this._resize);

		// ESC — menu toggle
		this._escKd = (e) => {
			if (e.key === "Escape") {
				e.preventDefault();
				this.menuOpen = !this.menuOpen;
				if (this.onMenuToggle) this.onMenuToggle(this.menuOpen);
			}
		};
		window.addEventListener("keydown", this._escKd);
	}

	// ===================================================================
	//  Public API (called by Vue HUD)
	// ===================================================================
	setMode(mode) {
		this.viewMode = mode;
		// Re-trigger resize so aspect ratios update immediately
		this._resize();
	}

	dpadInput(key, pressed) {
		if (key in this.keys) this.keys[key] = pressed;
	}

	getStats() {
		const speed =
			Math.abs(this.linearVelocity) +
			Math.abs(this.angularVelocity) * 0.5;
		// Simulate realistic fluctuating values
		const ping = Math.round(12 + Math.random() * 6 + speed * 200);
		const cpuTemp = +(55 + speed * 800 + Math.random() * 1.5).toFixed(1);
		const bars = speed > 0.008 ? 3 : speed > 0.002 ? 2 : 3;
		const signalLabel =
			bars === 3 ? "STRONG" : bars === 2 ? "FAIR" : "STRONG";
		return { ping, cpuTemp, signalLabel, bars };
	}

	getHotTarget() {
		if (!this.thermalCamera || !this.thermalObjects.length) return null;
		const frustum = new THREE.Frustum();
		const projMat = new THREE.Matrix4().multiplyMatrices(
			this.thermalCamera.projectionMatrix,
			this.thermalCamera.matrixWorldInverse,
		);
		frustum.setFromProjectionMatrix(projMat);
		let best = null;
		const wp = new THREE.Vector3();
		for (const o of this.thermalObjects) {
			o.mesh.getWorldPosition(wp);
			if (!frustum.containsPoint(wp)) continue;
			if (!best || o.heat > best.heat) best = { ...o, _wp: wp.clone() };
		}
		if (!best) return null;
		const ndc = best._wp.clone().project(this.thermalCamera);
		return {
			vx: (ndc.x + 1) / 2,
			vy: 1 - (ndc.y + 1) / 2,
			heat: best.heat,
			label: best.label,
			tempC: best.tempC,
		};
	}

	setPaused(v) {
		this.menuOpen = v;
	}
	isMenuOpen() {
		return this.menuOpen;
	}

	// ===================================================================
	//  Physics
	// ===================================================================
	updatePhysics() {
		if (!this.auv) return;
		if (this.menuOpen) return; // paused
		if (this.keys.w) this.linearVelocity += this.thrustPower;
		if (this.keys.s) this.linearVelocity -= this.thrustPower;
		if (this.keys.d) this.angularVelocity += this.turnPower;
		if (this.keys.a) this.angularVelocity -= this.turnPower;

		this.linearVelocity *= this.linearDamp;
		this.angularVelocity *= this.angularDamp;
		this.heading += this.angularVelocity;

		this.auv.position.x += Math.sin(this.heading) * this.linearVelocity;
		this.auv.position.z += Math.cos(this.heading) * this.linearVelocity;
		this.auv.position.y = 0.42; // sit on top of water surface (water y=0.3)
		this.auv.position.x = Math.max(
			-this.poolHalfW,
			Math.min(this.poolHalfW, this.auv.position.x),
		);
		this.auv.position.z = Math.max(
			-this.poolHalfL,
			Math.min(this.poolHalfL, this.auv.position.z),
		);
		this.auv.rotation.y = this.heading;

		if (this.lProp && this.rProp) {
			const l = (this.linearVelocity - this.angularVelocity * 0.5) * 8;
			const r = (this.linearVelocity + this.angularVelocity * 0.5) * 8;
			this.lProp.rotation.z += l;
			this.rProp.rotation.z += r;
		}
	}

	// ===================================================================
	//  Camera  rigidly behind robot
	// ===================================================================
	updateThermalCamera() {
		if (!this.thermalCamera || !this.auv) return;
		const rx = this.auv.position.x,
			rz = this.auv.position.z;
		// Sit just below the waterline, directly under the robot
		this.thermalCamera.position.set(rx, -0.05, rz);
		// Look straight down at the pool floor
		this.thermalCamera.lookAt(rx, -6, rz);
		// Keep it oriented forward so image isn't rotated
		this.thermalCamera.up.set(
			Math.sin(this.heading),
			0,
			Math.cos(this.heading),
		);
	}

	updateRobotCamera() {
		if (!this.robotCamera || !this.auv) return;
		const sh = Math.sin(this.heading),
			ch = Math.cos(this.heading);
		const rx = this.auv.position.x,
			ry = this.auv.position.y,
			rz = this.auv.position.z;
		// Position at front sensor port
		this.robotCamera.position.set(
			rx + sh * 0.45,
			ry + 0.32,
			rz + ch * 0.45,
		);
		// Look forward and slightly down — like a waterline camera
		this.robotCamera.lookAt(rx + sh * 14, ry - 0.8, rz + ch * 14);
	}

	updateCamera() {
		if (!this.auv) return;
		const behind = 3.5,
			above = 1.6,
			lookAhead = 8;
		const rx = this.auv.position.x,
			ry = this.auv.position.y,
			rz = this.auv.position.z;
		const sh = Math.sin(this.heading),
			ch = Math.cos(this.heading);
		this.camera.position.set(
			rx - sh * behind,
			ry + above,
			rz - ch * behind,
		);
		this.camera.lookAt(rx + sh * lookAhead, ry + 0.3, rz + ch * lookAhead);
	}

	// ===================================================================
	//  Animation loop
	// ===================================================================
	animate() {
		requestAnimationFrame(() => this.animate());
		const t = this.clock.getElapsedTime();
		this.updatePhysics();
		this.updateCamera();
		this.updateRobotCamera();
		this.updateThermalCamera();
		this.updateWater(t);
		this.updateWakeParticles();
		if (!this.renderer || !this.scene) return;

		const r = this.renderer;
		const W = this.canvas.clientWidth;
		const H = this.canvas.clientHeight;

		if (this.viewMode === "split") {
			r.autoClear = false;
			r.setScissorTest(true);
			r.clear(true, true, true);

			// Left half — THERMAL (below-water looking down)
			this._enterThermalRender();
			r.setViewport(0, 0, W / 2, H);
			r.setScissor(0, 0, W / 2, H);
			this.thermalCamera.aspect = W / 2 / H;
			this.thermalCamera.updateProjectionMatrix();
			r.render(this.scene, this.thermalCamera);
			if (this._thermalGridScene)
				r.render(this._thermalGridScene, this._thermalGridCam);
			this._exitThermalRender();

			// Right half — robot front cam
			r.clearDepth();
			r.setViewport(W / 2, 0, W / 2, H);
			r.setScissor(W / 2, 0, W / 2, H);
			this.robotCamera.aspect = W / 2 / H;
			this.robotCamera.updateProjectionMatrix();
			r.render(this.scene, this.robotCamera);

			r.setScissorTest(false);
		} else {
			r.autoClear = true;
			r.setScissorTest(false);
			r.setViewport(0, 0, W, H);
			let cam;
			if (this.viewMode === "camera") cam = this.robotCamera;
			else if (this.viewMode === "thermal") {
				this._enterThermalRender();
				cam = this.thermalCamera;
			} else cam = this.camera;
			cam.aspect = W / H;
			cam.updateProjectionMatrix();
			r.render(this.scene, cam);
			if (this.viewMode === "thermal" && this._thermalGridScene)
				r.render(this._thermalGridScene, this._thermalGridCam);
			if (this.viewMode === "thermal") this._exitThermalRender();
		}
	}

	// ===================================================================
	//  Cleanup
	// ===================================================================
	dispose() {
		window.removeEventListener("keydown", this._kd);
		window.removeEventListener("keyup", this._ku);
		window.removeEventListener("resize", this._resize);
		window.removeEventListener("keydown", this._escKd);
		if (this.renderer) this.renderer.dispose();
	}
}
